// Decoder execution wrapper

import type { DecoderInput, DecoderOutput, Decoder } from '../types/decoders';
import { PERFORMANCE_THRESHOLDS } from '../utils/constants';
import { tfWorker, getWorkerModelType } from './tfWorkerManager';

// Spike history for temporal models
const spikeHistory: number[][] = [];
const MAX_HISTORY = 10;

// Cache compiled decoder functions for JavaScript decoders
const compiledDecoders = new Map<string, (input: DecoderInput) => { x: number; y: number; vx?: number; vy?: number; confidence?: number }>();

// Cache for code-based TFJS models (created from AI-generated code)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const codeBasedModels = new Map<string, any>();

function getCompiledDecoder(decoder: Decoder): (input: DecoderInput) => { x: number; y: number; vx?: number; vy?: number; confidence?: number } {
  const cacheKey = `${decoder.id}:${decoder.code}`;
  
  if (!compiledDecoders.has(cacheKey)) {
    console.log(`[Decoder] Compiling decoder: ${decoder.name}`);
    const fn = new Function('input', decoder.code!) as (input: DecoderInput) => { x: number; y: number; vx?: number; vy?: number; confidence?: number };
    compiledDecoders.set(cacheKey, fn);
  }
  
  return compiledDecoders.get(cacheKey)!;
}

/**
 * Get or create a TensorFlow.js model from code
 * The code should create and return a compiled tf.LayersModel
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCodeBasedModel(decoder: Decoder): Promise<any> {
  const cacheKey = `${decoder.id}:${decoder.code}`;
  
  if (!codeBasedModels.has(cacheKey)) {
    console.log(`[Decoder] Creating code-based TFJS model: ${decoder.name}`);
    
    // The code expects 'tf' to be available in scope
    // We need to get tf from the global scope or import it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tf = (window as any).tf;
    
    if (!tf) {
      throw new Error('TensorFlow.js not loaded. Please wait for tf to be available.');
    }
    
    try {
      // Create a function that has access to tf and returns the model
      const createModel = new Function('tf', decoder.code!) as (tf: unknown) => unknown;
      const model = createModel(tf);
      
      // Handle async model creation
      const resolvedModel = model instanceof Promise ? await model : model;
      
      codeBasedModels.set(cacheKey, resolvedModel);
      console.log(`[Decoder] Code-based model created: ${decoder.name}`);
    } catch (error) {
      console.error(`[Decoder] Failed to create model from code:`, error);
      throw error;
    }
  }
  
  return codeBasedModels.get(cacheKey);
}

/**
 * Clear the code-based model cache
 */
export function clearCodeBasedModelCache(decoderId?: string) {
  if (decoderId) {
    for (const key of codeBasedModels.keys()) {
      if (key.startsWith(decoderId + ':')) {
        const model = codeBasedModels.get(key);
        if (model?.dispose) {
          model.dispose();
        }
        codeBasedModels.delete(key);
      }
    }
  } else {
    for (const model of codeBasedModels.values()) {
      if (model?.dispose) {
        model.dispose();
      }
    }
    codeBasedModels.clear();
  }
}

// Clear cache when decoder changes
export function clearDecoderCache(decoderId?: string) {
  if (decoderId) {
    for (const key of compiledDecoders.keys()) {
      if (key.startsWith(decoderId + ':')) {
        compiledDecoders.delete(key);
      }
    }
  } else {
    compiledDecoders.clear();
  }
}

/**
 * Execute a JavaScript decoder (synchronous)
 */
export function executeJSDecoder(
  decoder: Decoder,
  input: DecoderInput
): DecoderOutput {
  const startTime = performance.now();

  try {
    // Use cached compiled function
    const decoderFunction = getCompiledDecoder(decoder);
    const result = decoderFunction(input);
    
    const latency = performance.now() - startTime;

    // Enforce timeout
    if (latency > PERFORMANCE_THRESHOLDS.DECODER_TIMEOUT_MS) {
      console.warn(`[Decoder] ${decoder.name} exceeded timeout: ${latency.toFixed(2)}ms`);
    }

    return {
      x: result.x,
      y: result.y,
      vx: result.vx,
      vy: result.vy,
      confidence: result.confidence,
      latency,
    };
  } catch (error) {
    console.error(`[Decoder] JS execution error in ${decoder.name}:`, error);
    
    // Return current position as fallback
    return {
      x: input.kinematics.x,
      y: input.kinematics.y,
      vx: input.kinematics.vx,
      vy: input.kinematics.vy,
      latency: performance.now() - startTime,
    };
  }
}

/**
 * Execute a TensorFlow.js decoder using Web Worker (asynchronous, non-blocking)
 */
export async function executeTFJSDecoder(
  decoder: Decoder,
  input: DecoderInput
): Promise<DecoderOutput> {
  const startTime = performance.now();
  
  try {
    const modelType = decoder.tfjsModelType === 'kalman-neural' ? 'mlp' : decoder.tfjsModelType;
    const workerType = getWorkerModelType(modelType);
    
    if (!workerType) {
      console.warn(`[Decoder] Unknown TFJS model type: ${decoder.tfjsModelType}`);
      return {
        x: input.kinematics.x,
        y: input.kinematics.y,
        vx: input.kinematics.vx,
        vy: input.kinematics.vy,
        latency: 0,
      };
    }

    // Prepare input based on model type
    let workerInput: number[] | number[][];
    
    if (workerType === 'lstm' || workerType === 'attention') {
      // Temporal models need spike history
      spikeHistory.push([...input.spikes]);
      if (spikeHistory.length > MAX_HISTORY) {
        spikeHistory.shift();
      }
      
      // Pad history if needed
      while (spikeHistory.length < MAX_HISTORY) {
        spikeHistory.unshift(new Array(142).fill(0));
      }
      
      workerInput = spikeHistory.map(s => [...s]);
    } else {
      // Non-temporal models just need current spikes
      workerInput = [...input.spikes];
    }

    // Run inference in worker
    const output = await tfWorker.infer(workerType, workerInput);
    const latency = performance.now() - startTime;

    // Scale output to velocity
    const VELOCITY_SCALE = 50;
    const vx = output[0] * VELOCITY_SCALE;
    const vy = output[1] * VELOCITY_SCALE;

    // Calculate new position
    const DT = 0.025;
    const x = input.kinematics.x + vx * DT;
    const y = input.kinematics.y + vy * DT;

    return {
      x: Math.max(-100, Math.min(100, x)),
      y: Math.max(-100, Math.min(100, y)),
      vx,
      vy,
      latency,
    };
  } catch (error) {
    console.error(`[Decoder] TFJS Worker execution error in ${decoder.name}:`, error);
    
    return {
      x: input.kinematics.x,
      y: input.kinematics.y,
      vx: input.kinematics.vx,
      vy: input.kinematics.vy,
      latency: performance.now() - startTime,
    };
  }
}

/**
 * Execute a code-based TensorFlow.js decoder (AI-generated models)
 * These models are created from user code and run on the main thread
 */
export async function executeCodeBasedTFJSDecoder(
  decoder: Decoder,
  input: DecoderInput
): Promise<DecoderOutput> {
  const startTime = performance.now();
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tf = (window as any).tf;
    if (!tf) {
      console.error('[Decoder] TensorFlow.js not available on window.tf');
      throw new Error('TensorFlow.js not loaded');
    }
    
    // Get or create the model
    const model = await getCodeBasedModel(decoder);
    
    if (!model) {
      console.error('[Decoder] Model is null/undefined');
      throw new Error('Model creation returned null');
    }
    
    if (!model.predict) {
      console.error('[Decoder] Model missing predict method. Model type:', typeof model, 'Keys:', Object.keys(model || {}));
      throw new Error('Invalid model: missing predict method');
    }
    
    // Prepare input tensor
    // Models expect shape [batch, 142] or [batch, 10, 142] for temporal
    const inputData = [...input.spikes];
    
    // Log first inference for debugging
    if (!codeBasedModels.has(`${decoder.id}:logged`)) {
      console.log(`[Decoder] First inference for ${decoder.name}:`, {
        inputShape: [1, inputData.length],
        sampleInput: inputData.slice(0, 5),
        modelInputShape: model.inputs?.[0]?.shape,
        modelOutputShape: model.outputs?.[0]?.shape,
      });
      codeBasedModels.set(`${decoder.id}:logged`, true);
    }
    
    const inputTensor = tf.tensor2d([inputData], [1, inputData.length]);
    
    // Run inference
    const outputTensor = model.predict(inputTensor);
    const output = await outputTensor.data();
    
    // Log output for debugging on first call
    if (!codeBasedModels.has(`${decoder.id}:output-logged`)) {
      console.log(`[Decoder] First output for ${decoder.name}:`, {
        rawOutput: Array.from(output),
        outputLength: output.length,
      });
      codeBasedModels.set(`${decoder.id}:output-logged`, true);
    }
    
    // Clean up tensors
    inputTensor.dispose();
    outputTensor.dispose();
    
    const latency = performance.now() - startTime;
    
    // Scale output to velocity
    const VELOCITY_SCALE = 50;
    const vx = output[0] * VELOCITY_SCALE;
    const vy = output[1] * VELOCITY_SCALE;
    
    // Calculate new position
    const DT = 0.025;
    const x = input.kinematics.x + vx * DT;
    const y = input.kinematics.y + vy * DT;
    
    return {
      x: Math.max(-100, Math.min(100, x)),
      y: Math.max(-100, Math.min(100, y)),
      vx,
      vy,
      latency,
    };
  } catch (error) {
    console.error(`[Decoder] Code-based TFJS execution error in ${decoder.name}:`, error);
    
    // Return zero velocity to make it obvious something is wrong
    // instead of passing through ground truth
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      latency: performance.now() - startTime,
    };
  }
}

/**
 * Execute any decoder (routes to appropriate executor)
 */
export async function executeDecoder(
  decoder: Decoder,
  input: DecoderInput
): Promise<DecoderOutput> {
  // Code-based TFJS decoders (AI-generated)
  if (decoder.type === 'tfjs' && decoder.code) {
    return executeCodeBasedTFJSDecoder(decoder, input);
  }
  
  // Built-in TFJS decoders (worker-based)
  if (decoder.type === 'tfjs') {
    return executeTFJSDecoder(decoder, input);
  }
  
  // JavaScript baseline decoders
  if (decoder.type === 'javascript' && decoder.code) {
    return executeJSDecoder(decoder, input);
  }
  
  // Fallback - passthrough
  return {
    x: input.kinematics.x,
    y: input.kinematics.y,
    vx: input.kinematics.vx,
    vy: input.kinematics.vy,
    latency: 0,
  };
}

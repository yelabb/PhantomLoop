/**
 * Unified Decoder Execution
 * 
 * Execution paths:
 * 1. Built-in TFJS (tfjsModelType) → Web Worker inference
 * 2. Custom TFJS code → Create model once, run inference per frame
 * 3. Simple JS code → Direct execution (baselines)
 * 
 * Custom TensorFlow.js code should return a compiled model.
 * The model is cached and used for inference on subsequent calls.
 */

import * as tf from '@tensorflow/tfjs';
import type { DecoderInput, DecoderOutput, Decoder } from '../types/decoders';
import { PERFORMANCE_THRESHOLDS } from '../utils/constants';
import { tfWorker, getWorkerModelType } from './tfWorkerManager';

// Spike history for temporal models (LSTM, Attention)
const spikeHistory: number[][] = [];
const MAX_HISTORY = 10;

// Cache for custom TensorFlow.js models (created from code)
const customModels = new Map<string, tf.LayersModel>();

// Track failed model creation to avoid retrying broken code
const failedModels = new Set<string>();

/**
 * Check if code is TensorFlow.js model creation code
 */
function isTFJSModelCode(code: string): boolean {
  return code.includes('tf.sequential') || 
         code.includes('tf.model') || 
         code.includes('tf.layers');
}

/**
 * Create a TensorFlow.js model from custom code (cached)
 */
async function getOrCreateCustomModel(decoder: Decoder): Promise<tf.LayersModel> {
  const cacheKey = decoder.id;
  
  // Don't retry failed models
  if (failedModels.has(cacheKey)) {
    throw new Error(`Model "${decoder.name}" previously failed to create`);
  }
  
  if (!customModels.has(cacheKey)) {
    console.log(`[Decoder] Creating custom model: ${decoder.name}`);
    
    try {
      // Execute the code to create the model
      const createModel = new Function('tf', decoder.code!) as (tf: typeof import('@tensorflow/tfjs')) => tf.LayersModel | Promise<tf.LayersModel>;
      const model = await Promise.resolve(createModel(tf));
      
      if (!model || typeof model.predict !== 'function') {
        throw new Error('Code must return a TensorFlow.js model with a predict() method');
      }
      
      customModels.set(cacheKey, model);
      console.log(`[Decoder] Model created: ${decoder.name}`, {
        inputShape: model.inputs[0]?.shape,
        outputShape: model.outputs[0]?.shape
      });
    } catch (error) {
      failedModels.add(cacheKey);
      throw new Error(
        `Failed to create model from code: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  return customModels.get(cacheKey)!;
}

/**
 * Clear custom model cache
 */
export function clearDecoderCache(decoderId?: string) {
  if (decoderId) {
    const model = customModels.get(decoderId);
    if (model) {
      model.dispose();
      customModels.delete(decoderId);
    }
    failedModels.delete(decoderId);
  } else {
    for (const model of customModels.values()) {
      model.dispose();
    }
    customModels.clear();
    failedModels.clear();
  }
}

/**
 * Execute a custom TensorFlow.js model decoder
 * Same pattern as built-in: create model once, run inference per frame
 */
export async function executeCustomTFJSDecoder(
  decoder: Decoder,
  input: DecoderInput
): Promise<DecoderOutput> {
  const startTime = performance.now();
  
  // Get or create the model (cached)
  const model = await getOrCreateCustomModel(decoder);
  
  // Prepare input tensor
  const inputData = [...input.spikes];
  
  // Run inference (same as built-in models)
  const result = tf.tidy(() => {
    const inputTensor = tf.tensor2d([inputData], [1, inputData.length]);
    const prediction = model.predict(inputTensor) as tf.Tensor;
    return prediction;
  });
  
  const outputData = await result.data();
  result.dispose();
  
  const latency = performance.now() - startTime;
  
  // Scale output to velocity (same as built-in)
  const VELOCITY_SCALE = 50;
  const vx = outputData[0] * VELOCITY_SCALE;
  const vy = outputData[1] * VELOCITY_SCALE;
  
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
}

/**
 * Execute a simple JavaScript decoder (baselines)
 * Code directly computes and returns {x, y, vx?, vy?}
 */
export function executeSimpleJSDecoder(
  decoder: Decoder,
  input: DecoderInput
): DecoderOutput {
  const startTime = performance.now();

  // Compile and cache the function
  const cacheKey = decoder.id;
  type DecoderResult = { x: number; y: number; vx?: number; vy?: number; confidence?: number };
  
  // Use a module-level cache for simple JS decoders
  const simpleDecoderCache = (executeSimpleJSDecoder as { cache?: Map<string, (input: DecoderInput) => DecoderResult> }).cache 
    ??= new Map();
  
  if (!simpleDecoderCache.has(cacheKey)) {
    const fn = new Function('input', decoder.code!) as (input: DecoderInput) => DecoderResult;
    simpleDecoderCache.set(cacheKey, fn);
  }
  
  const decoderFn = simpleDecoderCache.get(cacheKey)!;
  const result = decoderFn(input);
  
  const latency = performance.now() - startTime;

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
}

/**
 * Execute a code-based decoder (auto-detects type)
 */
export async function executeCodeDecoder(
  decoder: Decoder,
  input: DecoderInput
): Promise<DecoderOutput> {
  // Detect if this is TensorFlow.js model code or simple JS
  if (isTFJSModelCode(decoder.code!)) {
    return executeCustomTFJSDecoder(decoder, input);
  } else {
    return executeSimpleJSDecoder(decoder, input);
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
      throw new Error(
        `[Decoder] Unknown TFJS model type "${decoder.tfjsModelType}" for decoder "${decoder.name}"`
      );
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

    // Run inference in worker (off main thread)
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
    // Never silently corrupt data - rethrow with context
    throw new Error(
      `[Decoder] TFJS Worker failed for "${decoder.name}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Execute any decoder - unified routing
 * 
 * Execution paths:
 * 1. Has code → Auto-detect: TFJS model code or simple JS
 * 2. Has tfjsModelType → Web Worker inference (built-in TFJS models)
 * 
 * THROWS on invalid decoder configuration - never silently corrupts data
 */
export async function executeDecoder(
  decoder: Decoder,
  input: DecoderInput
): Promise<DecoderOutput> {
  // Code-based decoders (custom + baselines)
  // Auto-detects if code creates a TF model or is simple JS
  if (decoder.code) {
    return executeCodeDecoder(decoder, input);
  }
  
  // Built-in TFJS decoders (Web Worker, non-blocking)
  if (decoder.tfjsModelType) {
    return executeTFJSDecoder(decoder, input);
  }
  
  // Invalid decoder configuration - fail hard, never silently corrupt data
  throw new Error(
    `[Decoder] Invalid decoder configuration for "${decoder.name}" (id: ${decoder.id}). ` +
    `Decoder must have either 'code' (JavaScript/TFJS) or 'tfjsModelType' (built-in TFJS).`
  );
}

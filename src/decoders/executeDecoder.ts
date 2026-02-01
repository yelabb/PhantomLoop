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

// Force bundler to include tf.train namespace (used by custom code)
void tf.train.adam;

// Spike history for temporal models (LSTM, Attention)
const spikeHistory: number[][] = [];
const MAX_HISTORY = 10;

// Cache for custom TensorFlow.js models (created from code)
const customModels = new Map<string, tf.LayersModel>();

// Cache for compiled JS functions
type JSDecoderFn = (input: DecoderInput) => { x: number; y: number; vx?: number; vy?: number; confidence?: number };
const jsFunctions = new Map<string, JSDecoderFn>();

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
 * No "failed" tracking - always tries, throws on error
 */
async function getOrCreateCustomModel(decoder: Decoder): Promise<tf.LayersModel> {
  if (!customModels.has(decoder.id)) {
    console.log(`[Decoder] Creating custom model: ${decoder.name}`);
    
    // Execute the code to create the model
    const createModel = new Function('tf', decoder.code!) as (tf: typeof import('@tensorflow/tfjs')) => tf.LayersModel | Promise<tf.LayersModel>;
    const model = await Promise.resolve(createModel(tf));
    
    if (!model || typeof model.predict !== 'function') {
      throw new Error('Code must return a TensorFlow.js model with predict() method');
    }
    
    customModels.set(decoder.id, model);
    console.log(`[Decoder] Model ready: ${decoder.name}`, {
      input: model.inputs[0]?.shape,
      output: model.outputs[0]?.shape
    });
  }
  
  return customModels.get(decoder.id)!;
}

/**
 * Get or compile a JS decoder function (cached)
 */
function getOrCompileJSDecoder(decoder: Decoder): JSDecoderFn {
  if (!jsFunctions.has(decoder.id)) {
    console.log(`[Decoder] Compiling JS: ${decoder.name}`);
    const fn = new Function('input', decoder.code!) as JSDecoderFn;
    jsFunctions.set(decoder.id, fn);
  }
  return jsFunctions.get(decoder.id)!;
}

/**
 * Clear decoder cache - call when decoder is updated or removed
 */
export function clearDecoderCache(decoderId?: string) {
  if (decoderId) {
    const model = customModels.get(decoderId);
    if (model) {
      model.dispose();
    }
    customModels.delete(decoderId);
    jsFunctions.delete(decoderId);
  } else {
    for (const model of customModels.values()) {
      model.dispose();
    }
    customModels.clear();
    jsFunctions.clear();
  }
}

/**
 * Execute a custom TensorFlow.js model decoder
 * Same pattern as built-in: create model once, run inference per frame
 */
async function executeCustomTFJSDecoder(
  decoder: Decoder,
  input: DecoderInput
): Promise<DecoderOutput> {
  const startTime = performance.now();
  
  const model = await getOrCreateCustomModel(decoder);
  
  // Run inference (same as built-in models)
  const result = tf.tidy(() => {
    const inputTensor = tf.tensor2d([input.spikes], [1, input.spikes.length]);
    return model.predict(inputTensor) as tf.Tensor;
  });
  
  const outputData = result.dataSync();
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
 * Execute a simple JavaScript decoder (baselines + custom JS)
 */
function executeSimpleJSDecoder(
  decoder: Decoder,
  input: DecoderInput
): DecoderOutput {
  const startTime = performance.now();

  const decoderFn = getOrCompileJSDecoder(decoder);
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
async function executeCodeDecoder(
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

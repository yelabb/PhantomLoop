/**
 * Unified Decoder Execution
 * 
 * Execution paths:
 * 1. Built-in TFJS (tfjsModelType) → Web Worker inference
 * 2. Custom TFJS code → Web Worker (same as built-in)
 * 3. Simple JS code → Direct execution (baselines)
 * 
 * Custom TensorFlow.js code is executed in the Web Worker
 * where the full tf namespace (including tf.train) is available.
 */

import type { DecoderInput, DecoderOutput, Decoder } from '../types/decoders';
import { PERFORMANCE_THRESHOLDS } from '../utils/constants';
import { tfWorker, getWorkerModelType } from './tfWorkerManager';

// Spike history for temporal models (LSTM, Attention)
const spikeHistory: number[][] = [];
const MAX_HISTORY = 10;

// Cache for compiled JS functions (simple decoders, not TFJS)
type JSDecoderFn = (input: DecoderInput) => { x: number; y: number; vx?: number; vy?: number; confidence?: number };
const jsFunctions = new Map<string, JSDecoderFn>();

// Track which custom TFJS models have been loaded into the worker
const customModelsLoaded = new Set<string>();

/**
 * Check if code is TensorFlow.js model creation code
 */
function isTFJSModelCode(code: string): boolean {
  return code.includes('tf.sequential') || 
         code.includes('tf.model') || 
         code.includes('tf.layers');
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
    jsFunctions.delete(decoderId);
    // Also dispose from worker if it was a custom TFJS model
    if (customModelsLoaded.has(decoderId)) {
      tfWorker.disposeModel(decoderId);
      customModelsLoaded.delete(decoderId);
    }
  } else {
    jsFunctions.clear();
    // Dispose all custom models from worker
    for (const id of customModelsLoaded) {
      tfWorker.disposeModel(id);
    }
    customModelsLoaded.clear();
  }
}

/**
 * Execute a custom TensorFlow.js model decoder via Web Worker
 * Same execution path as built-in TFJS models - code runs in worker
 */
async function executeCustomTFJSDecoder(
  decoder: Decoder,
  input: DecoderInput
): Promise<DecoderOutput> {
  const startTime = performance.now();
  
  // Create model in worker if not already loaded
  if (!customModelsLoaded.has(decoder.id)) {
    await tfWorker.createModelFromCode(decoder.id, decoder.code!);
    customModelsLoaded.add(decoder.id);
  }
  
  // Run inference via worker (same as built-in models)
  const output = await tfWorker.infer(decoder.id, [...input.spikes]);
  const latency = performance.now() - startTime;

  // Scale output to velocity (same as built-in)
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

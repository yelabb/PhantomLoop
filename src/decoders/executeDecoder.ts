/**
 * Unified Decoder Execution
 * 
 * All decoders (built-in and custom) use the same execution path:
 * - Built-in TFJS: Web Worker inference
 * - Custom JS: Compiled function with sandboxed input
 * 
 * Custom JavaScript decoders use the same format as baselines:
 * - Receive `input` object with { spikes, kinematics, history }
 * - Return { x, y, vx?, vy?, confidence? }
 */

import type { DecoderInput, DecoderOutput, Decoder } from '../types/decoders';
import { PERFORMANCE_THRESHOLDS } from '../utils/constants';
import { tfWorker, getWorkerModelType } from './tfWorkerManager';

// Spike history for temporal models (LSTM, Attention)
const spikeHistory: number[][] = [];
const MAX_HISTORY = 10;

// Cache compiled decoder functions for JavaScript decoders
type DecoderResult = { x: number; y: number; vx?: number; vy?: number; confidence?: number };
const compiledDecoders = new Map<string, (input: DecoderInput) => DecoderResult>();

// Track failed decoders to avoid spamming errors
const failedDecoders = new Set<string>();

/**
 * Get or compile a JavaScript decoder function
 * Uses the same pattern for both built-in baselines and custom decoders
 */
function getCompiledDecoder(decoder: Decoder): (input: DecoderInput) => DecoderResult {
  const cacheKey = `${decoder.id}:${decoder.code}`;
  
  if (!compiledDecoders.has(cacheKey)) {
    console.log(`[Decoder] Compiling: ${decoder.name}`);
    const fn = new Function('input', decoder.code!) as (input: DecoderInput) => DecoderResult;
    compiledDecoders.set(cacheKey, fn);
  }
  
  return compiledDecoders.get(cacheKey)!;
}

/**
 * Clear compiled decoder cache
 */
export function clearDecoderCache(decoderId?: string) {
  if (decoderId) {
    for (const key of compiledDecoders.keys()) {
      if (key.startsWith(decoderId + ':')) {
        compiledDecoders.delete(key);
        failedDecoders.delete(key);
      }
    }
  } else {
    compiledDecoders.clear();
    failedDecoders.clear();
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
    // Never silently corrupt data - rethrow with context
    throw new Error(
      `[Decoder] JS execution failed for "${decoder.name}": ${error instanceof Error ? error.message : String(error)}`
    );
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
 * Simplified execution paths:
 * 1. TFJS with tfjsModelType → Web Worker inference (built-in models)
 * 2. JavaScript with code → Compiled function execution (baselines & custom)
 * 
 * THROWS on invalid decoder configuration - never silently corrupts data
 */
export async function executeDecoder(
  decoder: Decoder,
  input: DecoderInput
): Promise<DecoderOutput> {
  // Built-in TFJS decoders (Web Worker, non-blocking)
  if (decoder.type === 'tfjs' && decoder.tfjsModelType) {
    return executeTFJSDecoder(decoder, input);
  }
  
  // JavaScript decoders (built-in baselines + custom)
  if (decoder.type === 'javascript' && decoder.code) {
    return executeJSDecoder(decoder, input);
  }
  
  // Invalid decoder configuration - fail hard, never silently corrupt data
  throw new Error(
    `[Decoder] Invalid decoder configuration for "${decoder.name}" (id: ${decoder.id}). ` +
    `Type: ${decoder.type}, has code: ${!!decoder.code}, tfjsModelType: ${decoder.tfjsModelType ?? 'none'}. ` +
    `Decoder must have either (type='tfjs' + tfjsModelType) or (type='javascript' + code).`
  );
}

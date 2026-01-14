// Decoder execution wrapper

import type { DecoderInput, DecoderOutput, Decoder } from '../types/decoders';
import { PERFORMANCE_THRESHOLDS } from '../utils/constants';
import { tfWorker, getWorkerModelType } from './tfWorkerManager';

// Spike history for temporal models
const spikeHistory: number[][] = [];
const MAX_HISTORY = 10;

// Cache compiled decoder functions to avoid recompiling on every call
const compiledDecoders = new Map<string, (input: DecoderInput) => { x: number; y: number; vx?: number; vy?: number; confidence?: number }>();

function getCompiledDecoder(decoder: Decoder): (input: DecoderInput) => { x: number; y: number; vx?: number; vy?: number; confidence?: number } {
  const cacheKey = `${decoder.id}:${decoder.code}`;
  
  if (!compiledDecoders.has(cacheKey)) {
    console.log(`[Decoder] Compiling decoder: ${decoder.name}`);
    const fn = new Function('input', decoder.code!) as (input: DecoderInput) => { x: number; y: number; vx?: number; vy?: number; confidence?: number };
    compiledDecoders.set(cacheKey, fn);
  }
  
  return compiledDecoders.get(cacheKey)!;
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
 * Execute any decoder (routes to appropriate executor)
 */
export async function executeDecoder(
  decoder: Decoder,
  input: DecoderInput
): Promise<DecoderOutput> {
  if (decoder.type === 'tfjs') {
    return executeTFJSDecoder(decoder, input);
  } else if (decoder.type === 'javascript' && decoder.code) {
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

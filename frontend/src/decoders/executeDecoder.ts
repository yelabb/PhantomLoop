// Decoder execution wrapper

import type { DecoderInput, DecoderOutput, Decoder } from '../types/decoders';
import { PERFORMANCE_THRESHOLDS } from '../utils/constants';

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
 * Execute a JavaScript decoder with timeout protection
 */
export function executeDecoder(
  decoder: Decoder,
  input: DecoderInput
): DecoderOutput {
  const startTime = performance.now();

  try {
    if (decoder.type === 'javascript' && decoder.code) {
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
    }

    // Unsupported decoder type - passthrough
    return {
      x: input.kinematics.x,
      y: input.kinematics.y,
      vx: input.kinematics.vx,
      vy: input.kinematics.vy,
      latency: performance.now() - startTime,
    };
  } catch (error) {
    console.error(`[Decoder] Execution error in ${decoder.name}:`, error);
    
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

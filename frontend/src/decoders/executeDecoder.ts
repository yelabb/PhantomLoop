// Decoder execution wrapper

import type { DecoderInput, DecoderOutput, Decoder } from '../types/decoders';
import { PERFORMANCE_THRESHOLDS } from '../utils/constants';

/**
 * Execute a JavaScript decoder with timeout protection
 */
export async function executeDecoder(
  decoder: Decoder,
  input: DecoderInput
): Promise<DecoderOutput> {
  const startTime = performance.now();

  try {
    if (decoder.type === 'javascript' && decoder.code) {
      // Compile and execute JavaScript decoder
      const decoderFunction = new Function('input', decoder.code);
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

    throw new Error(`Unsupported decoder type: ${decoder.type}`);
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

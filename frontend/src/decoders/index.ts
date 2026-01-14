/**
 * Decoder Registry
 * 
 * Central export for all available decoders.
 * Includes both JavaScript baselines and TensorFlow.js neural decoders.
 */

import { baselineDecoders } from './baselines';
import { tfjsDecoders } from './tfjsDecoders';
import type { Decoder } from '../types/decoders';

// All available decoders
export const allDecoders: Decoder[] = [
  ...tfjsDecoders,    // Neural network decoders (recommended)
  ...baselineDecoders, // Simple JavaScript baselines
];

// Decoder lookup by ID
const decoderMap = new Map<string, Decoder>();
for (const decoder of allDecoders) {
  decoderMap.set(decoder.id, decoder);
}

/**
 * Get a decoder by ID
 */
export function getDecoderById(id: string): Decoder | undefined {
  return decoderMap.get(id);
}

/**
 * Get decoders by type
 */
export function getDecodersByType(type: 'javascript' | 'tfjs'): Decoder[] {
  return allDecoders.filter(d => d.type === type);
}

// Re-export everything
export { baselineDecoders } from './baselines';
export { tfjsDecoders } from './tfjsDecoders';
export { executeDecoder, executeJSDecoder, executeTFJSDecoder } from './executeDecoder';
export { initializeTFBackend, getBackendInfo, getMemoryInfo } from './tfjsBackend';
export { getModel, clearModelCache, getModelInfo } from './tfjsModels';
export { clearHistory } from './tfjsInference';

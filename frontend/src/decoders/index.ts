/**
 * Decoder Registry
 * 
 * Central export for all available decoders.
 * Includes both JavaScript baselines and TensorFlow.js neural decoders.
 */

import { baselineDecoders } from './baselines';
import { tfjsDecoders } from './tfjsDecoders';
import { tfWorker, getWorkerModelType } from './tfWorkerManager';
import type { Decoder, TFJSModelType } from '../types/decoders';

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

/**
 * Initialize a TFJS model using Web Worker (non-blocking)
 * This keeps the main thread responsive during model compilation
 */
export async function initModel(modelType: TFJSModelType): Promise<void> {
  const workerType = getWorkerModelType(modelType === 'kalman-neural' ? 'mlp' : modelType);
  if (!workerType) {
    console.warn(`[Decoder] No worker type for: ${modelType}`);
    return;
  }
  
  await tfWorker.createModel(workerType);
}

/**
 * Check if a model is loaded
 */
export function isModelLoaded(modelType: TFJSModelType): boolean {
  const workerType = getWorkerModelType(modelType === 'kalman-neural' ? 'mlp' : modelType);
  return workerType ? tfWorker.isModelLoaded(workerType) : false;
}

/**
 * Get worker manager for direct access
 */
export { tfWorker } from './tfWorkerManager';

// Re-export everything
export { baselineDecoders } from './baselines';
export { tfjsDecoders } from './tfjsDecoders';
export { executeDecoder, executeJSDecoder, executeTFJSDecoder } from './executeDecoder';
export { initializeTFBackend, getBackendInfo, getMemoryInfo } from './tfjsBackend';
export { getModel, clearModelCache, getModelInfo } from './tfjsModels';
export { clearHistory } from './tfjsInference';

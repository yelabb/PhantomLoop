/**
 * Decoder Registry
 * 
 * Central export for all available decoders.
 * Supports multiple model sources:
 *   - builtin: Programmatic models built in-browser
 *   - url: Pre-trained models loaded from remote URLs
 *   - local: Models from /models/ folder
 *   - custom: User-defined JavaScript functions
 */

import { baselineDecoders } from './baselines';
import { tfjsDecoders } from './tfjsDecoders';
import { tfWorker, getWorkerModelType } from './tfWorkerManager';
import type { Decoder, TFJSModelType, DecoderSource } from '../types/decoders';

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
 * Register a custom decoder at runtime
 */
export function registerCustomDecoder(decoder: Decoder): void {
  if (decoderMap.has(decoder.id)) {
    console.warn(`[Decoder] Overwriting existing decoder: ${decoder.id}`);
  }
  decoderMap.set(decoder.id, decoder);
  // Add to allDecoders if not already there
  const index = allDecoders.findIndex(d => d.id === decoder.id);
  if (index >= 0) {
    allDecoders[index] = decoder;
  } else {
    allDecoders.push(decoder);
  }
  console.log(`[Decoder] Registered: ${decoder.name} (${decoder.source?.type || decoder.type})`);
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
 * Get decoders by source type
 */
export function getDecodersBySource(sourceType: DecoderSource['type']): Decoder[] {
  return allDecoders.filter(d => d.source?.type === sourceType);
}

/**
 * Initialize a decoder model based on its source
 * This handles builtin, URL, and local sources automatically
 */
export async function initModel(decoder: Decoder | TFJSModelType): Promise<void> {
  // Legacy support: if just a model type string is passed
  if (typeof decoder === 'string') {
    const workerType = getWorkerModelType(decoder === 'kalman-neural' ? 'mlp' : decoder);
    if (workerType) {
      await tfWorker.createModel(workerType);
    }
    return;
  }

  // Handle source-based loading
  const source = decoder.source;
  
  if (!source) {
    // Legacy: use tfjsModelType if no source specified
    if (decoder.tfjsModelType) {
      const workerType = getWorkerModelType(decoder.tfjsModelType === 'kalman-neural' ? 'mlp' : decoder.tfjsModelType);
      if (workerType) {
        await tfWorker.createModel(workerType);
      }
    } else if (decoder.modelUrl) {
      // Legacy: use modelUrl if specified
      await tfWorker.loadModelFromUrl(decoder.id, decoder.modelUrl);
    }
    return;
  }

  switch (source.type) {
    case 'builtin': {
      const workerType = getWorkerModelType(source.modelType === 'kalman-neural' ? 'mlp' : source.modelType);
      if (workerType) {
        await tfWorker.createModel(workerType);
      }
      break;
    }

    case 'url': {
      await tfWorker.loadModelFromUrl(decoder.id, source.url);
      break;
    }

    case 'local': {
      // Local models are served from /models/ folder
      const url = source.path.startsWith('/') ? source.path : `/models/${source.path}`;
      await tfWorker.loadModelFromUrl(decoder.id, url);
      break;
    }

    case 'custom': {
      // Custom decoders don't need initialization
      // The function is called directly during inference
      console.log(`[Decoder] Custom decoder ready: ${decoder.id}`);
      break;
    }
  }
}

/**
 * Check if a model is loaded
 */
export function isModelLoaded(decoder: Decoder | TFJSModelType): boolean {
  if (typeof decoder === 'string') {
    const workerType = getWorkerModelType(decoder === 'kalman-neural' ? 'mlp' : decoder);
    return workerType ? tfWorker.isModelLoaded(workerType) : false;
  }
  
  // Check by decoder ID for URL/local sources
  if (decoder.source?.type === 'url' || decoder.source?.type === 'local') {
    return tfWorker.isModelLoaded(decoder.id);
  }
  
  // Builtin models use their type
  if (decoder.source?.type === 'builtin') {
    const workerType = getWorkerModelType(decoder.source.modelType);
    return workerType ? tfWorker.isModelLoaded(workerType) : false;
  }
  
  // Legacy check
  if (decoder.tfjsModelType) {
    const workerType = getWorkerModelType(decoder.tfjsModelType === 'kalman-neural' ? 'mlp' : decoder.tfjsModelType);
    return workerType ? tfWorker.isModelLoaded(workerType) : false;
  }
  
  // Custom decoders are always "loaded"
  if (decoder.source?.type === 'custom') {
    return true;
  }
  
  return false;
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

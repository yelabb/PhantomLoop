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

// Storage key for persisting custom decoders
const CUSTOM_DECODERS_KEY = 'phantomloop-custom-decoders-v1';

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
 * Load persisted custom decoders from localStorage
 */
function loadPersistedDecoders(): void {
  try {
    const stored = localStorage.getItem(CUSTOM_DECODERS_KEY);
    if (!stored) return;
    
    const decoders: Decoder[] = JSON.parse(stored);
    console.log(`[Decoder] Loading ${decoders.length} persisted custom decoder(s)`);
    
    for (const decoder of decoders) {
      // Don't overwrite builtin decoders
      if (!decoderMap.has(decoder.id)) {
        decoderMap.set(decoder.id, decoder);
        allDecoders.push(decoder);
        console.log(`[Decoder] Restored: ${decoder.name}`);
      }
    }
  } catch (error) {
    console.warn('[Decoder] Failed to load persisted decoders:', error);
    // Clear corrupted data
    localStorage.removeItem(CUSTOM_DECODERS_KEY);
  }
}

/**
 * Save custom decoders to localStorage
 */
function persistCustomDecoders(): void {
  try {
    // Get all custom decoders (those with code or custom source)
    const customDecoders = allDecoders.filter(d => 
      d.code || d.source?.type === 'url' || d.source?.type === 'local'
    );
    
    if (customDecoders.length === 0) {
      localStorage.removeItem(CUSTOM_DECODERS_KEY);
    } else {
      localStorage.setItem(CUSTOM_DECODERS_KEY, JSON.stringify(customDecoders));
      console.log(`[Decoder] Persisted ${customDecoders.length} custom decoder(s)`);
    }
  } catch (error) {
    console.warn('[Decoder] Failed to persist decoders:', error);
  }
}

// Load persisted decoders on module initialization
loadPersistedDecoders();

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
  
  // Persist to localStorage
  persistCustomDecoders();
}

/**
 * Remove a custom decoder
 */
export function removeCustomDecoder(decoderId: string): boolean {
  const decoder = decoderMap.get(decoderId);
  if (!decoder) return false;
  
  // Don't allow removing builtin decoders
  const isCustom = decoder.code || decoder.source?.type === 'url' || decoder.source?.type === 'local';
  if (!isCustom) {
    console.warn(`[Decoder] Cannot remove builtin decoder: ${decoderId}`);
    return false;
  }
  
  decoderMap.delete(decoderId);
  const index = allDecoders.findIndex(d => d.id === decoderId);
  if (index >= 0) {
    allDecoders.splice(index, 1);
  }
  
  console.log(`[Decoder] Removed: ${decoder.name}`);
  persistCustomDecoders();
  return true;
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
export { executeDecoder, executeTFJSDecoder, clearDecoderCache } from './executeDecoder';
export { initializeTFBackend, getBackendInfo, getMemoryInfo } from './tfjsBackend';
export { getModel, clearModelCache, getModelInfo } from './tfjsModels';
export { clearHistory } from './tfjsInference';

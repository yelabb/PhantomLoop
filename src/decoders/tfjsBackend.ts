/**
 * TensorFlow.js Backend Management
 * Handles GPU backend initialization and provides utilities
 */

import * as tf from '@tensorflow/tfjs';

export type BackendType = 'webgpu' | 'webgl' | 'cpu';

interface BackendInfo {
  name: BackendType;
  isGPU: boolean;
  initialized: boolean;
}

let currentBackend: BackendInfo = {
  name: 'cpu',
  isGPU: false,
  initialized: false,
};

/**
 * Initialize the best available TensorFlow.js backend
 * Priority: WebGPU > WebGL > CPU
 */
export async function initializeTFBackend(): Promise<BackendInfo> {
  if (currentBackend.initialized) {
    return currentBackend;
  }

  // Try WebGPU first (best performance)
  try {
    await import('@tensorflow/tfjs-backend-webgpu');
    await tf.setBackend('webgpu');
    await tf.ready();
    currentBackend = { name: 'webgpu', isGPU: true, initialized: true };
    console.log('[TFJS] ✓ WebGPU backend initialized');
    return currentBackend;
  } catch {
    console.log('[TFJS] WebGPU not available');
  }

  // Fallback to WebGL
  try {
    await import('@tensorflow/tfjs-backend-webgl');
    await tf.setBackend('webgl');
    await tf.ready();
    currentBackend = { name: 'webgl', isGPU: true, initialized: true };
    console.log('[TFJS] ✓ WebGL backend initialized');
    return currentBackend;
  } catch {
    console.log('[TFJS] WebGL not available');
  }

  // Final fallback to CPU
  await tf.setBackend('cpu');
  await tf.ready();
  currentBackend = { name: 'cpu', isGPU: false, initialized: true };
  console.log('[TFJS] ⚠ Using CPU backend (slower)');
  return currentBackend;
}

/**
 * Get current backend info
 */
export function getBackendInfo(): BackendInfo {
  return currentBackend;
}

/**
 * Get TensorFlow.js memory info
 */
export function getMemoryInfo() {
  return tf.memory();
}

/**
 * Dispose all tensors and reset memory
 */
export function cleanupMemory() {
  tf.disposeVariables();
  console.log('[TFJS] Memory cleaned up');
}

export { tf };

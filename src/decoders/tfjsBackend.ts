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
 * Called periodically during long streaming sessions to prevent memory leaks
 */
export function cleanupMemory() {
  const before = tf.memory();
  tf.disposeVariables();
  // Only log if we actually freed significant memory (>1MB)
  const after = tf.memory();
  const freedBytes = before.numBytes - after.numBytes;
  if (freedBytes > 1_000_000) {
    console.log(`[TFJS] Memory cleaned up: freed ${(freedBytes / 1_000_000).toFixed(1)}MB`);
  }
}

export { tf };

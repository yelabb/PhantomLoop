/**
 * Dynamic TensorFlow.js Model Factory
 * 
 * Creates neural network decoders with configurable input channel count.
 * Enables stream-agnostic decoding - same architecture works on 8ch EEG or 142ch spikes.
 */

import * as tf from '@tensorflow/tfjs';

// Cache key includes channel count
const dynamicModelCache = new Map<string, tf.LayersModel>();

/**
 * Create a Linear Decoder with dynamic input shape
 */
export async function createDynamicLinearDecoder(channelCount: number): Promise<tf.LayersModel> {
  const cacheKey = `linear-${channelCount}`;
  if (dynamicModelCache.has(cacheKey)) {
    return dynamicModelCache.get(cacheKey)!;
  }

  console.log(`[TFJS-Dynamic] Creating Linear Decoder (${channelCount} channels)...`);
  
  const model = tf.sequential({
    name: `LinearDecoder_${channelCount}ch`,
    layers: [
      tf.layers.dense({
        inputShape: [channelCount],
        units: 2,
        activation: 'linear',
        kernelInitializer: tf.initializers.glorotNormal({ seed: 42 }),
        name: 'output',
      }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
  });

  dynamicModelCache.set(cacheKey, model);
  console.log(`[TFJS-Dynamic] ✓ Linear Decoder (${channelCount}ch) created`);
  return model;
}

/**
 * Create an MLP Decoder with dynamic input shape
 * Hidden layer sizes scale with input channels
 */
export async function createDynamicMLPDecoder(channelCount: number): Promise<tf.LayersModel> {
  const cacheKey = `mlp-${channelCount}`;
  if (dynamicModelCache.has(cacheKey)) {
    return dynamicModelCache.get(cacheKey)!;
  }

  console.log(`[TFJS-Dynamic] Creating MLP Decoder (${channelCount} channels)...`);

  // Scale hidden layer size with channel count
  const hidden1 = Math.min(256, Math.max(32, channelCount));
  const hidden2 = Math.min(128, Math.max(16, Math.floor(channelCount / 2)));

  const model = tf.sequential({
    name: `MLPDecoder_${channelCount}ch`,
    layers: [
      tf.layers.dense({
        inputShape: [channelCount],
        units: hidden1,
        activation: 'relu',
        kernelInitializer: tf.initializers.heNormal({ seed: 123 }),
        name: 'hidden1',
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({
        units: hidden2,
        activation: 'relu',
        kernelInitializer: tf.initializers.heNormal({ seed: 124 }),
        name: 'hidden2',
      }),
      tf.layers.dropout({ rate: 0.1 }),
      tf.layers.dense({
        units: 2,
        activation: 'linear',
        name: 'output',
      }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
  });

  dynamicModelCache.set(cacheKey, model);
  console.log(`[TFJS-Dynamic] ✓ MLP Decoder (${channelCount}ch) created with hidden layers [${hidden1}, ${hidden2}]`);
  return model;
}

/**
 * Create an LSTM Decoder with dynamic input shape
 */
export async function createDynamicLSTMDecoder(
  channelCount: number,
  sequenceLength: number = 10
): Promise<tf.LayersModel> {
  const cacheKey = `lstm-${channelCount}-${sequenceLength}`;
  if (dynamicModelCache.has(cacheKey)) {
    return dynamicModelCache.get(cacheKey)!;
  }

  console.log(`[TFJS-Dynamic] Creating LSTM Decoder (${channelCount} channels, ${sequenceLength} steps)...`);

  const lstmUnits = Math.min(128, Math.max(32, channelCount));

  const model = tf.sequential({
    name: `LSTMDecoder_${channelCount}ch`,
    layers: [
      tf.layers.lstm({
        inputShape: [sequenceLength, channelCount],
        units: lstmUnits,
        returnSequences: false,
        kernelInitializer: tf.initializers.glorotNormal({ seed: 456 }),
        recurrentInitializer: tf.initializers.orthogonal({ seed: 456 }),
        name: 'lstm',
      }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({
        units: Math.floor(lstmUnits / 2),
        activation: 'relu',
        name: 'dense1',
      }),
      tf.layers.dense({
        units: 2,
        activation: 'linear',
        name: 'output',
      }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
  });

  dynamicModelCache.set(cacheKey, model);
  console.log(`[TFJS-Dynamic] ✓ LSTM Decoder (${channelCount}ch) created`);
  return model;
}

/**
 * Create a 1D CNN Decoder with dynamic input shape
 * Good for spatial patterns in EEG
 */
export async function createDynamicCNNDecoder(channelCount: number): Promise<tf.LayersModel> {
  const cacheKey = `cnn1d-${channelCount}`;
  if (dynamicModelCache.has(cacheKey)) {
    return dynamicModelCache.get(cacheKey)!;
  }

  console.log(`[TFJS-Dynamic] Creating CNN Decoder (${channelCount} channels)...`);

  const model = tf.sequential({
    name: `CNNDecoder_${channelCount}ch`,
    layers: [
      // Reshape to [channels, 1] for 1D conv
      tf.layers.reshape({
        inputShape: [channelCount],
        targetShape: [channelCount, 1],
      }),
      tf.layers.conv1d({
        filters: 16,
        kernelSize: 3,
        activation: 'relu',
        padding: 'same',
        name: 'conv1',
      }),
      tf.layers.maxPooling1d({ poolSize: 2 }),
      tf.layers.conv1d({
        filters: 32,
        kernelSize: 3,
        activation: 'relu',
        padding: 'same',
        name: 'conv2',
      }),
      tf.layers.globalAveragePooling1d(),
      tf.layers.dense({
        units: 32,
        activation: 'relu',
        name: 'dense1',
      }),
      tf.layers.dense({
        units: 2,
        activation: 'linear',
        name: 'output',
      }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
  });

  dynamicModelCache.set(cacheKey, model);
  console.log(`[TFJS-Dynamic] ✓ CNN Decoder (${channelCount}ch) created`);
  return model;
}

export type DynamicModelType = 'linear' | 'mlp' | 'lstm' | 'cnn';

/**
 * Get or create a dynamic model by type and channel count
 */
export async function getDynamicDecoder(
  type: DynamicModelType,
  channelCount: number,
  options?: { sequenceLength?: number }
): Promise<tf.LayersModel> {
  switch (type) {
    case 'linear':
      return createDynamicLinearDecoder(channelCount);
    case 'mlp':
      return createDynamicMLPDecoder(channelCount);
    case 'lstm':
      return createDynamicLSTMDecoder(channelCount, options?.sequenceLength ?? 10);
    case 'cnn':
      return createDynamicCNNDecoder(channelCount);
    default:
      throw new Error(`Unknown dynamic model type: ${type}`);
  }
}

/**
 * Clear cached models for a specific channel count (useful when switching streams)
 */
export function clearDynamicModelCache(channelCount?: number): void {
  if (channelCount === undefined) {
    dynamicModelCache.forEach((model) => model.dispose());
    dynamicModelCache.clear();
    console.log('[TFJS-Dynamic] Cleared all cached models');
  } else {
    const keysToDelete: string[] = [];
    dynamicModelCache.forEach((model, key) => {
      if (key.includes(`-${channelCount}`)) {
        model.dispose();
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => dynamicModelCache.delete(key));
    console.log(`[TFJS-Dynamic] Cleared cached models for ${channelCount} channels`);
  }
}

/**
 * Get info about cached models
 */
export function getDynamicModelCacheInfo(): { key: string; params: number }[] {
  const info: { key: string; params: number }[] = [];
  dynamicModelCache.forEach((model, key) => {
    info.push({
      key,
      params: model.countParams(),
    });
  });
  return info;
}

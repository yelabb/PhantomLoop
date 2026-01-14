/**
 * TensorFlow.js Model Factory
 * 
 * Creates neural network decoders programmatically in the browser.
 * No model downloads needed - models are built and initialized on demand.
 * 
 * For production, models can be:
 * 1. Created here with random/pretrained weights
 * 2. Loaded from a remote URL (CDN, PhantomLink backend)
 * 3. Fine-tuned in the browser with user data
 */

import * as tf from '@tensorflow/tfjs';

// Model cache to avoid recreating models
const modelCache = new Map<string, tf.LayersModel>();

// Weight initialization seeds for reproducibility
const WEIGHT_SEEDS: Record<string, number> = {
  'linear': 42,
  'mlp': 123,
  'lstm': 456,
  'attention': 789,
};

/**
 * Create a Linear Decoder (Optimal Linear Estimator - OLE)
 * 
 * Architecture: spikes[142] -> Dense(2) -> velocity[vx, vy]
 * This is the classic linear decoder used in Kalman filters
 */
export async function createLinearDecoder(): Promise<tf.LayersModel> {
  const cacheKey = 'linear';
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }

  console.log('[TFJS] Creating Linear Decoder...');
  
  const model = tf.sequential({
    name: 'LinearDecoder',
    layers: [
      tf.layers.dense({
        inputShape: [142], // 142 neural channels
        units: 2, // vx, vy output
        activation: 'linear',
        kernelInitializer: tf.initializers.glorotNormal({ seed: WEIGHT_SEEDS.linear }),
        name: 'output',
      }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
  });

  modelCache.set(cacheKey, model);
  console.log('[TFJS] ✓ Linear Decoder created');
  return model;
}

/**
 * Create a Multi-Layer Perceptron (MLP) Decoder
 * 
 * Architecture: spikes[142] -> Dense(128, relu) -> Dense(64, relu) -> Dense(2)
 * Non-linear decoder that can capture more complex spike-velocity relationships
 */
export async function createMLPDecoder(): Promise<tf.LayersModel> {
  const cacheKey = 'mlp';
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }

  console.log('[TFJS] Creating MLP Decoder...');

  const model = tf.sequential({
    name: 'MLPDecoder',
    layers: [
      tf.layers.dense({
        inputShape: [142],
        units: 128,
        activation: 'relu',
        kernelInitializer: tf.initializers.heNormal({ seed: WEIGHT_SEEDS.mlp }),
        name: 'hidden1',
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({
        units: 64,
        activation: 'relu',
        kernelInitializer: tf.initializers.heNormal({ seed: WEIGHT_SEEDS.mlp + 1 }),
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

  modelCache.set(cacheKey, model);
  console.log('[TFJS] ✓ MLP Decoder created');
  return model;
}

/**
 * Create an LSTM Decoder
 * 
 * Architecture: spikes[10, 142] -> LSTM(128) -> Dense(64) -> Dense(2)
 * Temporal decoder that uses history of spike patterns
 */
export async function createLSTMDecoder(): Promise<tf.LayersModel> {
  const cacheKey = 'lstm';
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }

  console.log('[TFJS] Creating LSTM Decoder...');

  const model = tf.sequential({
    name: 'LSTMDecoder',
    layers: [
      tf.layers.lstm({
        inputShape: [10, 142], // 10 timesteps, 142 channels
        units: 128,
        returnSequences: false,
        kernelInitializer: tf.initializers.glorotNormal({ seed: WEIGHT_SEEDS.lstm }),
        recurrentInitializer: tf.initializers.orthogonal({ seed: WEIGHT_SEEDS.lstm }),
        name: 'lstm',
      }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({
        units: 64,
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
    optimizer: tf.train.adam(0.0005),
    loss: 'meanSquaredError',
  });

  modelCache.set(cacheKey, model);
  console.log('[TFJS] ✓ LSTM Decoder created');
  return model;
}

/**
 * Create a Bidirectional GRU Decoder with Attention-like pooling
 * 
 * Architecture: spikes[10, 142] -> BiGRU(64) -> GlobalMaxPool -> Dense(2)
 * Efficient temporal decoder using bidirectional processing
 */
export async function createAttentionDecoder(): Promise<tf.LayersModel> {
  const cacheKey = 'attention';
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }

  console.log('[TFJS] Creating Attention Decoder (BiGRU + Pool)...');

  // Use Sequential for simpler architecture
  const model = tf.sequential({
    name: 'AttentionDecoder',
    layers: [
      // Project input to lower dimension first
      tf.layers.dense({
        inputShape: [10, 142],
        units: 64,
        activation: 'relu',
        name: 'projection',
      }),
      // Bidirectional GRU for temporal context
      tf.layers.bidirectional({
        layer: tf.layers.gru({
          units: 32,
          returnSequences: true,
          kernelInitializer: tf.initializers.glorotNormal({ seed: WEIGHT_SEEDS.attention }),
        }) as tf.RNN,
        mergeMode: 'concat',
        name: 'bigru',
      }),
      // Global max pooling (attention-like - focuses on strongest activations)
      tf.layers.globalMaxPooling1d({
        name: 'pool',
      }),
      // Output layer
      tf.layers.dense({
        units: 2,
        activation: 'linear',
        name: 'output',
      }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.0005),
    loss: 'meanSquaredError',
  });

  modelCache.set(cacheKey, model);
  console.log('[TFJS] ✓ Attention Decoder created');
  return model;
}

/**
 * Load a pre-trained model from a remote URL
 * Supports PhantomLink backend, CDN, or any CORS-enabled endpoint
 */
export async function loadRemoteModel(url: string, cacheKey: string): Promise<tf.LayersModel> {
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }

  console.log(`[TFJS] Loading model from: ${url}`);
  
  try {
    const model = await tf.loadLayersModel(url);
    modelCache.set(cacheKey, model);
    console.log(`[TFJS] ✓ Model loaded: ${cacheKey}`);
    return model;
  } catch (error) {
    console.error(`[TFJS] Failed to load model from ${url}:`, error);
    throw error;
  }
}

/**
 * Get a model by type, creating if necessary
 */
export async function getModel(type: 'linear' | 'mlp' | 'lstm' | 'attention'): Promise<tf.LayersModel> {
  switch (type) {
    case 'linear':
      return createLinearDecoder();
    case 'mlp':
      return createMLPDecoder();
    case 'lstm':
      return createLSTMDecoder();
    case 'attention':
      return createAttentionDecoder();
    default:
      throw new Error(`Unknown model type: ${type}`);
  }
}

/**
 * Clear model cache and free memory
 */
export function clearModelCache() {
  for (const model of modelCache.values()) {
    model.dispose();
  }
  modelCache.clear();
  console.log('[TFJS] Model cache cleared');
}

/**
 * Get model info for display
 */
export function getModelInfo(model: tf.LayersModel) {
  return {
    name: model.name,
    layers: model.layers.length,
    params: model.countParams(),
    inputShape: model.inputs[0].shape,
    outputShape: model.outputs[0].shape,
  };
}

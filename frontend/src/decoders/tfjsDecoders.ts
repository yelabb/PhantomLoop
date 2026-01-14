/**
 * TensorFlow.js Decoder Definitions
 * 
 * These decoders use real neural networks built in-browser.
 * No model downloads required - models are created programmatically.
 */

import type { Decoder } from '../types/decoders';

/**
 * Linear Decoder (Optimal Linear Estimator)
 * Classic BCI decoder used in Kalman filters
 */
export const linearDecoder: Decoder = {
  id: 'tfjs-linear',
  name: 'Linear (OLE)',
  type: 'tfjs',
  tfjsModelType: 'linear',
  description: 'Optimal Linear Estimator. Classic BCI decoder, fast but limited.',
  architecture: 'Dense(142 → 2)',
  params: 286, // 142 * 2 + 2
};

/**
 * Multi-Layer Perceptron Decoder
 * Non-linear decoder with hidden layers
 */
export const mlpDecoder: Decoder = {
  id: 'tfjs-mlp',
  name: 'MLP (2-layer)',
  type: 'tfjs',
  tfjsModelType: 'mlp',
  description: 'Multi-layer perceptron. Captures non-linear spike-velocity relationships.',
  architecture: 'Dense(142 → 128 → 64 → 2)',
  params: 26690, // Approximate
};

/**
 * LSTM Decoder
 * Temporal decoder using recurrent neural network
 */
export const lstmDecoder: Decoder = {
  id: 'tfjs-lstm',
  name: 'LSTM (Temporal)',
  type: 'tfjs',
  tfjsModelType: 'lstm',
  description: 'Long Short-Term Memory. Uses 10 timesteps of spike history.',
  architecture: 'LSTM(128) → Dense(64) → Dense(2)',
  params: 147586, // Approximate
};

/**
 * Attention Decoder (BiGRU + Pooling)
 * Bidirectional decoder with attention-like max pooling
 */
export const attentionDecoder: Decoder = {
  id: 'tfjs-attention',
  name: 'BiGRU Attention',
  type: 'tfjs',
  tfjsModelType: 'attention',
  description: 'Bidirectional GRU with max pooling. Fast temporal context.',
  architecture: 'Dense(64) → BiGRU(32×2) → MaxPool → Dense(2)',
  params: 21890, // Approximate
};

/**
 * Kalman-Neural Hybrid Decoder
 * Combines neural network with classical state estimation
 */
export const kalmanNeuralDecoder: Decoder = {
  id: 'tfjs-kalman-neural',
  name: 'Kalman-Neural Hybrid',
  type: 'tfjs',
  tfjsModelType: 'kalman-neural',
  description: 'Fuses MLP prediction with kinematic prior. Robust and smooth.',
  architecture: 'MLP + Kalman Fusion (α=0.6)',
  params: 26690,
};

/**
 * All TensorFlow.js decoders
 */
export const tfjsDecoders: Decoder[] = [
  linearDecoder,
  mlpDecoder,
  lstmDecoder,
  attentionDecoder,
  kalmanNeuralDecoder,
];

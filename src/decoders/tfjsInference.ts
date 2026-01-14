/**
 * TensorFlow.js Inference Engine
 * 
 * Runs neural network inference with proper memory management.
 * Uses tf.tidy() to prevent memory leaks from tensor operations.
 */

import * as tf from '@tensorflow/tfjs';
import type { DecoderInput, DecoderOutput } from '../types/decoders';
import { getModel } from './tfjsModels';

// History buffer for temporal models (LSTM, Attention)
const spikeHistory: number[][] = [];
const MAX_HISTORY = 10;

/**
 * Add spikes to history buffer for temporal models
 */
function updateHistory(spikes: number[]) {
  spikeHistory.push(spikes);
  if (spikeHistory.length > MAX_HISTORY) {
    spikeHistory.shift();
  }
}

/**
 * Get spike history as a 2D array [timesteps, channels]
 */
function getSpikeWindow(): number[][] {
  // Pad with zeros if not enough history
  while (spikeHistory.length < MAX_HISTORY) {
    spikeHistory.unshift(new Array(142).fill(0));
  }
  return spikeHistory.slice(-MAX_HISTORY);
}

/**
 * Run Linear Decoder inference
 * Input: spikes[142] -> Output: [vx, vy]
 */
export async function runLinearDecoder(input: DecoderInput): Promise<DecoderOutput> {
  const startTime = performance.now();
  
  const model = await getModel('linear');
  
  // Run inference with memory management
  const [vx, vy] = tf.tidy(() => {
    const inputTensor = tf.tensor2d([input.spikes], [1, 142]);
    const prediction = model.predict(inputTensor) as tf.Tensor;
    return prediction.dataSync();
  });

  // Integrate velocity to position (simple Euler integration)
  const dt = 0.025; // 25ms at 40Hz
  const x = input.kinematics.x + vx * dt * 100; // Scale factor
  const y = input.kinematics.y + vy * dt * 100;

  const latency = performance.now() - startTime;

  return {
    x,
    y,
    vx: vx * 100,
    vy: vy * 100,
    confidence: 0.7, // Linear decoder has moderate confidence
    latency,
  };
}

/**
 * Run MLP Decoder inference
 * Input: spikes[142] -> Output: [vx, vy]
 */
export async function runMLPDecoder(input: DecoderInput): Promise<DecoderOutput> {
  const startTime = performance.now();
  
  const model = await getModel('mlp');
  
  const [vx, vy] = tf.tidy(() => {
    const inputTensor = tf.tensor2d([input.spikes], [1, 142]);
    const prediction = model.predict(inputTensor) as tf.Tensor;
    return prediction.dataSync();
  });

  const dt = 0.025;
  const x = input.kinematics.x + vx * dt * 100;
  const y = input.kinematics.y + vy * dt * 100;

  const latency = performance.now() - startTime;

  return {
    x,
    y,
    vx: vx * 100,
    vy: vy * 100,
    confidence: 0.8,
    latency,
  };
}

/**
 * Run LSTM Decoder inference
 * Input: spikes[10, 142] -> Output: [vx, vy]
 */
export async function runLSTMDecoder(input: DecoderInput): Promise<DecoderOutput> {
  const startTime = performance.now();
  
  // Update history
  updateHistory(input.spikes);
  const spikeWindow = getSpikeWindow();
  
  const model = await getModel('lstm');
  
  const [vx, vy] = tf.tidy(() => {
    // [batch, timesteps, features] = [1, 10, 142]
    const inputTensor = tf.tensor3d([spikeWindow], [1, 10, 142]);
    const prediction = model.predict(inputTensor) as tf.Tensor;
    return prediction.dataSync();
  });

  const dt = 0.025;
  const x = input.kinematics.x + vx * dt * 100;
  const y = input.kinematics.y + vy * dt * 100;

  const latency = performance.now() - startTime;

  return {
    x,
    y,
    vx: vx * 100,
    vy: vy * 100,
    confidence: 0.85,
    latency,
  };
}

/**
 * Run Attention Decoder inference
 * Input: spikes[10, 142] -> Output: [vx, vy]
 */
export async function runAttentionDecoder(input: DecoderInput): Promise<DecoderOutput> {
  const startTime = performance.now();
  
  // Update history
  updateHistory(input.spikes);
  const spikeWindow = getSpikeWindow();
  
  const model = await getModel('attention');
  
  const [vx, vy] = tf.tidy(() => {
    const inputTensor = tf.tensor3d([spikeWindow], [1, 10, 142]);
    const prediction = model.predict(inputTensor) as tf.Tensor;
    return prediction.dataSync();
  });

  const dt = 0.025;
  const x = input.kinematics.x + vx * dt * 100;
  const y = input.kinematics.y + vy * dt * 100;

  const latency = performance.now() - startTime;

  return {
    x,
    y,
    vx: vx * 100,
    vy: vy * 100,
    confidence: 0.9,
    latency,
  };
}

/**
 * Run Kalman Filter with neural observation model
 * Combines neural network with classical state estimation
 */
export async function runKalmanNeuralDecoder(input: DecoderInput): Promise<DecoderOutput> {
  const startTime = performance.now();
  
  // Get neural prediction
  const neuralPrediction = await runMLPDecoder(input);
  
  // Simple Kalman-like fusion with kinematic prior
  const alpha = 0.6; // Trust neural network 60%
  const x = alpha * neuralPrediction.x + (1 - alpha) * (input.kinematics.x + input.kinematics.vx * 0.025);
  const y = alpha * neuralPrediction.y + (1 - alpha) * (input.kinematics.y + input.kinematics.vy * 0.025);

  const latency = performance.now() - startTime;

  return {
    x,
    y,
    vx: neuralPrediction.vx,
    vy: neuralPrediction.vy,
    confidence: 0.88,
    latency,
  };
}

/**
 * Clear spike history (call when changing sessions)
 */
export function clearHistory() {
  spikeHistory.length = 0;
}

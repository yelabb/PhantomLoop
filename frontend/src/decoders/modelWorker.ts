/**
 * Web Worker for TensorFlow.js Model Creation
 * 
 * Offloads heavy model compilation to a separate thread,
 * keeping the main UI thread responsive.
 */

import * as tf from '@tensorflow/tfjs';

// Weight initialization seeds for reproducibility
const WEIGHT_SEEDS: Record<string, number> = {
  'linear': 42,
  'mlp': 123,
  'lstm': 456,
  'attention': 789,
};

// Store created models
const models = new Map<string, tf.LayersModel>();

/**
 * Initialize TensorFlow backend in worker
 */
async function initBackend(): Promise<string> {
  try {
    await tf.setBackend('webgl');
    await tf.ready();
    return tf.getBackend() || 'cpu';
  } catch {
    await tf.setBackend('cpu');
    await tf.ready();
    return 'cpu';
  }
}

/**
 * Create model based on type
 */
async function createModel(type: string): Promise<{ success: boolean; params?: number; error?: string }> {
  try {
    let model: tf.LayersModel;

    switch (type) {
      case 'linear':
        model = tf.sequential({
          name: 'LinearDecoder',
          layers: [
            tf.layers.dense({
              inputShape: [142],
              units: 2,
              activation: 'linear',
              kernelInitializer: tf.initializers.glorotNormal({ seed: WEIGHT_SEEDS.linear }),
              name: 'output',
            }),
          ],
        });
        break;

      case 'mlp':
        model = tf.sequential({
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
        break;

      case 'lstm':
        model = tf.sequential({
          name: 'LSTMDecoder',
          layers: [
            // Use smaller LSTM to reduce compilation time
            tf.layers.lstm({
              inputShape: [10, 142],
              units: 64, // Reduced from 128
              returnSequences: false,
              kernelInitializer: tf.initializers.glorotNormal({ seed: WEIGHT_SEEDS.lstm }),
              recurrentInitializer: tf.initializers.orthogonal({ seed: WEIGHT_SEEDS.lstm }),
              name: 'lstm',
            }),
            tf.layers.dropout({ rate: 0.2 }),
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
        break;

      case 'attention':
        model = tf.sequential({
          name: 'AttentionDecoder',
          layers: [
            tf.layers.dense({
              inputShape: [10, 142],
              units: 48,
              activation: 'relu',
              name: 'projection',
            }),
            tf.layers.bidirectional({
              layer: tf.layers.gru({
                units: 24,
                returnSequences: true,
                kernelInitializer: tf.initializers.glorotNormal({ seed: WEIGHT_SEEDS.attention }),
              }) as tf.RNN,
              mergeMode: 'concat',
              name: 'bigru',
            }),
            tf.layers.globalMaxPooling1d({
              name: 'pool',
            }),
            tf.layers.dense({
              units: 2,
              activation: 'linear',
              name: 'output',
            }),
          ],
        });
        break;

      default:
        return { success: false, error: `Unknown model type: ${type}` };
    }

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
    });

    const params = model.countParams();
    models.set(type, model);

    return { success: true, params };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Run inference on a model
 */
function runInference(type: string, input: number[] | number[][]): { success: boolean; output?: number[]; error?: string } {
  const model = models.get(type);
  if (!model) {
    return { success: false, error: `Model ${type} not loaded` };
  }

  try {
    const result = tf.tidy(() => {
      let tensor: tf.Tensor;
      
      if (type === 'lstm' || type === 'attention') {
        // Temporal models expect [batch, time, features]
        tensor = tf.tensor3d([input as number[][]], [1, 10, 142]);
      } else {
        // Non-temporal models expect [batch, features]
        tensor = tf.tensor2d([input as number[]], [1, 142]);
      }

      const prediction = model.predict(tensor) as tf.Tensor;
      return Array.from(prediction.dataSync());
    });

    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Handle messages from main thread
self.onmessage = async (event: MessageEvent) => {
  const { id, action, payload } = event.data;

  switch (action) {
    case 'init': {
      const backend = await initBackend();
      self.postMessage({ id, action: 'init', result: { backend } });
      break;
    }

    case 'create': {
      const createResult = await createModel(payload.type);
      self.postMessage({ id, action: 'create', result: createResult });
      break;
    }

    case 'infer': {
      const inferResult = runInference(payload.type, payload.input);
      self.postMessage({ id, action: 'infer', result: inferResult });
      break;
    }

    case 'dispose': {
      const model = models.get(payload.type);
      if (model) {
        model.dispose();
        models.delete(payload.type);
      }
      self.postMessage({ id, action: 'dispose', result: { success: true } });
      break;
    }

    default:
      self.postMessage({ id, action, result: { error: `Unknown action: ${action}` } });
  }
};

// Signal that worker is ready
self.postMessage({ action: 'ready' });

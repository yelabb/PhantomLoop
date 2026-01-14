/**
 * TensorFlow.js Worker Manager
 * 
 * Manages communication with the Web Worker for model operations.
 * Keeps the main thread responsive during heavy model compilation.
 */

type WorkerMessage = {
  id: number;
  action: string;
  result: unknown;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

class TFWorkerManager {
  private worker: Worker | null = null;
  private ready = false;
  private readyPromise: Promise<void> | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private loadedModels = new Set<string>();
  private backend: string = 'unknown';

  /**
   * Initialize the worker
   */
  async init(): Promise<string> {
    if (this.ready) return this.backend;
    if (this.readyPromise) return this.readyPromise.then(() => this.backend);

    this.readyPromise = new Promise((resolve, reject) => {
      try {
        // Create worker from module
        this.worker = new Worker(
          new URL('./modelWorker.ts', import.meta.url),
          { type: 'module' }
        );

        // Handle messages from worker
        this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
          const { id, action, result } = event.data;

          // Handle ready signal
          if (action === 'ready') {
            // Initialize TF backend in worker
            this.sendMessage('init', {}).then((res) => {
              const typedResult = res as { backend: string };
              this.backend = typedResult.backend;
              this.ready = true;
              console.log(`[TFJS Worker] Ready with backend: ${this.backend}`);
              resolve();
            });
            return;
          }

          // Handle responses to requests
          const pending = this.pendingRequests.get(id);
          if (pending) {
            this.pendingRequests.delete(id);
            pending.resolve(result);
          }
        };

        this.worker.onerror = (error) => {
          console.error('[TFJS Worker] Error:', error);
          reject(error);
        };

        // Timeout for initialization
        setTimeout(() => {
          if (!this.ready) {
            reject(new Error('Worker initialization timeout'));
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });

    await this.readyPromise;
    return this.backend;
  }

  /**
   * Send a message to the worker
   */
  private sendMessage(action: string, payload: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = ++this.messageId;
      this.pendingRequests.set(id, { resolve, reject });

      this.worker.postMessage({ id, action, payload });

      // Timeout for individual requests
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Worker request timeout for action: ${action}`));
        }
      }, 30000);
    });
  }

  /**
   * Create/load a model in the worker
   */
  async createModel(type: string): Promise<{ params: number }> {
    if (!this.ready) await this.init();

    if (this.loadedModels.has(type)) {
      console.log(`[TFJS Worker] Model ${type} already loaded`);
      return { params: 0 };
    }

    console.log(`[TFJS Worker] Creating ${type} model...`);
    const result = await this.sendMessage('create', { type }) as { 
      success: boolean; 
      params?: number; 
      error?: string;
    };

    if (!result.success) {
      throw new Error(result.error || 'Failed to create model');
    }

    this.loadedModels.add(type);
    console.log(`[TFJS Worker] ✓ ${type} model created (${result.params?.toLocaleString()} params)`);
    return { params: result.params || 0 };
  }

  /**
   * Run inference on a model
   */
  async infer(type: string, input: number[] | number[][]): Promise<number[]> {
    if (!this.ready) await this.init();

    if (!this.loadedModels.has(type)) {
      await this.createModel(type);
    }

    const result = await this.sendMessage('infer', { type, input }) as {
      success: boolean;
      output?: number[];
      error?: string;
    };

    if (!result.success) {
      throw new Error(result.error || 'Inference failed');
    }

    return result.output || [0, 0];
  }

  /**
   * Dispose a model
   */
  async disposeModel(type: string): Promise<void> {
    if (!this.worker || !this.loadedModels.has(type)) return;

    await this.sendMessage('dispose', { type });
    this.loadedModels.delete(type);
    console.log(`[TFJS Worker] Model ${type} disposed`);
  }

  /**
   * Check if a model is loaded
   */
  isModelLoaded(type: string): boolean {
    return this.loadedModels.has(type);
  }

  /**
   * Get the current backend
   */
  getBackend(): string {
    return this.backend;
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.ready = false;
      this.loadedModels.clear();
      this.pendingRequests.clear();
    }
  }
}

// Singleton instance
export const tfWorker = new TFWorkerManager();

// Map model architecture to worker model types
export function getWorkerModelType(architecture?: string): string | null {
  switch (architecture) {
    case 'linear':
      return 'linear';
    case 'mlp':
      return 'mlp';
    case 'lstm':
      return 'lstm';
    case 'bigru':
    case 'attention':
      return 'attention';
    default:
      return null;
  }
}

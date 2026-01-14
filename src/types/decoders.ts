// Decoder types for BCI algorithm integration

export type DecoderType = 'javascript' | 'tfjs' | 'wasm';

export type TFJSModelType = 'linear' | 'mlp' | 'lstm' | 'attention' | 'kalman-neural';

/**
 * Decoder source - where the model comes from
 */
export type DecoderSource = 
  | { type: 'builtin'; modelType: TFJSModelType }  // Built programmatically
  | { type: 'url'; url: string }                    // Load from remote URL
  | { type: 'local'; path: string }                 // Load from /models/ folder
  | { type: 'custom'; execute: DecoderFunction };   // User-provided function

/**
 * Custom decoder function signature
 * Takes spike data, returns velocity prediction
 */
export type DecoderFunction = (
  input: DecoderInput
) => DecoderOutput | Promise<DecoderOutput>;

export interface Decoder {
  id: string;
  name: string;
  type: DecoderType;
  description?: string;
  
  // Source configuration (new flexible system)
  source?: DecoderSource;
  
  // For JavaScript decoders (legacy, use source.type='custom' instead)
  code?: string;
  
  // For TensorFlow.js decoders (legacy, use source instead)
  modelUrl?: string; // Remote URL (optional - models can be created in-browser)
  tfjsModelType?: TFJSModelType; // Built-in model type
  
  // Architecture info for display
  architecture?: string;
  params?: number;
  
  // Input/output shape (for validation)
  inputShape?: number[];
  outputShape?: number[];
  
  // Performance metrics
  avgLatency?: number;
  lastLatency?: number;
}

export interface DecoderOutput {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  confidence?: number;
  latency: number;
}

export interface DecoderInput {
  spikes: number[];
  kinematics: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };
  history?: DecoderOutput[];
}

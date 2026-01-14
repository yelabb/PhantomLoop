// Decoder types for BCI algorithm integration

export type DecoderType = 'javascript' | 'tfjs' | 'wasm';

export type TFJSModelType = 'linear' | 'mlp' | 'lstm' | 'attention' | 'kalman-neural';

export interface Decoder {
  id: string;
  name: string;
  type: DecoderType;
  description?: string;
  
  // For JavaScript decoders
  code?: string;
  
  // For TensorFlow.js decoders
  modelUrl?: string; // Remote URL (optional - models can be created in-browser)
  tfjsModelType?: TFJSModelType; // Built-in model type
  
  // Architecture info for display
  architecture?: string;
  params?: number;
  
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

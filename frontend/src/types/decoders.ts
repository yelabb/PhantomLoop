// Decoder types for BCI algorithm integration

export type DecoderType = 'javascript' | 'tfjs' | 'wasm';

export interface Decoder {
  id: string;
  name: string;
  type: DecoderType;
  description?: string;
  
  // For JavaScript decoders
  code?: string;
  
  // For TensorFlow.js decoders
  modelUrl?: string;
  
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

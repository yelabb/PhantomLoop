// Application state types

import type { DecoderOutput, Decoder } from './decoders';
import type { StreamPacket } from './packets';

export interface ConnectionState {
  websocket: WebSocket | null;
  isConnected: boolean;
  sessionCode: string | null;
  connectionError: string | null;
}

export interface StreamState {
  currentPacket: StreamPacket | null;
  packetBuffer: StreamPacket[];
  packetsReceived: number;
  lastPacketTime: number;
}

export interface DecoderState {
  activeDecoder: Decoder | null;
  decoderOutput: DecoderOutput | null;
  availableDecoders: Decoder[];
  isProcessing: boolean;
}

export interface VisualizationSettings {
  showPhantom: boolean;
  showBioLink: boolean;
  showLoopBack: boolean;
  showTrails: boolean;
  showTarget: boolean;
  showGrid: boolean;
  cameraMode: 'top' | 'perspective' | 'side';
  trailLength: number;
}

export interface PerformanceMetrics {
  fps: number;
  networkLatency: number;
  decoderLatency: number;
  totalLatency: number;
  desyncDetected: boolean;
  droppedPackets: number;
  totalPacketsReceived: number;
}

export interface AppState {
  connection: ConnectionState;
  stream: StreamState;
  decoder: DecoderState;
  visualization: VisualizationSettings;
  metrics: PerformanceMetrics;
}

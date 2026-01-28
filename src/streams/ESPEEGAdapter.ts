/**
 * ESP-EEG Stream Adapter
 * 
 * Adapts the Cerelog ESP-EEG device (via WebSocket bridge) to the
 * stream-agnostic StreamSource interface.
 */

import type {
  StreamSource,
  StreamConfig,
  StreamSample,
  StreamConnectionState,
  ChannelQuality,
} from '../types/stream';
import {
  CERELOG_PROTOCOL,
  parsePacket,
  estimateQualityFromSignal,
} from '../hooks/useESPEEG';

// Standard 10-20 labels for 8-channel ESP-EEG
const DEFAULT_CHANNEL_LABELS = ['Fp1', 'Fp2', 'C3', 'Cz', 'C4', 'P3', 'Pz', 'P4'];

// Standard 10-20 positions (normalized)
const DEFAULT_CHANNEL_POSITIONS = [
  { x: -0.309, y: 0.951, z: 0.0 },  // Fp1
  { x: 0.309, y: 0.951, z: 0.0 },   // Fp2
  { x: -0.707, y: 0.0, z: 0.707 },  // C3
  { x: 0.0, y: 0.0, z: 1.0 },       // Cz
  { x: 0.707, y: 0.0, z: 0.707 },   // C4
  { x: -0.545, y: -0.673, z: 0.5 }, // P3
  { x: 0.0, y: -0.719, z: 0.695 },  // Pz
  { x: 0.545, y: -0.673, z: 0.5 },  // P4
];

export interface ESPEEGAdapterOptions {
  channelLabels?: string[];
  bridgeUrl?: string;
}

export class ESPEEGAdapter implements StreamSource {
  readonly config: StreamConfig;

  private _state: StreamConnectionState = 'disconnected';
  private _lastError: string | null = null;
  private ws: WebSocket | null = null;
  private sampleCallbacks: ((sample: StreamSample) => void)[] = [];
  private stateCallbacks: ((state: StreamConnectionState) => void)[] = [];
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private url: string = '';
  
  // For quality estimation
  private channelBuffers: number[][] = Array.from({ length: 8 }, () => []);
  private readonly BUFFER_SIZE = 50; // ~200ms at 250 SPS

  constructor(options?: ESPEEGAdapterOptions) {
    this.config = {
      id: 'esp-eeg',
      name: 'Cerelog ESP-EEG',
      channelCount: CERELOG_PROTOCOL.NUM_CHANNELS,
      samplingRate: CERELOG_PROTOCOL.SAMPLING_RATE,
      dataType: 'continuous',
      unit: 'µV',
      channelLabels: options?.channelLabels ?? DEFAULT_CHANNEL_LABELS,
      channelPositions: DEFAULT_CHANNEL_POSITIONS,
      hasGroundTruth: false, // No cursor task for EEG
      sourceInfo: {
        deviceType: 'esp-eeg',
        protocol: 'tcp-websocket-bridge',
        chip: 'ADS1299',
        wifiSSID: CERELOG_PROTOCOL.WIFI_SSID,
        deviceIP: CERELOG_PROTOCOL.DEVICE_IP,
        tcpPort: CERELOG_PROTOCOL.TCP_PORT,
      },
    };
  }

  get state(): StreamConnectionState {
    return this._state;
  }

  get lastError(): string | null {
    return this._lastError;
  }

  private setState(state: StreamConnectionState, error?: string) {
    this._state = state;
    this._lastError = error ?? null;
    this.stateCallbacks.forEach(cb => cb(state));
  }

  async connect(url?: string): Promise<void> {
    if (this.ws) {
      this.disconnect();
    }

    this.url = url ?? 'ws://localhost:8765';
    this.setState('connecting');

    // Clear channel buffers
    this.channelBuffers = Array.from({ length: 8 }, () => []);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          console.log('[ESPEEGAdapter] Connected to bridge at', this.url);
          this.setState('connected');
          
          // Request connection to ESP-EEG device via bridge
          try {
            this.ws?.send(JSON.stringify({
              command: 'connect',
              deviceIp: CERELOG_PROTOCOL.DEVICE_IP,
              port: CERELOG_PROTOCOL.TCP_PORT,
            }));
          } catch {
            // Bridge may not require explicit connect
          }
          
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(event);
        };

        this.ws.onerror = (event) => {
          console.error('[ESPEEGAdapter] WebSocket error:', event);
          this.setState('error', 'WebSocket bridge error - is cerelog_ws_bridge.py running?');
          reject(new Error('WebSocket bridge error'));
        };

        this.ws.onclose = (event) => {
          console.log('[ESPEEGAdapter] Connection closed:', event.code);
          if (this._state !== 'disconnected') {
            this.setState('reconnecting');
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        this.setState('error', error instanceof Error ? error.message : 'Connection failed');
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      try {
        this.ws.send(JSON.stringify({ command: 'disconnect' }));
      } catch {
        // Ignore send errors on close
      }
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
    console.log('[ESPEEGAdapter] Disconnected');
  }

  onSample(callback: (sample: StreamSample) => void): () => void {
    this.sampleCallbacks.push(callback);
    return () => {
      const index = this.sampleCallbacks.indexOf(callback);
      if (index > -1) {
        this.sampleCallbacks.splice(index, 1);
      }
    };
  }

  onStateChange(callback: (state: StreamConnectionState) => void): () => void {
    this.stateCallbacks.push(callback);
    return () => {
      const index = this.stateCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateCallbacks.splice(index, 1);
      }
    };
  }

  private handleMessage(event: MessageEvent): void {
    // Handle binary packets from bridge
    if (event.data instanceof ArrayBuffer) {
      this.processBinaryPacket(new Uint8Array(event.data));
      return;
    }

    // Handle JSON messages (status, etc.)
    if (typeof event.data === 'string') {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'sample' && Array.isArray(msg.channels)) {
          // JSON sample format from bridge
          const sample = this.createSample(msg.timestamp ?? Date.now(), msg.channels);
          this.sampleCallbacks.forEach(cb => cb(sample));
        } else if (msg.type === 'status') {
          if (msg.error) {
            this.setState('error', msg.error);
          }
        }
      } catch {
        // Not JSON, ignore
      }
    }
  }

  private processBinaryPacket(data: Uint8Array): void {
    const packetSize = CERELOG_PROTOCOL.PACKET_SIZE;
    const packetCount = Math.floor(data.length / packetSize);

    for (let i = 0; i < packetCount; i++) {
      const packetData = data.slice(i * packetSize, (i + 1) * packetSize);
      const parsed = parsePacket(packetData);

      if (parsed) {
        const sample = this.createSample(parsed.timestamp, parsed.channels);
        this.sampleCallbacks.forEach(cb => cb(sample));
      }
    }
  }

  private createSample(timestamp: number, channels: number[]): StreamSample {
    // Update channel buffers for quality estimation
    for (let ch = 0; ch < channels.length && ch < 8; ch++) {
      this.channelBuffers[ch].push(channels[ch]);
      if (this.channelBuffers[ch].length > this.BUFFER_SIZE) {
        this.channelBuffers[ch].shift();
      }
    }

    // Estimate quality for each channel
    const quality = this.estimateChannelQualities();

    return {
      timestamp,
      channels,
      metadata: {
        unit: 'µV',
        quality,
      },
    };
  }

  private estimateChannelQualities(): ChannelQuality[] {
    return this.channelBuffers.map(buffer => {
      if (buffer.length < 10) {
        return 'disconnected';
      }

      const mean = buffer.reduce((a, b) => a + b, 0) / buffer.length;
      const variance = buffer.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / buffer.length;
      const std = Math.sqrt(variance);
      const min = Math.min(...buffer);
      const max = Math.max(...buffer);
      const peakToPeak = max - min;

      return estimateQualityFromSignal({ std, peakToPeak });
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (this._state === 'reconnecting') {
        console.log('[ESPEEGAdapter] Attempting reconnect...');
        this.connect(this.url).catch(() => {
          // Will trigger another reconnect via onclose
        });
      }
    }, 3000);
  }
}

/**
 * Factory function for adapter registry
 */
export function createESPEEGAdapter(options?: ESPEEGAdapterOptions): StreamSource {
  return new ESPEEGAdapter(options);
}

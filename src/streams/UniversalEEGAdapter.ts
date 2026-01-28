/**
 * Universal EEG Adapter
 * 
 * A flexible stream adapter that can work with multiple EEG hardware devices
 * by using device profiles to configure parsing, scaling, and connection handling.
 * 
 * Supports:
 * - OpenBCI (Cyton, Ganglion, Cyton+Daisy) via serial or WiFi
 * - NeuroSky MindWave via Bluetooth
 * - Muse (2, S) via BLE
 * - Emotiv (Insight, EPOC X) via BLE
 * - Cerelog ESP-EEG via WebSocket bridge
 * - Any Brainflow-compatible device
 */

import type {
  StreamSource,
  StreamConfig,
  StreamSample,
  StreamConnectionState,
  ChannelQuality,
} from '../types/stream';
import {
  getDeviceProfile,
  type DeviceProfile,
} from '../devices/deviceProfiles';

// Signal quality thresholds (µV) - universal across devices
export const SIGNAL_THRESHOLDS = {
  NOISE_FLOOR_UV: 5,      // Below = no signal (disconnected)
  GOOD_MAX_UV: 100,       // Normal EEG range (good contact)
  FAIR_MAX_UV: 200,       // Slightly elevated noise
  POOR_MAX_UV: 500,       // High noise/poor contact
};

export interface UniversalEEGAdapterOptions {
  deviceId: string;                    // Device profile ID (e.g., 'openbci-cyton')
  channelLabels?: string[];            // Override default channel labels
  bridgeUrl?: string;                  // WebSocket bridge URL
  serialPort?: string;                 // Serial port for USB devices
  macAddress?: string;                 // Bluetooth MAC address
}

export interface ChannelStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  peakToPeak: number;
  quality: ChannelQuality;
  estimatedImpedance: number; // Pseudo-impedance for UI (kΩ)
}

/**
 * Estimate signal quality from amplitude statistics
 */
export function estimateQualityFromSignal(std: number): { quality: ChannelQuality; pseudoImpedance: number } {
  if (std < SIGNAL_THRESHOLDS.NOISE_FLOOR_UV) {
    return { quality: 'disconnected', pseudoImpedance: 999 };
  } else if (std <= SIGNAL_THRESHOLDS.GOOD_MAX_UV) {
    // Good signal: estimate low impedance (1-5 kΩ)
    const impedance = 1 + (std / SIGNAL_THRESHOLDS.GOOD_MAX_UV) * 4;
    return { quality: 'good', pseudoImpedance: impedance };
  } else if (std <= SIGNAL_THRESHOLDS.FAIR_MAX_UV) {
    // Fair signal: moderate impedance (5-15 kΩ)
    const normalized = (std - SIGNAL_THRESHOLDS.GOOD_MAX_UV) / 
                      (SIGNAL_THRESHOLDS.FAIR_MAX_UV - SIGNAL_THRESHOLDS.GOOD_MAX_UV);
    return { quality: 'fair', pseudoImpedance: 5 + normalized * 10 };
  } else if (std <= SIGNAL_THRESHOLDS.POOR_MAX_UV) {
    // Poor signal: high impedance (15-50 kΩ)
    const normalized = (std - SIGNAL_THRESHOLDS.FAIR_MAX_UV) / 
                      (SIGNAL_THRESHOLDS.POOR_MAX_UV - SIGNAL_THRESHOLDS.FAIR_MAX_UV);
    return { quality: 'poor', pseudoImpedance: 15 + normalized * 35 };
  } else {
    // Saturated or open circuit
    return { quality: 'disconnected', pseudoImpedance: 999 };
  }
}

/**
 * Parse ADS1299 24-bit signed value to µV (OpenBCI, Cerelog)
 */
export function parseADS1299ToMicrovolts(
  bytes: Uint8Array, 
  offset: number, 
  vref = 4.5, 
  gain = 24
): number {
  // 24-bit big-endian signed integer
  let value = (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
  
  // Sign extend 24-bit to 32-bit
  if (value & 0x800000) {
    value = value - 0x1000000;
  }
  
  // Convert to µV
  const scaleFactor = (2 * vref / gain) / Math.pow(2, 24);
  return value * scaleFactor * 1e6;
}

/**
 * Parse Cerelog ESP-EEG binary packet
 */
function parseCerelogPacket(data: Uint8Array): { timestamp: number; channels: number[] } | null {
  const PACKET_SIZE = 37;
  const START_MARKER = 0xABCD;
  const END_MARKER = 0xDCBA;
  
  if (data.length !== PACKET_SIZE) return null;
  
  const startMarker = (data[0] << 8) | data[1];
  if (startMarker !== START_MARKER) return null;
  
  const endMarker = (data[35] << 8) | data[36];
  if (endMarker !== END_MARKER) return null;
  
  // Verify checksum
  let checksum = 0;
  for (let i = 2; i < 34; i++) {
    checksum = (checksum + data[i]) & 0xFF;
  }
  if (checksum !== data[34]) return null;
  
  const timestamp = (data[3] << 24) | (data[4] << 16) | (data[5] << 8) | data[6];
  
  const channels: number[] = [];
  for (let ch = 0; ch < 8; ch++) {
    const offset = 10 + (ch * 3);
    channels.push(parseADS1299ToMicrovolts(data, offset, 4.5, 24));
  }
  
  return { timestamp, channels };
}

/**
 * Universal EEG Adapter
 */
export class UniversalEEGAdapter implements StreamSource {
  readonly config: StreamConfig;
  readonly deviceProfile: DeviceProfile;

  private _state: StreamConnectionState = 'disconnected';
  private _lastError: string | null = null;
  private ws: WebSocket | null = null;
  private sampleCallbacks: ((sample: StreamSample) => void)[] = [];
  private stateCallbacks: ((state: StreamConnectionState) => void)[] = [];
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private url: string = '';
  
  // For quality estimation
  private channelBuffers: number[][];
  private readonly BUFFER_SIZE = 50;

  constructor(options: UniversalEEGAdapterOptions) {
    const profile = getDeviceProfile(options.deviceId);
    if (!profile) {
      throw new Error(`Unknown device profile: ${options.deviceId}`);
    }
    
    this.deviceProfile = profile;
    this.channelBuffers = Array.from({ length: profile.channelCount }, () => []);
    
    const channelLabels = options.channelLabels ?? 
      profile.defaultMontage?.labels ?? 
      Array.from({ length: profile.channelCount }, (_, i) => `Ch${i + 1}`);
    
    this.config = {
      id: profile.id,
      name: profile.name,
      channelCount: profile.channelCount,
      samplingRate: profile.defaultSamplingRate,
      dataType: 'continuous',
      unit: 'µV',
      channelLabels,
      channelPositions: profile.defaultMontage?.positions,
      hasGroundTruth: false,
      sourceInfo: {
        deviceType: profile.id,
        manufacturer: profile.manufacturer,
        protocol: profile.defaultProtocol,
        resolution: profile.resolution,
        adcChip: profile.adcChip,
        brainflowBoardId: profile.brainflowBoardId,
        capabilities: profile.capabilities,
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

    // Determine connection URL based on device type
    this.url = url ?? this.getDefaultUrl();
    this.setState('connecting');
    this.channelBuffers = Array.from({ length: this.deviceProfile.channelCount }, () => []);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          console.log(`[UniversalEEGAdapter] Connected to ${this.deviceProfile.name} at`, this.url);
          this.setState('connected');
          this.sendDeviceConfig();
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(event);
        };

        this.ws.onerror = (event) => {
          console.error('[UniversalEEGAdapter] WebSocket error:', event);
          this.setState('error', `Connection error - check bridge/device status`);
          reject(new Error('WebSocket connection error'));
        };

        this.ws.onclose = () => {
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
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
  }

  onSample(callback: (sample: StreamSample) => void): () => void {
    this.sampleCallbacks.push(callback);
    return () => {
      const idx = this.sampleCallbacks.indexOf(callback);
      if (idx >= 0) this.sampleCallbacks.splice(idx, 1);
    };
  }

  onStateChange(callback: (state: StreamConnectionState) => void): () => void {
    this.stateCallbacks.push(callback);
    return () => {
      const idx = this.stateCallbacks.indexOf(callback);
      if (idx >= 0) this.stateCallbacks.splice(idx, 1);
    };
  }

  private getDefaultUrl(): string {
    // Different default URLs based on device type
    switch (this.deviceProfile.defaultProtocol) {
      case 'wifi-websocket':
        return 'ws://localhost:8765';
      case 'serial':
        return 'ws://localhost:8766'; // Serial-to-WS bridge
      case 'ble':
        return 'ws://localhost:8767'; // BLE-to-WS bridge
      default:
        return 'ws://localhost:8765';
    }
  }

  private sendDeviceConfig(): void {
    // Send device configuration to bridge if needed
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          command: 'configure',
          device: this.deviceProfile.id,
          channelCount: this.deviceProfile.channelCount,
          samplingRate: this.deviceProfile.defaultSamplingRate,
          ...(this.deviceProfile.protocolConfig || {}),
        }));
      } catch {
        // Bridge may not require explicit configuration
      }
    }
  }

  private handleMessage(event: MessageEvent): void {
    if (event.data instanceof ArrayBuffer) {
      this.handleBinaryMessage(new Uint8Array(event.data));
    } else if (typeof event.data === 'string') {
      this.handleTextMessage(event.data);
    }
  }

  private handleBinaryMessage(data: Uint8Array): void {
    let sample: StreamSample | null = null;

    // Parse based on device type
    switch (this.deviceProfile.id) {
      case 'cerelog-esp-eeg': {
        const parsed = parseCerelogPacket(data);
        if (parsed) {
          sample = {
            timestamp: parsed.timestamp,
            channels: parsed.channels,
            metadata: { unit: 'µV' },
          };
        }
        break;
      }
      
      case 'openbci-cyton':
      case 'openbci-cyton-daisy':
      case 'openbci-ganglion': {
        // OpenBCI packets (via bridge that handles framing)
        sample = this.parseOpenBCIPacket(data);
        break;
      }
      
      default: {
        // Generic parsing - assume simple float array
        sample = this.parseGenericPacket(data);
      }
    }

    if (sample) {
      this.updateQuality(sample.channels);
      this.emitSample(sample);
    }
  }

  private handleTextMessage(data: string): void {
    try {
      const msg = JSON.parse(data);
      
      // Handle JSON-encoded samples (common for Muse, NeuroSky via bridges)
      if (msg.channels && Array.isArray(msg.channels)) {
        const sample: StreamSample = {
          timestamp: msg.timestamp ?? Date.now(),
          channels: msg.channels,
          metadata: {
            unit: 'µV',
            quality: msg.quality,
          },
        };
        this.updateQuality(sample.channels);
        this.emitSample(sample);
      }
      
      // Handle status messages
      if (msg.status) {
        console.log(`[UniversalEEGAdapter] Status:`, msg.status);
      }
    } catch {
      // Not JSON, ignore
    }
  }

  private parseOpenBCIPacket(data: Uint8Array): StreamSample | null {
    // OpenBCI packet format varies by device
    // This handles Cyton 8-channel format via bridge
    if (data.length < 33) return null;
    
    const channels: number[] = [];
    const channelCount = this.deviceProfile.channelCount;
    const vref = this.deviceProfile.vref ?? 4.5;
    const gain = this.deviceProfile.gain ?? 24;
    
    for (let ch = 0; ch < channelCount && (2 + ch * 3) < data.length; ch++) {
      const offset = 2 + ch * 3;
      channels.push(parseADS1299ToMicrovolts(data, offset, vref, gain));
    }
    
    return {
      timestamp: Date.now(),
      channels,
      metadata: { unit: 'µV' },
    };
  }

  private parseGenericPacket(data: Uint8Array): StreamSample | null {
    // Try to interpret as float32 array
    if (data.length % 4 !== 0) return null;
    
    const floatView = new Float32Array(data.buffer);
    const channels = Array.from(floatView).slice(0, this.deviceProfile.channelCount);
    
    return {
      timestamp: Date.now(),
      channels,
      metadata: { unit: 'µV' },
    };
  }

  private updateQuality(channels: number[]): void {
    channels.forEach((value, i) => {
      if (i < this.channelBuffers.length) {
        this.channelBuffers[i].push(value);
        if (this.channelBuffers[i].length > this.BUFFER_SIZE) {
          this.channelBuffers[i].shift();
        }
      }
    });
  }

  private emitSample(sample: StreamSample): void {
    this.sampleCallbacks.forEach(cb => cb(sample));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (this._state === 'reconnecting') {
        this.connect(this.url).catch(() => {
          this.scheduleReconnect();
        });
      }
    }, 3000);
  }

  /**
   * Get channel statistics for quality monitoring
   */
  getChannelStats(): ChannelStats[] {
    return this.channelBuffers.map((buffer) => {
      if (buffer.length < 10) {
        return {
          mean: 0,
          std: 0,
          min: 0,
          max: 0,
          peakToPeak: 0,
          quality: 'disconnected' as ChannelQuality,
          estimatedImpedance: 999,
        };
      }
      
      const mean = buffer.reduce((a, b) => a + b, 0) / buffer.length;
      const variance = buffer.reduce((sum, v) => sum + (v - mean) ** 2, 0) / buffer.length;
      const std = Math.sqrt(variance);
      const min = Math.min(...buffer);
      const max = Math.max(...buffer);
      
      const { quality, pseudoImpedance } = estimateQualityFromSignal(std);
      
      return {
        mean,
        std,
        min,
        max,
        peakToPeak: max - min,
        quality,
        estimatedImpedance: pseudoImpedance,
      };
    });
  }
}

/**
 * Factory function for creating Universal EEG adapters
 */
export function createUniversalEEGAdapter(
  options: UniversalEEGAdapterOptions
): UniversalEEGAdapter {
  return new UniversalEEGAdapter(options);
}

/**
 * Create adapter from device profile ID (convenience function)
 */
export function createAdapterForDevice(
  deviceId: string, 
  bridgeUrl?: string
): UniversalEEGAdapter {
  return new UniversalEEGAdapter({ deviceId, bridgeUrl });
}

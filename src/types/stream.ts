/**
 * Stream-Agnostic Neural Data Interface
 * 
 * Defines universal types for any multichannel time-series stream.
 * Supports EEG, spike data, simulated signals, or any biosignal source.
 */

import type { Position3D } from './electrodes';

/**
 * Data type classification for signal processing hints
 */
export type StreamDataType = 
  | 'continuous'    // Raw analog signals (EEG, EMG, ECG)
  | 'binned'        // Pre-processed spike counts
  | 'events';       // Discrete events/markers

/**
 * Unit of measurement for channel values
 */
export type StreamUnit = 'µV' | 'mV' | 'spikes' | 'au' | 'normalized';

/**
 * Signal quality indicator per channel
 */
export type ChannelQuality = 'good' | 'fair' | 'poor' | 'disconnected';

/**
 * Universal sample from any neural/biosignal stream
 */
export interface StreamSample {
  /** Timestamp in milliseconds since stream start */
  timestamp: number;
  
  /** Channel values (length = channelCount from StreamConfig) */
  channels: number[];
  
  /** Optional per-sample metadata */
  metadata?: {
    /** Unit of measurement */
    unit?: StreamUnit;
    /** Per-channel quality indicators */
    quality?: ChannelQuality[];
    /** Sequence number for ordering/gap detection */
    sequenceNumber?: number;
    /** Source-specific status flags */
    status?: number;
  };
}

/**
 * Optional ground truth data for supervised tasks
 * (e.g., cursor position in center-out task)
 */
export interface GroundTruth {
  /** Position (cursor, limb, etc.) */
  position?: { x: number; y: number; z?: number };
  /** Velocity */
  velocity?: { x: number; y: number; z?: number };
  /** Target information */
  target?: {
    id: number;
    x: number;
    y: number;
    active: boolean;
  };
  /** Trial/epoch information */
  trial?: {
    id: number;
    timeMs: number;
  };
}

/**
 * Stream configuration - describes the data source
 */
export interface StreamConfig {
  /** Unique identifier for this stream type */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Number of data channels */
  channelCount: number;
  
  /** Sampling rate in Hz */
  samplingRate: number;
  
  /** Type of data */
  dataType: StreamDataType;
  
  /** Default unit for channel values */
  unit: StreamUnit;
  
  /** Optional channel labels (e.g., '10-20' electrode names) */
  channelLabels?: string[];
  
  /** Optional 3D positions for spatial features */
  channelPositions?: Position3D[];
  
  /** Whether this source provides ground truth */
  hasGroundTruth: boolean;
  
  /** Source-specific metadata */
  sourceInfo?: {
    deviceType?: string;
    protocol?: string;
    firmwareVersion?: string;
    [key: string]: unknown;
  };
}

/**
 * Connection state for stream sources
 */
export type StreamConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'reconnecting';

/**
 * Stream source interface - implemented by all adapters
 */
export interface StreamSource {
  /** Stream configuration (static metadata) */
  readonly config: StreamConfig;
  
  /** Current connection state */
  readonly state: StreamConnectionState;
  
  /** Last error message if state is 'error' */
  readonly lastError: string | null;
  
  /** Connect to the data source */
  connect(url?: string): Promise<void>;
  
  /** Disconnect from the data source */
  disconnect(): void;
  
  /** Register sample callback (called on each new sample) */
  onSample(callback: (sample: StreamSample, groundTruth?: GroundTruth) => void): () => void;
  
  /** Register state change callback */
  onStateChange(callback: (state: StreamConnectionState) => void): () => void;
}

/**
 * Stream adapter factory function signature
 */
export type StreamAdapterFactory = (options?: Record<string, unknown>) => StreamSource;

/**
 * Registry of available stream adapters
 */
export interface StreamAdapterRegistry {
  [adapterId: string]: {
    name: string;
    description: string;
    factory: StreamAdapterFactory;
    defaultUrl?: string;
  };
}

/**
 * Extended sample with ground truth (for decoder input)
 */
export interface StreamFrame {
  sample: StreamSample;
  groundTruth?: GroundTruth;
  config: StreamConfig;
}

/**
 * Buffer of recent samples for temporal analysis
 */
export interface StreamBuffer {
  samples: StreamSample[];
  maxSize: number;
  
  /** Add sample to buffer (FIFO) */
  push(sample: StreamSample): void;
  
  /** Get last N samples */
  getLast(n: number): StreamSample[];
  
  /** Get samples in time window (ms) */
  getWindow(durationMs: number): StreamSample[];
  
  /** Clear buffer */
  clear(): void;
}

/**
 * Create a circular buffer for stream samples
 */
export function createStreamBuffer(maxSize: number): StreamBuffer {
  const samples: StreamSample[] = [];
  
  return {
    samples,
    maxSize,
    
    push(sample: StreamSample) {
      samples.push(sample);
      if (samples.length > maxSize) {
        samples.shift();
      }
    },
    
    getLast(n: number): StreamSample[] {
      return samples.slice(-n);
    },
    
    getWindow(durationMs: number): StreamSample[] {
      if (samples.length === 0) return [];
      const cutoff = samples[samples.length - 1].timestamp - durationMs;
      return samples.filter(s => s.timestamp >= cutoff);
    },
    
    clear() {
      samples.length = 0;
    },
  };
}

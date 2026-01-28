/**
 * Unified Stream Slice
 * 
 * Stream-agnostic state management for any neural/biosignal source.
 * Works alongside the legacy streamSlice for backward compatibility.
 */

import type { StateCreator } from 'zustand';
import type {
  StreamSample,
  StreamConfig,
  StreamSource,
  StreamConnectionState,
  GroundTruth,
  StreamBuffer,
} from '../../types/stream';
import { createStreamBuffer } from '../../types/stream';

export interface UnifiedStreamSlice {
  // Active stream source
  activeStreamSource: StreamSource | null;
  activeStreamConfig: StreamConfig | null;
  
  // Connection state
  streamConnectionState: StreamConnectionState;
  streamError: string | null;
  
  // Current data
  currentStreamSample: StreamSample | null;
  currentGroundTruth: GroundTruth | null;
  
  // Buffered history for temporal analysis
  streamBuffer: StreamBuffer;
  
  // Statistics
  streamSamplesReceived: number;
  streamLastSampleTime: number;
  streamEffectiveSampleRate: number;
  
  // Actions
  setActiveStreamSource: (source: StreamSource | null) => void;
  connectStream: (url?: string) => Promise<void>;
  disconnectStream: () => void;
  receiveStreamSample: (sample: StreamSample, groundTruth?: GroundTruth) => void;
  setStreamConnectionState: (state: StreamConnectionState, error?: string) => void;
  clearStreamBuffer: () => void;
}

// Rate calculation window
const RATE_WINDOW_MS = 1000;
let sampleTimestamps: number[] = [];

export const createUnifiedStreamSlice: StateCreator<
  UnifiedStreamSlice,
  [],
  [],
  UnifiedStreamSlice
> = (set, get) => ({
  // Initial state
  activeStreamSource: null,
  activeStreamConfig: null,
  streamConnectionState: 'disconnected',
  streamError: null,
  currentStreamSample: null,
  currentGroundTruth: null,
  streamBuffer: createStreamBuffer(500), // 500 samples default
  streamSamplesReceived: 0,
  streamLastSampleTime: 0,
  streamEffectiveSampleRate: 0,

  setActiveStreamSource: (source: StreamSource | null) => {
    const { activeStreamSource } = get();
    
    // Disconnect previous source
    if (activeStreamSource) {
      activeStreamSource.disconnect();
    }
    
    // Clear buffer for new source
    get().streamBuffer.clear();
    sampleTimestamps = [];
    
    set({
      activeStreamSource: source,
      activeStreamConfig: source?.config ?? null,
      streamConnectionState: 'disconnected',
      streamError: null,
      currentStreamSample: null,
      currentGroundTruth: null,
      streamSamplesReceived: 0,
      streamLastSampleTime: 0,
      streamEffectiveSampleRate: 0,
    });
  },

  connectStream: async (url?: string) => {
    const { activeStreamSource } = get();
    
    if (!activeStreamSource) {
      set({ streamError: 'No stream source selected' });
      return;
    }
    
    set({ streamConnectionState: 'connecting', streamError: null });
    
    try {
      // Subscribe to samples
      activeStreamSource.onSample((sample, groundTruth) => {
        get().receiveStreamSample(sample, groundTruth);
      });
      
      // Subscribe to state changes
      activeStreamSource.onStateChange((state) => {
        set({
          streamConnectionState: state,
          streamError: state === 'error' ? activeStreamSource.lastError : null,
        });
      });
      
      await activeStreamSource.connect(url);
      
      set({ streamConnectionState: 'connected' });
    } catch (error) {
      set({
        streamConnectionState: 'error',
        streamError: error instanceof Error ? error.message : 'Connection failed',
      });
    }
  },

  disconnectStream: () => {
    const { activeStreamSource } = get();
    
    if (activeStreamSource) {
      activeStreamSource.disconnect();
    }
    
    set({
      streamConnectionState: 'disconnected',
      streamError: null,
    });
  },

  receiveStreamSample: (sample: StreamSample, groundTruth?: GroundTruth) => {
    const now = performance.now();
    const { streamBuffer, streamSamplesReceived } = get();
    
    // Add to buffer
    streamBuffer.push(sample);
    
    // Calculate effective sample rate
    sampleTimestamps.push(now);
    const cutoff = now - RATE_WINDOW_MS;
    sampleTimestamps = sampleTimestamps.filter(t => t > cutoff);
    const effectiveRate = sampleTimestamps.length * (1000 / RATE_WINDOW_MS);
    
    set({
      currentStreamSample: sample,
      currentGroundTruth: groundTruth ?? null,
      streamSamplesReceived: streamSamplesReceived + 1,
      streamLastSampleTime: now,
      streamEffectiveSampleRate: Math.round(effectiveRate),
    });
  },

  setStreamConnectionState: (state: StreamConnectionState, error?: string) => {
    set({
      streamConnectionState: state,
      streamError: error ?? null,
    });
  },

  clearStreamBuffer: () => {
    get().streamBuffer.clear();
    sampleTimestamps = [];
    set({
      currentStreamSample: null,
      currentGroundTruth: null,
      streamSamplesReceived: 0,
      streamEffectiveSampleRate: 0,
    });
  },
});

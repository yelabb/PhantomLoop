/**
 * Unified Stream Slice
 * 
 * Stream-agnostic state management for any neural/biosignal source.
 * Works alongside the legacy streamSlice for backward compatibility.
 * 
 * PERFORMANCE: Uses throttled updates to prevent UI jank at high sample rates.
 * Samples are buffered immediately, but React state updates are throttled to
 * a fixed UI refresh rate (default 20Hz) to prevent rendering bottlenecks.
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

// ============================================================================
// THROTTLED UPDATE MECHANISM
// ============================================================================
// At 250Hz (ESP-EEG), we'd trigger 250 React state updates/sec without throttling.
// This batches samples and updates React at a fixed UI refresh rate.

const UI_REFRESH_RATE_HZ = 20; // 20Hz = 50ms between UI updates
const UI_REFRESH_INTERVAL_MS = 1000 / UI_REFRESH_RATE_HZ;

// Module-level state for throttling (not in Zustand to avoid triggering updates)
let pendingSample: StreamSample | null = null;
let pendingGroundTruth: GroundTruth | null = null;
let pendingSampleCount = 0;
let lastUIUpdateTime = 0;
let throttleTimerId: ReturnType<typeof setTimeout> | null = null;
let sampleTimestamps: number[] = [];

// Rate calculation window
const RATE_WINDOW_MS = 1000;

// ============================================================================
// SUBSCRIPTION CLEANUP
// ============================================================================
// Store unsubscribe functions to prevent memory leaks when switching adapters

let unsubscribeSample: (() => void) | null = null;
let unsubscribeState: (() => void) | null = null;

/**
 * Clean up all active subscriptions and timers.
 * Called when disconnecting or switching adapters.
 */
function cleanupSubscriptions() {
  // Unsubscribe from adapter callbacks
  if (unsubscribeSample) {
    unsubscribeSample();
    unsubscribeSample = null;
  }
  if (unsubscribeState) {
    unsubscribeState();
    unsubscribeState = null;
  }
  
  // Clear throttle timer
  if (throttleTimerId) {
    clearTimeout(throttleTimerId);
    throttleTimerId = null;
  }
  
  // Reset pending state
  pendingSample = null;
  pendingGroundTruth = null;
  pendingSampleCount = 0;
}

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
    
    // Clean up existing subscriptions BEFORE disconnecting
    cleanupSubscriptions();
    
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
    
    // Clean up any existing subscriptions before creating new ones
    cleanupSubscriptions();
    
    set({ streamConnectionState: 'connecting', streamError: null });
    
    try {
      // Subscribe to samples and STORE the unsubscribe function
      unsubscribeSample = activeStreamSource.onSample((sample, groundTruth) => {
        get().receiveStreamSample(sample, groundTruth);
      });
      
      // Subscribe to state changes and STORE the unsubscribe function
      unsubscribeState = activeStreamSource.onStateChange((state) => {
        set({
          streamConnectionState: state,
          streamError: state === 'error' ? activeStreamSource.lastError : null,
        });
      });
      
      await activeStreamSource.connect(url);
      
      set({ streamConnectionState: 'connected' });
    } catch (error) {
      // Clean up subscriptions on connection failure
      cleanupSubscriptions();
      set({
        streamConnectionState: 'error',
        streamError: error instanceof Error ? error.message : 'Connection failed',
      });
    }
  },

  disconnectStream: () => {
    const { activeStreamSource } = get();
    
    // Clean up subscriptions and timers
    cleanupSubscriptions();
    
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
    const { streamBuffer } = get();
    
    // ALWAYS add to buffer immediately (no delay for data integrity)
    streamBuffer.push(sample);
    
    // Track sample timestamps for rate calculation
    sampleTimestamps.push(now);
    const cutoff = now - RATE_WINDOW_MS;
    // Use a more efficient filter - only filter when array gets large
    if (sampleTimestamps.length > 500) {
      sampleTimestamps = sampleTimestamps.filter(t => t > cutoff);
    }
    
    // Store pending sample (will be flushed on next UI update)
    pendingSample = sample;
    pendingGroundTruth = groundTruth ?? null;
    pendingSampleCount++;
    
    // Throttled UI update: only update React state at UI_REFRESH_RATE_HZ
    const timeSinceLastUpdate = now - lastUIUpdateTime;
    
    if (timeSinceLastUpdate >= UI_REFRESH_INTERVAL_MS) {
      // Enough time has passed, update immediately
      flushToReactState(set, get, now);
    } else if (!throttleTimerId) {
      // Schedule an update for the remaining time
      const remainingTime = UI_REFRESH_INTERVAL_MS - timeSinceLastUpdate;
      throttleTimerId = setTimeout(() => {
        throttleTimerId = null;
        flushToReactState(set, get, performance.now());
      }, remainingTime);
    }
    // If timer already scheduled, do nothing - it will pick up the latest sample
  },

  setStreamConnectionState: (state: StreamConnectionState, error?: string) => {
    set({
      streamConnectionState: state,
      streamError: error ?? null,
    });
  },

  clearStreamBuffer: () => {
    // Clear throttle state (but don't unsubscribe - just clearing buffer)
    if (throttleTimerId) {
      clearTimeout(throttleTimerId);
      throttleTimerId = null;
    }
    pendingSample = null;
    pendingGroundTruth = null;
    pendingSampleCount = 0;
    lastUIUpdateTime = 0;
    sampleTimestamps = [];
    
    get().streamBuffer.clear();
    set({
      currentStreamSample: null,
      currentGroundTruth: null,
      streamSamplesReceived: 0,
      streamEffectiveSampleRate: 0,
    });
  },
});

/**
 * Flush pending samples to React state.
 * Called at throttled intervals to prevent excessive re-renders.
 */
function flushToReactState(
  set: (state: Partial<UnifiedStreamSlice>) => void,
  get: () => UnifiedStreamSlice,
  now: number
) {
  if (!pendingSample) return;
  
  const { streamSamplesReceived } = get();
  
  // Calculate effective sample rate from timestamps
  const cutoff = now - RATE_WINDOW_MS;
  const recentTimestamps = sampleTimestamps.filter(t => t > cutoff);
  const effectiveRate = recentTimestamps.length * (1000 / RATE_WINDOW_MS);
  
  // Batch update: all pending samples counted, but only latest sample in state
  set({
    currentStreamSample: pendingSample,
    currentGroundTruth: pendingGroundTruth,
    streamSamplesReceived: streamSamplesReceived + pendingSampleCount,
    streamLastSampleTime: now,
    streamEffectiveSampleRate: Math.round(effectiveRate),
  });
  
  // Reset pending state
  lastUIUpdateTime = now;
  pendingSampleCount = 0;
  // Keep pendingSample/pendingGroundTruth for reference until next sample arrives
}

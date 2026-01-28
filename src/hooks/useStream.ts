/**
 * Unified Stream Hook
 * 
 * Stream-agnostic hook for connecting to and consuming neural data.
 * Works with any adapter (PhantomLink, ESP-EEG, Universal EEG, etc.)
 */

import { useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { createAdapter, listAdapters } from '../streams';

// Selectors for minimal re-renders
// const selectActiveStreamSource = (s: ReturnType<typeof useStore.getState>) => s.activeStreamSource;
const selectActiveStreamConfig = (s: ReturnType<typeof useStore.getState>) => s.activeStreamConfig;
const selectStreamConnectionState = (s: ReturnType<typeof useStore.getState>) => s.streamConnectionState;
const selectStreamError = (s: ReturnType<typeof useStore.getState>) => s.streamError;
const selectCurrentStreamSample = (s: ReturnType<typeof useStore.getState>) => s.currentStreamSample;
const selectCurrentGroundTruth = (s: ReturnType<typeof useStore.getState>) => s.currentGroundTruth;
const selectStreamSamplesReceived = (s: ReturnType<typeof useStore.getState>) => s.streamSamplesReceived;
const selectStreamEffectiveSampleRate = (s: ReturnType<typeof useStore.getState>) => s.streamEffectiveSampleRate;
const selectSetActiveStreamSource = (s: ReturnType<typeof useStore.getState>) => s.setActiveStreamSource;
const selectConnectStream = (s: ReturnType<typeof useStore.getState>) => s.connectStream;
const selectDisconnectStream = (s: ReturnType<typeof useStore.getState>) => s.disconnectStream;

export interface UseStreamReturn {
  // Current state
  config: ReturnType<typeof selectActiveStreamConfig>;
  connectionState: ReturnType<typeof selectStreamConnectionState>;
  error: ReturnType<typeof selectStreamError>;
  currentSample: ReturnType<typeof selectCurrentStreamSample>;
  groundTruth: ReturnType<typeof selectCurrentGroundTruth>;
  samplesReceived: number;
  effectiveSampleRate: number;
  
  // Actions
  selectAdapter: (adapterId: string, options?: Record<string, unknown>) => void;
  connect: (url?: string) => Promise<void>;
  disconnect: () => void;
  
  // Registry info
  availableAdapters: ReturnType<typeof listAdapters>;
}

export function useStream(): UseStreamReturn {
  // const activeStreamSource = useStore(selectActiveStreamSource); // Available if needed
  const activeStreamConfig = useStore(selectActiveStreamConfig);
  const streamConnectionState = useStore(selectStreamConnectionState);
  const streamError = useStore(selectStreamError);
  const currentStreamSample = useStore(selectCurrentStreamSample);
  const currentGroundTruth = useStore(selectCurrentGroundTruth);
  const streamSamplesReceived = useStore(selectStreamSamplesReceived);
  const streamEffectiveSampleRate = useStore(selectStreamEffectiveSampleRate);
  const setActiveStreamSource = useStore(selectSetActiveStreamSource);
  const connectStream = useStore(selectConnectStream);
  const disconnectStream = useStore(selectDisconnectStream);

  // Select a new adapter
  const selectAdapter = useCallback((adapterId: string, options?: Record<string, unknown>) => {
    try {
      const adapter = createAdapter(adapterId, options);
      setActiveStreamSource(adapter);
      console.log(`[useStream] Selected adapter: ${adapterId}`);
    } catch (error) {
      console.error(`[useStream] Failed to create adapter: ${adapterId}`, error);
    }
  }, [setActiveStreamSource]);

  // Connect to current adapter
  const connect = useCallback(async (url?: string) => {
    await connectStream(url);
  }, [connectStream]);

  // Disconnect
  const disconnect = useCallback(() => {
    disconnectStream();
  }, [disconnectStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectStream();
    };
  }, [disconnectStream]);

  return {
    config: activeStreamConfig,
    connectionState: streamConnectionState,
    error: streamError,
    currentSample: currentStreamSample,
    groundTruth: currentGroundTruth,
    samplesReceived: streamSamplesReceived,
    effectiveSampleRate: streamEffectiveSampleRate,
    selectAdapter,
    connect,
    disconnect,
    availableAdapters: listAdapters(),
  };
}

/**
 * Hook that bridges unified stream to legacy packet format
 * For backward compatibility with existing components
 */
export function useStreamToLegacyBridge() {
  const { currentSample, groundTruth, config } = useStream();
  const receivePacket = useStore(s => s.receivePacket);
  
  // Convert StreamSample to legacy StreamPacket format
  useEffect(() => {
    if (!currentSample || !config) return;
    
    // Only bridge if we have ground truth (i.e., PhantomLink with cursor task)
    if (!groundTruth) return;
    
    // Construct legacy packet
    const legacyPacket = {
      type: 'data' as const,
      data: {
        timestamp: currentSample.timestamp / 1000, // Back to seconds
        sequence_number: currentSample.metadata?.sequenceNumber ?? 0,
        spikes: {
          channel_ids: Array.from({ length: currentSample.channels.length }, (_, i) => i),
          spike_counts: currentSample.channels,
          bin_size_ms: 1000 / config.samplingRate,
        },
        kinematics: {
          x: groundTruth.position?.x ?? 0,
          y: groundTruth.position?.y ?? 0,
          vx: groundTruth.velocity?.x ?? 0,
          vy: groundTruth.velocity?.y ?? 0,
        },
        intention: {
          target_id: groundTruth.target?.id ?? 0,
          target_x: groundTruth.target?.x ?? 0,
          target_y: groundTruth.target?.y ?? 0,
          distance_to_target: 0,
        },
        trial_id: groundTruth.trial?.id ?? 0,
        trial_time_ms: groundTruth.trial?.timeMs ?? 0,
      },
    };
    
    receivePacket(legacyPacket);
  }, [currentSample, groundTruth, config, receivePacket]);
}

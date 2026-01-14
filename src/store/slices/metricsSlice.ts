// Performance metrics slice

import type { StateCreator } from 'zustand';
import { PERFORMANCE_THRESHOLDS } from '../../utils/constants';

// Rolling window for accuracy history
const ACCURACY_HISTORY_LENGTH = 120; // 3 seconds at 40Hz

export interface MetricsSlice {
  fps: number;
  networkLatency: number;
  decoderLatency: number;
  totalLatency: number;
  desyncDetected: boolean;
  droppedPackets: number;
  totalPacketsReceived: number;
  
  // Accuracy metrics
  currentAccuracy: number;
  currentError: number;
  accuracyHistory: number[];
  errorHistory: number[];
  trialCount: number;
  successfulTrials: number;
  
  updateFPS: (fps: number) => void;
  updateNetworkLatency: (latency: number) => void;
  updateDecoderLatency: (latency: number) => void;
  incrementDroppedPackets: () => void;
  updateAccuracy: (accuracy: number, error: number) => void;
  recordTrialResult: (success: boolean) => void;
  resetMetrics: () => void;
}

export const createMetricsSlice: StateCreator<
  MetricsSlice,
  [],
  [],
  MetricsSlice
> = (set, get) => ({
  fps: 0,
  networkLatency: 0,
  decoderLatency: 0,
  totalLatency: 0,
  desyncDetected: false,
  droppedPackets: 0,
  totalPacketsReceived: 0,
  
  // Accuracy metrics
  currentAccuracy: 0,
  currentError: 0,
  accuracyHistory: [],
  errorHistory: [],
  trialCount: 0,
  successfulTrials: 0,

  updateFPS: (fps: number) => {
    set({ fps });
  },

  updateNetworkLatency: (latency: number) => {
    const { decoderLatency } = get();
    const totalLatency = latency + decoderLatency;
    const desyncDetected = totalLatency > PERFORMANCE_THRESHOLDS.DESYNC_THRESHOLD_MS;

    set({ 
      networkLatency: latency,
      totalLatency,
      desyncDetected,
    });

    if (desyncDetected) {
      console.warn(`[PhantomLoop] DESYNC DETECTED: ${totalLatency.toFixed(2)}ms`);
    }
  },

  updateDecoderLatency: (latency: number) => {
    const { networkLatency } = get();
    const totalLatency = networkLatency + latency;
    const desyncDetected = totalLatency > PERFORMANCE_THRESHOLDS.DESYNC_THRESHOLD_MS;

    set({ 
      decoderLatency: latency,
      totalLatency,
      desyncDetected,
    });

    if (desyncDetected) {
      console.warn(`[PhantomLoop] DESYNC DETECTED: ${totalLatency.toFixed(2)}ms`);
    }
  },

  incrementDroppedPackets: () => {
    set((state) => ({ 
      droppedPackets: state.droppedPackets + 1 
    }));
  },

  updateAccuracy: (accuracy: number, error: number) => {
    const { accuracyHistory, errorHistory } = get();
    
    // Maintain rolling window
    const newAccuracyHistory = [...accuracyHistory, accuracy].slice(-ACCURACY_HISTORY_LENGTH);
    const newErrorHistory = [...errorHistory, error].slice(-ACCURACY_HISTORY_LENGTH);
    
    set({
      currentAccuracy: accuracy,
      currentError: error,
      accuracyHistory: newAccuracyHistory,
      errorHistory: newErrorHistory,
    });
  },

  recordTrialResult: (success: boolean) => {
    set((state) => ({
      trialCount: state.trialCount + 1,
      successfulTrials: state.successfulTrials + (success ? 1 : 0),
    }));
  },

  resetMetrics: () => {
    set({
      fps: 0,
      networkLatency: 0,
      decoderLatency: 0,
      totalLatency: 0,
      desyncDetected: false,
      droppedPackets: 0,
      totalPacketsReceived: 0,
      currentAccuracy: 0,
      currentError: 0,
      accuracyHistory: [],
      errorHistory: [],
      trialCount: 0,
      successfulTrials: 0,
    });
  },
});

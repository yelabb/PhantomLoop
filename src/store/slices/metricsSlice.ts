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
  
  // Session-wide statistics for research (tracks ENTIRE session)
  sessionAccuracyAll: number[]; // ALL valid samples for the entire session
  sessionErrorAll: number[]; // ALL valid error samples for the entire session
  sessionMinAccuracy: number;
  sessionMaxAccuracy: number;
  sessionMinError: number;
  sessionMaxError: number;
  sessionSum: number; // Running sum for efficient avg calculation
  validSampleCount: number; // Excludes (0,0) samples
  totalSampleCount: number; // All samples including skipped ones
  
  updateFPS: (fps: number) => void;
  updateNetworkLatency: (latency: number) => void;
  updateDecoderLatency: (latency: number) => void;
  incrementDroppedPackets: () => void;
  updateAccuracy: (accuracy: number, error: number, isValid?: boolean) => void;
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
  
  // Session-wide statistics
  sessionAccuracyAll: [],
  sessionErrorAll: [],
  sessionMinAccuracy: 1,
  sessionMaxAccuracy: 0,
  sessionMinError: 1,
  sessionMaxError: 0,
  sessionSum: 0,
  validSampleCount: 0,
  totalSampleCount: 0,

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

  updateAccuracy: (accuracy: number, error: number, isValid: boolean = true) => {
    set((prev) => {
      const updates: Partial<MetricsSlice> = {
        totalSampleCount: prev.totalSampleCount + 1,
      };
      
      // Only update if valid (not a (0,0) sample)
      if (isValid) {
        const newAccuracyHistory = [...prev.accuracyHistory, accuracy].slice(-ACCURACY_HISTORY_LENGTH);
        const newErrorHistory = [...prev.errorHistory, error].slice(-ACCURACY_HISTORY_LENGTH);
        
        updates.currentAccuracy = accuracy;
        updates.currentError = error;
        updates.accuracyHistory = newAccuracyHistory;
        updates.errorHistory = newErrorHistory;
        updates.validSampleCount = prev.validSampleCount + 1;
        
        // Session-wide tracking - ALL valid samples
        updates.sessionAccuracyAll = [...prev.sessionAccuracyAll, accuracy];
        updates.sessionErrorAll = [...prev.sessionErrorAll, error];
        updates.sessionSum = prev.sessionSum + accuracy;
        
        // Update session-wide min/max
        updates.sessionMinAccuracy = Math.min(prev.sessionMinAccuracy, accuracy);
        updates.sessionMaxAccuracy = Math.max(prev.sessionMaxAccuracy, accuracy);
        updates.sessionMinError = Math.min(prev.sessionMinError, error);
        updates.sessionMaxError = Math.max(prev.sessionMaxError, error);
      }
      
      return updates;
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
      sessionAccuracyAll: [],
      sessionErrorAll: [],
      sessionMinAccuracy: 1,
      sessionMaxAccuracy: 0,
      sessionMinError: 1,
      sessionMaxError: 0,
      sessionSum: 0,
      validSampleCount: 0,
      totalSampleCount: 0,
    });
  },
});

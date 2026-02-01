// Unified decoder execution hook - Optimized for 40Hz packet rate
// Supports both synchronous JS decoders and async TensorFlow.js decoders

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { executeDecoder, clearDecoderCache } from '../decoders/executeDecoder';
import { clearHistory as clearTFJSHistory } from '../decoders/tfjsInference';
import { cleanupMemory } from '../decoders/tfjsBackend';
import { extractSpatialFeatures, createChannelMask } from '../utils/spatialFeatures';
import type { DecoderInput, DecoderOutput } from '../types/decoders';

// Use selectors to prevent unnecessary re-renders
const selectCurrentPacket = (state: ReturnType<typeof useStore.getState>) => state.currentPacket;
const selectActiveDecoder = (state: ReturnType<typeof useStore.getState>) => state.activeDecoder;
const selectElectrodeConfig = (state: ReturnType<typeof useStore.getState>) => state.electrodeConfig;
const selectUpdateDecoderOutput = (state: ReturnType<typeof useStore.getState>) => state.updateDecoderOutput;
const selectUpdateDecoderLatency = (state: ReturnType<typeof useStore.getState>) => state.updateDecoderLatency;
const selectIsStreamPaused = (state: ReturnType<typeof useStore.getState>) => state.isStreamPaused;

export function useDecoder() {
  const currentPacket = useStore(selectCurrentPacket);
  const activeDecoder = useStore(selectActiveDecoder);
  const electrodeConfig = useStore(selectElectrodeConfig);
  const updateDecoderOutput = useStore(selectUpdateDecoderOutput);
  const updateDecoderLatency = useStore(selectUpdateDecoderLatency);
  const isStreamPaused = useStore(selectIsStreamPaused);

  const historyRef = useRef<DecoderOutput[]>([]);
  const lastProcessedSeqRef = useRef<number>(-1);
  const isProcessingRef = useRef(false);
  const packetCountRef = useRef<number>(0);

  // Process packet - now supports async TFJS decoders
  const processPacket = useCallback(async () => {
    // Skip processing when stream is paused (e.g., modal open)
    if (isStreamPaused) return;
    
    if (!currentPacket || !activeDecoder) return;
    
    // Skip if we already processed this packet or still processing previous
    const seqNum = currentPacket.data.sequence_number;
    if (seqNum === lastProcessedSeqRef.current) return;
    if (isProcessingRef.current) return; // Skip if still processing (for slow TFJS inference)
    
    lastProcessedSeqRef.current = seqNum;
    isProcessingRef.current = true;

    try {
      // Prepare decoder input
      const input: DecoderInput = {
        spikes: currentPacket.data.spikes.spike_counts,
        kinematics: {
          x: currentPacket.data.kinematics.x,
          y: currentPacket.data.kinematics.y,
          vx: currentPacket.data.kinematics.vx,
          vy: currentPacket.data.kinematics.vy,
        },
        history: historyRef.current,
      };

      // Add electrode-aware features if configuration is available
      if (electrodeConfig) {
        input.electrodeConfig = electrodeConfig;
        input.spatialFeatures = extractSpatialFeatures(
          currentPacket.data.spikes.spike_counts,
          electrodeConfig
        );
        input.channelMask = createChannelMask(electrodeConfig);
      }

      // Execute decoder (async for TFJS, sync for JS)
      const output = await executeDecoder(activeDecoder, input);

      // Update history efficiently - mutate in place
      historyRef.current.push(output);
      if (historyRef.current.length > 40) {
        historyRef.current.shift();
      }

      // Periodic TFJS memory cleanup to prevent memory leaks in long sessions
      packetCountRef.current++;
      if (packetCountRef.current % 1000 === 0) {
        cleanupMemory();
      }

      // Update store
      updateDecoderOutput(output);
      updateDecoderLatency(output.latency);
    } catch (error) {
      console.error('[useDecoder] Execution error:', error);
    } finally {
      isProcessingRef.current = false;
    }
    // electrodeConfig intentionally omitted - only used for optional spatial features
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPacket, activeDecoder, isStreamPaused, updateDecoderOutput, updateDecoderLatency]);

  // Run decoder when packet changes
  useEffect(() => {
    processPacket();
  }, [processPacket]);

  // Reset history and cleanup memory when decoder changes
  useEffect(() => {
    historyRef.current = [];
    lastProcessedSeqRef.current = -1;
    isProcessingRef.current = false;
    packetCountRef.current = 0;
    clearDecoderCache();
    clearTFJSHistory();
    cleanupMemory(); // Prevent TFJS memory leaks when switching decoders
  }, [activeDecoder?.id]);
}

// Unified decoder execution hook - Optimized for 40Hz packet rate
// Supports both synchronous JS decoders and async TensorFlow.js decoders

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { executeDecoder, clearDecoderCache } from '../decoders/executeDecoder';
import { clearHistory as clearTFJSHistory } from '../decoders/tfjsInference';
import type { DecoderInput, DecoderOutput } from '../types/decoders';

// Use selectors to prevent unnecessary re-renders
const selectCurrentPacket = (state: ReturnType<typeof useStore.getState>) => state.currentPacket;
const selectActiveDecoder = (state: ReturnType<typeof useStore.getState>) => state.activeDecoder;
const selectUpdateDecoderOutput = (state: ReturnType<typeof useStore.getState>) => state.updateDecoderOutput;
const selectUpdateDecoderLatency = (state: ReturnType<typeof useStore.getState>) => state.updateDecoderLatency;

export function useDecoder() {
  const currentPacket = useStore(selectCurrentPacket);
  const activeDecoder = useStore(selectActiveDecoder);
  const updateDecoderOutput = useStore(selectUpdateDecoderOutput);
  const updateDecoderLatency = useStore(selectUpdateDecoderLatency);

  const historyRef = useRef<DecoderOutput[]>([]);
  const lastProcessedSeqRef = useRef<number>(-1);
  const isProcessingRef = useRef(false);

  // Process packet - now supports async TFJS decoders
  const processPacket = useCallback(async () => {
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

      // Execute decoder (async for TFJS, sync for JS)
      const output = await executeDecoder(activeDecoder, input);

      // Update history efficiently - mutate in place
      historyRef.current.push(output);
      if (historyRef.current.length > 40) {
        historyRef.current.shift();
      }

      // Update store
      updateDecoderOutput(output);
      updateDecoderLatency(output.latency);
    } catch (error) {
      console.error('[useDecoder] Execution error:', error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [currentPacket, activeDecoder, updateDecoderOutput, updateDecoderLatency]);

  // Run decoder when packet changes
  useEffect(() => {
    processPacket();
  }, [processPacket]);

  // Reset history when decoder changes
  useEffect(() => {
    historyRef.current = [];
    lastProcessedSeqRef.current = -1;
    isProcessingRef.current = false;
    clearDecoderCache();
    clearTFJSHistory();
  }, [activeDecoder?.id]);
}

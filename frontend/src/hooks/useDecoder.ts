// Unified decoder execution hook

import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { executeDecoder } from '../decoders/executeDecoder';
import type { DecoderInput, DecoderOutput } from '../types/decoders';
import { PERFORMANCE_THRESHOLDS } from '../utils/constants';

export function useDecoder() {
  const {
    currentPacket,
    activeDecoder,
    updateDecoderOutput,
    updateDecoderLatency,
    setProcessing,
  } = useStore();

  const historyRef = useRef<DecoderOutput[]>([]);

  useEffect(() => {
    if (!currentPacket || !activeDecoder) return;

    const processPacket = async () => {
      setProcessing(true);
      const startTime = performance.now();

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

        // Execute decoder with timeout
        const timeoutPromise = new Promise<DecoderOutput>((_, reject) =>
          setTimeout(
            () => reject(new Error('Decoder timeout')),
            PERFORMANCE_THRESHOLDS.DECODER_TIMEOUT_MS
          )
        );

        const decoderPromise = executeDecoder(activeDecoder, input);
        const output = await Promise.race([decoderPromise, timeoutPromise]);

        // Update history
        historyRef.current = [...historyRef.current, output];
        if (historyRef.current.length > 40) {
          historyRef.current.shift();
        }

        // Update store
        updateDecoderOutput(output);
        updateDecoderLatency(output.latency);
      } catch (error) {
        console.error('[useDecoder] Processing error:', error);
        // On error, use passthrough with corrected path
        const fallbackOutput: DecoderOutput = {
          x: currentPacket.data.kinematics.x,
          y: currentPacket.data.kinematics.y,
          latency: performance.now() - startTime,
        };
        updateDecoderOutput(fallbackOutput);
      } finally {
        setProcessing(false);
      }
    };

    processPacket();
  }, [
    currentPacket,
    activeDecoder,
    updateDecoderOutput,
    updateDecoderLatency,
    setProcessing,
  ]);

  // Reset history when decoder changes
  useEffect(() => {
    historyRef.current = [];
  }, [activeDecoder]);
}

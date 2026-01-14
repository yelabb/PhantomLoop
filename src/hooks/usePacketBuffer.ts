// Packet buffer management hook

import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { STREAM_CONFIG } from '../utils/constants';

export function usePacketBuffer() {
  const { 
    packetBuffer, 
    packetsReceived,
    incrementDroppedPackets 
  } = useStore();
  
  const lastSequenceRef = useRef<number>(-1);

  useEffect(() => {
    if (packetBuffer.length === 0) return;

    const latestPacket = packetBuffer[packetBuffer.length - 1];
    const currentSequence = latestPacket.data.sequence_number;

    // Detect gaps in sequence numbers
    if (lastSequenceRef.current !== -1) {
      const expectedSequence = lastSequenceRef.current + 1;
      const gap = currentSequence - expectedSequence;

      if (gap > 0) {
        console.warn(`[PhantomLoop] Detected ${gap} dropped packet(s)`);
        for (let i = 0; i < gap; i++) {
          incrementDroppedPackets();
        }
      }
    }

    lastSequenceRef.current = currentSequence;
  }, [packetBuffer, incrementDroppedPackets]);

  return {
    buffer: packetBuffer,
    bufferSize: packetBuffer.length,
    maxBufferSize: STREAM_CONFIG.BUFFER_SIZE,
    packetsReceived,
  };
}

// Stream data slice

import type { StateCreator } from 'zustand';
import type { StreamPacket } from '../../types/packets';
import { STREAM_CONFIG } from '../../utils/constants';

export interface StreamSlice {
  currentPacket: StreamPacket | null;
  packetBuffer: StreamPacket[];
  packetsReceived: number;
  lastPacketTime: number;
  
  receivePacket: (packet: StreamPacket) => void;
  updateBuffer: (packet: StreamPacket) => void;
  clearStream: () => void;
}

export const createStreamSlice: StateCreator<
  StreamSlice,
  [],
  [],
  StreamSlice
> = (set, get) => ({
  currentPacket: null,
  packetBuffer: [],
  packetsReceived: 0,
  lastPacketTime: 0,

  receivePacket: (packet: StreamPacket) => {
    const now = performance.now();
    
    set({ 
      currentPacket: packet,
      packetsReceived: get().packetsReceived + 1,
      lastPacketTime: now,
    });

    // Update buffer
    get().updateBuffer(packet);
  },

  updateBuffer: (packet: StreamPacket) => {
    const { packetBuffer } = get();
    const newBuffer = [...packetBuffer, packet];
    
    // Keep only the last BUFFER_SIZE packets (1 second at 40Hz)
    if (newBuffer.length > STREAM_CONFIG.BUFFER_SIZE) {
      newBuffer.shift();
    }

    set({ packetBuffer: newBuffer });
  },

  clearStream: () => {
    set({
      currentPacket: null,
      packetBuffer: [],
      packetsReceived: 0,
      lastPacketTime: 0,
    });
  },
});

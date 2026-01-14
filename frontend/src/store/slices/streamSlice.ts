// Stream data slice - Optimized for high-frequency updates

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

// Throttle state updates to prevent excessive re-renders
// At 40Hz input, we update React state at most every 50ms (20Hz)
let lastUpdateTime = 0;
let pendingPacket: StreamPacket | null = null;
let pendingBuffer: StreamPacket[] = [];
let updateScheduled = false;

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
    
    // Always update internal tracking immediately
    pendingPacket = packet;
    pendingBuffer = [...get().packetBuffer.slice(-(STREAM_CONFIG.BUFFER_SIZE - 1)), packet];
    
    // Throttle React state updates to prevent UI freeze
    const elapsed = now - lastUpdateTime;
    
    if (elapsed >= 50) { // Update at most 20 times per second
      lastUpdateTime = now;
      set({ 
        currentPacket: pendingPacket,
        packetBuffer: pendingBuffer,
        packetsReceived: get().packetsReceived + 1,
        lastPacketTime: now,
      });
    } else if (!updateScheduled) {
      // Schedule an update for the next frame if one isn't already scheduled
      updateScheduled = true;
      requestAnimationFrame(() => {
        updateScheduled = false;
        if (pendingPacket) {
          set({ 
            currentPacket: pendingPacket,
            packetBuffer: pendingBuffer,
            packetsReceived: get().packetsReceived + 1,
            lastPacketTime: performance.now(),
          });
        }
      });
    }
  },

  updateBuffer: (packet: StreamPacket) => {
    // This is now handled inline in receivePacket for efficiency
    const { packetBuffer } = get();
    const newBuffer = [...packetBuffer, packet];
    
    if (newBuffer.length > STREAM_CONFIG.BUFFER_SIZE) {
      newBuffer.shift();
    }

    set({ packetBuffer: newBuffer });
  },

  clearStream: () => {
    pendingPacket = null;
    pendingBuffer = [];
    set({
      currentPacket: null,
      packetBuffer: [],
      packetsReceived: 0,
      lastPacketTime: 0,
    });
  },
});

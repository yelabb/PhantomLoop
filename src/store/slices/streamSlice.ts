// Stream data slice - Optimized for high-frequency updates

import type { StateCreator } from 'zustand';
import type { StreamPacket } from '../../types/packets';
import { STREAM_CONFIG, TIMELINE_CONFIG } from '../../utils/constants';

export interface StreamSlice {
  currentPacket: StreamPacket | null;
  packetBuffer: StreamPacket[];
  packetHistory: StreamPacket[];
  packetsReceived: number;
  lastPacketTime: number;
  isTimeTraveling: boolean;
  timelineIndex: number;
  
  receivePacket: (packet: StreamPacket) => void;
  updateBuffer: (packet: StreamPacket) => void;
  clearStream: () => void;
  setTimeTraveling: (isTimeTraveling: boolean) => void;
  setTimelineIndex: (index: number) => void;
  stepTimeline: (delta: number) => void;
  resumeLive: () => void;
}

// Throttle state updates to prevent excessive re-renders
// At 40Hz input, we update React state at most every 50ms (20Hz)
let lastUpdateTime = 0;
let pendingPacket: StreamPacket | null = null;
let pendingBuffer: StreamPacket[] = [];
let pendingHistory: StreamPacket[] = [];
let updateScheduled = false;

export const createStreamSlice: StateCreator<
  StreamSlice,
  [],
  [],
  StreamSlice
> = (set, get) => ({
  currentPacket: null,
  packetBuffer: [],
  packetHistory: [],
  packetsReceived: 0,
  lastPacketTime: 0,
  isTimeTraveling: false,
  timelineIndex: 0,

  receivePacket: (packet: StreamPacket) => {
    const now = performance.now();
    
    // Always update internal tracking immediately
    const { packetBuffer, packetHistory, isTimeTraveling } = get();
    pendingPacket = packet;
    pendingBuffer = [...packetBuffer.slice(-(STREAM_CONFIG.BUFFER_SIZE - 1)), packet];
    pendingHistory = [...packetHistory.slice(-(TIMELINE_CONFIG.HISTORY_SIZE - 1)), packet];
    
    // Throttle React state updates to prevent UI freeze
    const elapsed = now - lastUpdateTime;
    
    if (elapsed >= 50) { // Update at most 20 times per second
      lastUpdateTime = now;
      set({
        currentPacket: isTimeTraveling ? get().currentPacket : pendingPacket,
        packetBuffer: pendingBuffer,
        packetHistory: pendingHistory,
        packetsReceived: get().packetsReceived + 1,
        lastPacketTime: now,
        timelineIndex: isTimeTraveling ? get().timelineIndex : Math.max(0, pendingHistory.length - 1),
      });
    } else if (!updateScheduled) {
      // Schedule an update for the next frame if one isn't already scheduled
      updateScheduled = true;
      requestAnimationFrame(() => {
        updateScheduled = false;
        if (pendingPacket) {
          const { isTimeTraveling: isTraveling } = get();
          set({
            currentPacket: isTraveling ? get().currentPacket : pendingPacket,
            packetBuffer: pendingBuffer,
            packetHistory: pendingHistory,
            packetsReceived: get().packetsReceived + 1,
            lastPacketTime: performance.now(),
            timelineIndex: isTraveling ? get().timelineIndex : Math.max(0, pendingHistory.length - 1),
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
    pendingHistory = [];
    set({
      currentPacket: null,
      packetBuffer: [],
      packetHistory: [],
      packetsReceived: 0,
      lastPacketTime: 0,
      isTimeTraveling: false,
      timelineIndex: 0,
    });
  },

  setTimeTraveling: (isTimeTraveling: boolean) => {
    if (!isTimeTraveling) {
      const { packetHistory } = get();
      const latestPacket = packetHistory[packetHistory.length - 1] ?? null;
      set({
        isTimeTraveling: false,
        currentPacket: latestPacket,
        timelineIndex: Math.max(0, packetHistory.length - 1),
      });
      return;
    }

    set({ isTimeTraveling: true });
  },

  setTimelineIndex: (index: number) => {
    const { packetHistory } = get();
    if (packetHistory.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(packetHistory.length - 1, index));
    const selectedPacket = packetHistory[clampedIndex];
    set({
      isTimeTraveling: true,
      timelineIndex: clampedIndex,
      currentPacket: selectedPacket,
    });
  },

  stepTimeline: (delta: number) => {
    const { timelineIndex } = get();
    get().setTimelineIndex(timelineIndex + delta);
  },

  resumeLive: () => {
    get().setTimeTraveling(false);
  },
});

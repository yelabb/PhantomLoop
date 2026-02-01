/**
 * UI State Slice
 * 
 * Manages global UI state like modals, preventing auto-navigation
 * when critical modals are open, and pausing stream processing.
 */

import type { StateCreator } from 'zustand';

export interface UISlice {
  // Modal state - blocks auto-navigation when a critical modal is open
  activeModal: string | null;
  
  // Pause state - when true, stream processing should be suspended
  isStreamPaused: boolean;
  
  // Actions
  openModal: (modalId: string) => void;
  closeModal: () => void;
  
  // Computed - check if navigation should be blocked
  isModalBlocking: () => boolean;
  
  // Stream pause/resume
  pauseStream: () => void;
  resumeStream: () => void;
}

export const createUISlice: StateCreator<
  UISlice,
  [],
  [],
  UISlice
> = (set, get) => ({
  activeModal: null,
  isStreamPaused: false,

  openModal: (modalId: string) => {
    set({ activeModal: modalId, isStreamPaused: true });
    console.log(`[UI] Modal opened: ${modalId}, stream paused`);
  },

  closeModal: () => {
    const current = get().activeModal;
    set({ activeModal: null, isStreamPaused: false });
    if (current) {
      console.log(`[UI] Modal closed: ${current}, stream resumed`);
    }
  },

  isModalBlocking: () => {
    return get().activeModal !== null;
  },
  
  pauseStream: () => {
    set({ isStreamPaused: true });
    console.log('[UI] Stream paused');
  },
  
  resumeStream: () => {
    set({ isStreamPaused: false });
    console.log('[UI] Stream resumed');
  },
});

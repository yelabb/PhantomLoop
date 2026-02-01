/**
 * UI State Slice
 * 
 * Manages global UI state like modals, preventing auto-navigation
 * when critical modals are open.
 */

import type { StateCreator } from 'zustand';

export interface UISlice {
  // Modal state - blocks auto-navigation when a critical modal is open
  activeModal: string | null;
  
  // Actions
  openModal: (modalId: string) => void;
  closeModal: () => void;
  
  // Computed - check if navigation should be blocked
  isModalBlocking: () => boolean;
}

export const createUISlice: StateCreator<
  UISlice,
  [],
  [],
  UISlice
> = (set, get) => ({
  activeModal: null,

  openModal: (modalId: string) => {
    set({ activeModal: modalId });
    console.log(`[UI] Modal opened: ${modalId}`);
  },

  closeModal: () => {
    const current = get().activeModal;
    set({ activeModal: null });
    if (current) {
      console.log(`[UI] Modal closed: ${current}`);
    }
  },

  isModalBlocking: () => {
    return get().activeModal !== null;
  },
});

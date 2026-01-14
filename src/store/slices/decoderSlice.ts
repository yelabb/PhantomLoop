// Decoder state slice - Optimized to separate high-frequency updates

import type { StateCreator } from 'zustand';
import type { Decoder, DecoderOutput } from '../../types/decoders';
import { clearHistory as clearTFJSHistory } from '../../decoders/tfjsInference';
import { clearDecoderCache } from '../../decoders/executeDecoder';

export interface DecoderSlice {
  activeDecoder: Decoder | null;
  decoderOutput: DecoderOutput | null;
  availableDecoders: Decoder[];
  isDecoderLoading: boolean;
  decoderLoadingMessage: string;
  
  setActiveDecoder: (decoder: Decoder | null) => void;
  updateDecoderOutput: (output: DecoderOutput) => void;
  registerDecoder: (decoder: Decoder) => void;
  setDecoderLoading: (isLoading: boolean, message?: string) => void;
  resetDecoder: () => void;
}

export const createDecoderSlice: StateCreator<
  DecoderSlice,
  [],
  [],
  DecoderSlice
> = (set, get) => ({
  activeDecoder: null,
  decoderOutput: null,
  availableDecoders: [],
  isDecoderLoading: false,
  decoderLoadingMessage: '',

  setActiveDecoder: (decoder: Decoder | null) => {
    console.log(`[PhantomLoop] Decoder changed:`, decoder?.name || 'None');
    set({ 
      activeDecoder: decoder,
      decoderOutput: null,
    });
  },

  updateDecoderOutput: (output: DecoderOutput) => {
    // Only update the output, don't touch activeDecoder
    set({ decoderOutput: output });
  },

  registerDecoder: (decoder: Decoder) => {
    const { availableDecoders } = get();
    
    // Check if decoder already exists
    const exists = availableDecoders.some(d => d.id === decoder.id);
    if (!exists) {
      set({ 
        availableDecoders: [...availableDecoders, decoder] 
      });
      console.log(`[PhantomLoop] Registered decoder: ${decoder.name}`);
    }
  },

  setDecoderLoading: (isLoading: boolean, message = '') => {
    set({ 
      isDecoderLoading: isLoading,
      decoderLoadingMessage: message,
    });
  },

  resetDecoder: () => {
    console.log('[PhantomLoop] 🧹 Resetting decoder state');
    console.log('[PhantomLoop] Previous activeDecoder:', get().activeDecoder?.name);
    
    // Clear all decoder-related caches
    clearTFJSHistory();
    clearDecoderCache();
    
    set({ 
      activeDecoder: null,
      decoderOutput: null,
      isDecoderLoading: false,
      decoderLoadingMessage: '',
    });
    
    console.log('[PhantomLoop] ✅ Decoder state reset complete');
  },
});

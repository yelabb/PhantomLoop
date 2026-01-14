// Decoder state slice

import type { StateCreator } from 'zustand';
import type { Decoder, DecoderOutput } from '../../types/decoders';

export interface DecoderSlice {
  activeDecoder: Decoder | null;
  decoderOutput: DecoderOutput | null;
  availableDecoders: Decoder[];
  isProcessing: boolean;
  
  setActiveDecoder: (decoder: Decoder | null) => void;
  updateDecoderOutput: (output: DecoderOutput) => void;
  registerDecoder: (decoder: Decoder) => void;
  setProcessing: (isProcessing: boolean) => void;
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
  isProcessing: false,

  setActiveDecoder: (decoder: Decoder | null) => {
    console.log(`[PhantomLoop] Decoder changed:`, decoder?.name || 'None');
    set({ 
      activeDecoder: decoder,
      decoderOutput: null, // Reset output when changing decoders
    });
  },

  updateDecoderOutput: (output: DecoderOutput) => {
    const { activeDecoder } = get();
    
    // Update decoder's latency metrics
    if (activeDecoder) {
      const avgLatency = activeDecoder.avgLatency || 0;
      const newAvgLatency = avgLatency === 0 
        ? output.latency 
        : (avgLatency * 0.9 + output.latency * 0.1); // Exponential moving average

      set({
        activeDecoder: {
          ...activeDecoder,
          avgLatency: newAvgLatency,
          lastLatency: output.latency,
        },
        decoderOutput: output,
      });
    } else {
      set({ decoderOutput: output });
    }
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

  setProcessing: (isProcessing: boolean) => {
    set({ isProcessing });
  },
});

// Decoder Selector Component - Memoized

import { memo, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { baselineDecoders } from '../decoders/baselines';

// Separate component for latency display to prevent full re-renders
const LatencyDisplay = memo(function LatencyDisplay() {
  // Use metrics slice for latency (updates frequently)
  const decoderLatency = useStore((state) => state.decoderLatency);
  
  if (decoderLatency === 0) return null;
  
  return (
    <p className="mt-2 font-mono">
      Latency: {decoderLatency.toFixed(2)}ms
    </p>
  );
});

export const DecoderSelector = memo(function DecoderSelector() {
  // Use individual selectors
  const activeDecoder = useStore((state) => state.activeDecoder);
  const availableDecoders = useStore((state) => state.availableDecoders);
  const setActiveDecoder = useStore((state) => state.setActiveDecoder);
  const registerDecoder = useStore((state) => state.registerDecoder);

  // Register baseline decoders on mount
  useEffect(() => {
    baselineDecoders.forEach(decoder => registerDecoder(decoder));
  }, [registerDecoder]);

  const handleDecoderChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const decoder = availableDecoders.find(d => d.id === e.target.value);
    setActiveDecoder(decoder || null);
  }, [availableDecoders, setActiveDecoder]);

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm p-4 rounded-lg border border-gray-700 w-80 pointer-events-auto">
      <h3 className="text-sm font-semibold text-white mb-3">Decoder</h3>
      
      <select
        value={activeDecoder?.id || ''}
        onChange={handleDecoderChange}
        className="w-full bg-gray-800 text-white px-3 py-2 rounded text-sm border border-gray-600 focus:border-loopback focus:outline-none cursor-pointer"
      >
        <option value="">None (Phantom only)</option>
        {availableDecoders.map(decoder => (
          <option key={decoder.id} value={decoder.id}>
            {decoder.name}
          </option>
        ))}
      </select>

      {activeDecoder && (
        <div className="mt-3 text-xs text-gray-400">
          <p className="font-medium text-loopback mb-1">{activeDecoder.name}</p>
          <p>{activeDecoder.description}</p>
        </div>
      )}
    </div>
  );
});

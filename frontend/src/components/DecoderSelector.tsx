// Decoder Selector Component

import { useEffect } from 'react';
import { useStore } from '../store';
import { baselineDecoders } from '../decoders/baselines';

export function DecoderSelector() {
  const { 
    activeDecoder, 
    availableDecoders, 
    setActiveDecoder, 
    registerDecoder 
  } = useStore();

  // Register baseline decoders on mount
  useEffect(() => {
    baselineDecoders.forEach(decoder => registerDecoder(decoder));
  }, [registerDecoder]);

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm p-4 rounded-lg border border-gray-700 w-80">
      <h3 className="text-sm font-semibold text-white mb-3">Decoder</h3>
      
      <select
        value={activeDecoder?.id || ''}
        onChange={(e) => {
          const decoder = availableDecoders.find(d => d.id === e.target.value);
          setActiveDecoder(decoder || null);
        }}
        className="w-full bg-gray-800 text-white px-3 py-2 rounded text-sm border border-gray-600 focus:border-loopback focus:outline-none"
      >
        <option value="">None (Phantom only)</option>
        {availableDecoders.map(decoder => (
          <option key={decoder.id} value={decoder.id}>
            {decoder.name}
            {decoder.avgLatency && ` (${decoder.avgLatency.toFixed(1)}ms)`}
          </option>
        ))}
      </select>

      {activeDecoder && (
        <div className="mt-3 text-xs text-gray-400">
          <p className="font-medium text-loopback mb-1">{activeDecoder.name}</p>
          <p>{activeDecoder.description}</p>
          {activeDecoder.lastLatency && (
            <p className="mt-2 font-mono">
              Last: {activeDecoder.lastLatency.toFixed(2)}ms
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Decoder Selector Component - Memoized

import { memo, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { allDecoders, getBackendInfo } from '../decoders';

// Separate component for latency display to prevent full re-renders
const LatencyDisplay = memo(function LatencyDisplay() {
  // Use metrics slice for latency (updates frequently)
  const decoderLatency = useStore((state) => state.decoderLatency);
  
  if (decoderLatency === 0) return null;
  
  const color = decoderLatency < 5 ? 'text-green-400' : 
                decoderLatency < 15 ? 'text-yellow-400' : 'text-red-400';
  
  return (
    <p className={`mt-2 font-mono text-xs ${color}`}>
      Latency: {decoderLatency.toFixed(2)}ms
    </p>
  );
});

// Backend indicator component
const BackendIndicator = memo(function BackendIndicator() {
  const info = getBackendInfo();
  
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`w-2 h-2 rounded-full ${info.isGPU ? 'bg-green-500' : 'bg-yellow-500'}`} />
      <span>TF.js: {info.name.toUpperCase()}</span>
    </div>
  );
});

export const DecoderSelector = memo(function DecoderSelector() {
  // Use individual selectors
  const activeDecoder = useStore((state) => state.activeDecoder);
  const availableDecoders = useStore((state) => state.availableDecoders);
  const setActiveDecoder = useStore((state) => state.setActiveDecoder);
  const registerDecoder = useStore((state) => state.registerDecoder);

  // Register all decoders (baselines + TFJS) on mount
  useEffect(() => {
    allDecoders.forEach(decoder => registerDecoder(decoder));
  }, [registerDecoder]);

  const handleDecoderChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const decoder = availableDecoders.find(d => d.id === e.target.value);
    setActiveDecoder(decoder || null);
  }, [availableDecoders, setActiveDecoder]);

  // Group decoders by type
  const tfjsDecoders = availableDecoders.filter(d => d.type === 'tfjs');
  const jsDecoders = availableDecoders.filter(d => d.type === 'javascript');

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm p-4 rounded-lg border border-gray-700 w-80 pointer-events-auto">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-white">Decoder</h3>
        <BackendIndicator />
      </div>
      
      <select
        value={activeDecoder?.id || ''}
        onChange={handleDecoderChange}
        className="w-full bg-gray-800 text-white px-3 py-2 rounded text-sm border border-gray-600 focus:border-loopback focus:outline-none cursor-pointer"
      >
        <option value="">None (Phantom only)</option>
        
        {tfjsDecoders.length > 0 && (
          <optgroup label="🧠 Neural Networks (TensorFlow.js)">
            {tfjsDecoders.map(decoder => (
              <option key={decoder.id} value={decoder.id}>
                {decoder.name}
              </option>
            ))}
          </optgroup>
        )}
        
        {jsDecoders.length > 0 && (
          <optgroup label="📜 JavaScript Baselines">
            {jsDecoders.map(decoder => (
              <option key={decoder.id} value={decoder.id}>
                {decoder.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {activeDecoder && (
        <div className="mt-3 text-xs text-gray-400">
          <p className="font-medium text-loopback mb-1">{activeDecoder.name}</p>
          <p>{activeDecoder.description}</p>
          
          {activeDecoder.architecture && (
            <p className="mt-1 font-mono text-gray-500">
              {activeDecoder.architecture}
            </p>
          )}
          
          {activeDecoder.params && (
            <p className="text-gray-500">
              {activeDecoder.params.toLocaleString()} parameters
            </p>
          )}
          
          <LatencyDisplay />
        </div>
      )}
    </div>
  );
});

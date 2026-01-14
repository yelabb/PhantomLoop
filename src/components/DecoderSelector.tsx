// Decoder Selector Component - Memoized with loading states

import { memo, useEffect, useCallback, useState } from 'react';
import { useStore } from '../store';
import { allDecoders, getBackendInfo, initModel } from '../decoders';
import { Spinner } from './LoadingStates';
import { AddDecoderModal } from './AddDecoderModal';
import type { Decoder } from '../types/decoders';

// Separate component for latency display to prevent full re-renders
const LatencyDisplay = memo(function LatencyDisplay() {
  const decoderLatency = useStore((state) => state.decoderLatency);
  
  if (decoderLatency === 0) return null;
  
  const color = decoderLatency < 5 ? 'text-green-400' : 
                decoderLatency < 15 ? 'text-yellow-400' : 'text-red-400';
  
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')} animate-pulse`} />
      <span className={`font-mono text-xs ${color}`}>
        {decoderLatency.toFixed(2)}ms
      </span>
    </div>
  );
});

// Backend indicator component
const BackendIndicator = memo(function BackendIndicator() {
  const info = getBackendInfo();
  
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`w-2 h-2 rounded-full ${info.isGPU ? 'bg-green-500' : 'bg-yellow-500'}`} />
      <span>{info.name.toUpperCase()}</span>
    </div>
  );
});

export const DecoderSelector = memo(function DecoderSelector() {
  const activeDecoder = useStore((state) => state.activeDecoder);
  const availableDecoders = useStore((state) => state.availableDecoders);
  const setActiveDecoder = useStore((state) => state.setActiveDecoder);
  const registerDecoder = useStore((state) => state.registerDecoder);
  const setDecoderLoading = useStore((state) => state.setDecoderLoading);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingName, setLoadingName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Register all decoders on mount
  useEffect(() => {
    allDecoders.forEach(decoder => registerDecoder(decoder));
  }, [registerDecoder]);

  const handleDecoderChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const decoder = availableDecoders.find(d => d.id === e.target.value) as Decoder | undefined;
    
    if (!decoder) {
      setActiveDecoder(null);
      return;
    }

    // For TFJS decoders (builtin, URL, or local), preload the model
    const needsLoading = decoder.type === 'tfjs' && (
      decoder.tfjsModelType || 
      decoder.modelUrl || 
      decoder.source?.type === 'builtin' ||
      decoder.source?.type === 'url' ||
      decoder.source?.type === 'local'
    );

    if (needsLoading) {
      // Set loading state BEFORE async work
      setIsLoading(true);
      setLoadingName(decoder.name);
      setDecoderLoading(true, decoder.name);
      
      try {
        // Use Web Worker to create/load model - this runs in a separate thread
        // so the main thread stays responsive and the loading UI shows
        await initModel(decoder);
        
        // Small delay for visual feedback after loading completes
        await new Promise(resolve => setTimeout(resolve, 200));
        
        setActiveDecoder(decoder);
      } catch (error) {
        console.error('[DecoderSelector] Failed to load model:', error);
      } finally {
        setIsLoading(false);
        setLoadingName('');
        setDecoderLoading(false);
      }
    } else {
      setActiveDecoder(decoder);
    }
  }, [availableDecoders, setActiveDecoder, setDecoderLoading]);

  // Group decoders by type and source
  const builtinDecoders = availableDecoders.filter(d => 
    d.type === 'tfjs' && (!d.source || d.source.type === 'builtin')
  );
  const customDecoders = availableDecoders.filter(d => 
    d.source?.type === 'url' || d.source?.type === 'local'
  );
  const jsDecoders = availableDecoders.filter(d => d.type === 'javascript');

  return (
    <div className="flex flex-col gap-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 scrollbar-thin">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-lg shadow-blue-500/50" />
          <span className="text-sm font-medium text-white">Active Decoder</span>
        </div>
        <BackendIndicator />
      </div>
      
      <div className="flex gap-3">
        <div className="relative flex-1">
          <select
            value={activeDecoder?.id || ''}
            onChange={handleDecoderChange}
            disabled={isLoading}
            className={`w-full bg-gray-800/80 text-white px-4 py-3 rounded-xl text-sm border border-gray-600/50 
              focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30
              cursor-pointer transition-all duration-200
              ${isLoading ? 'opacity-50 cursor-wait' : 'hover:border-gray-500'}`}
          >
            <option value="">None (Phantom only)</option>
            
            {builtinDecoders.length > 0 && (
              <optgroup label="🧠 Neural Networks">
                {builtinDecoders.map(decoder => (
                  <option key={decoder.id} value={decoder.id}>
                    {decoder.name}
                  </option>
                ))}
              </optgroup>
            )}

            {customDecoders.length > 0 && (
              <optgroup label="📦 Custom Models">
                {customDecoders.map(decoder => (
                  <option key={decoder.id} value={decoder.id}>
                    {decoder.name}
                  </option>
                ))}
              </optgroup>
            )}
            
            {jsDecoders.length > 0 && (
              <optgroup label="📜 Baselines">
                {jsDecoders.map(decoder => (
                  <option key={decoder.id} value={decoder.id}>
                    {decoder.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          
          {isLoading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Spinner size="sm" color="loopback" />
            </div>
          )}
        </div>

        {/* Add Custom Decoder Button */}
        <button
          onClick={() => setShowAddModal(!showAddModal)}
          disabled={isLoading}
          className="px-4 py-3 bg-gray-800 text-gray-400 hover:text-blue-400 rounded-xl text-sm font-bold border border-gray-600/50 
            hover:border-blue-500/50 transition-all duration-200 disabled:opacity-50"
          title="Add custom decoder from URL"
        >
          {showAddModal ? '−' : '+'}
        </button>
      </div>

      {/* Add Decoder Form - Inline */}
      {showAddModal && (
        <AddDecoderModal 
          isOpen={showAddModal} 
          onClose={() => setShowAddModal(false)} 
        />
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 animate-fade-in">
          <div className="flex items-center gap-3">
            <Spinner size="xs" color="loopback" />
            <span className="text-sm text-blue-400">Loading {loadingName}...</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">Initializing neural network model...</p>
        </div>
      )}

      {/* Active decoder info */}
      {activeDecoder && !isLoading && (
        <div className="p-4 rounded-xl bg-gray-800/50 border border-gray-700/30 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm text-white">{activeDecoder.name}</span>
            <div className="flex gap-2">
              {activeDecoder.source?.type && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-700/50 text-gray-400">
                  {activeDecoder.source.type}
                </span>
              )}
              {activeDecoder.type === 'tfjs' && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400">
                  Neural
                </span>
              )}
            </div>
          </div>
          
          <p className="text-sm text-gray-400 leading-relaxed">{activeDecoder.description}</p>
          
          {activeDecoder.architecture && (
            <p className="mt-3 font-mono text-xs text-gray-500 bg-gray-900/50 px-3 py-2 rounded-lg">
              {activeDecoder.architecture}
            </p>
          )}
          
          {activeDecoder.params && (
            <p className="text-xs text-gray-500 mt-2">
              {activeDecoder.params.toLocaleString()} parameters
            </p>
          )}
          
          <div className="mt-3 pt-3 border-t border-gray-700/30">
            <LatencyDisplay />
          </div>
        </div>
      )}
    </div>
  );
});

// Decoder Selector Component - Memoized with loading states

import { memo, useEffect, useCallback, useState } from 'react';
import { flushSync } from 'react-dom';
import { useStore } from '../store';
import { allDecoders, getBackendInfo, getModel } from '../decoders';
import { Spinner } from './LoadingStates';
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

    // For TFJS decoders, preload the model with loading state
    if (decoder.type === 'tfjs' && decoder.tfjsModelType) {
      // Use flushSync to FORCE React to render the loading state immediately
      // before the blocking TensorFlow.js model compilation happens
      flushSync(() => {
        setIsLoading(true);
        setLoadingName(decoder.name);
      });
      
      // Also update global loading state
      setDecoderLoading(true, decoder.name);
      
      // Wait for paint to complete
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve(undefined));
        });
      });
      
      try {
        // Preload the model (this compiles it - blocks the main thread)
        // kalman-neural uses MLP internally, so we map it
        const modelType = decoder.tfjsModelType === 'kalman-neural' ? 'mlp' : decoder.tfjsModelType;
        await getModel(modelType as 'linear' | 'mlp' | 'lstm' | 'attention');
        
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

  // Group decoders by type
  const tfjsDecoders = availableDecoders.filter(d => d.type === 'tfjs');
  const jsDecoders = availableDecoders.filter(d => d.type === 'javascript');

  return (
    <div className="glass-panel p-4 rounded-xl w-80 pointer-events-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-loopback animate-pulse" />
          <h3 className="text-sm font-semibold text-white">Decoder</h3>
        </div>
        <BackendIndicator />
      </div>
      
      <div className="relative">
        <select
          value={activeDecoder?.id || ''}
          onChange={handleDecoderChange}
          disabled={isLoading}
          className={`w-full bg-gray-800/80 text-white px-3 py-2.5 rounded-lg text-sm border border-gray-600/50 
            focus:border-loopback focus:outline-none focus:ring-1 focus:ring-loopback/50
            cursor-pointer transition-all duration-200
            ${isLoading ? 'opacity-50 cursor-wait' : 'hover:border-gray-500'}`}
        >
          <option value="">None (Phantom only)</option>
          
          {tfjsDecoders.length > 0 && (
            <optgroup label="🧠 Neural Networks">
              {tfjsDecoders.map(decoder => (
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
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="sm" color="loopback" />
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="mt-3 p-3 rounded-lg bg-loopback/10 border border-loopback/30 animate-fade-in">
          <div className="flex items-center gap-2">
            <Spinner size="xs" color="loopback" />
            <span className="text-xs text-loopback">Loading {loadingName}...</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Building neural network...</p>
        </div>
      )}

      {/* Active decoder info */}
      {activeDecoder && !isLoading && (
        <div className="mt-3 p-3 rounded-lg bg-gray-800/50 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm text-white">{activeDecoder.name}</span>
            {activeDecoder.type === 'tfjs' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-loopback/20 text-loopback">
                Neural
              </span>
            )}
          </div>
          
          <p className="text-xs text-gray-400 leading-relaxed">{activeDecoder.description}</p>
          
          {activeDecoder.architecture && (
            <p className="mt-2 font-mono text-xs text-gray-500 bg-gray-900/50 px-2 py-1 rounded">
              {activeDecoder.architecture}
            </p>
          )}
          
          {activeDecoder.params && (
            <p className="text-xs text-gray-500 mt-1">
              {activeDecoder.params.toLocaleString()} parameters
            </p>
          )}
          
          <LatencyDisplay />
        </div>
      )}
    </div>
  );
});

// Main Dashboard Overlay Component - Memoized with improved UI

import { memo } from 'react';
import { createPortal } from 'react-dom';
import { ConnectionStatus } from './ConnectionStatus';
import { SessionManager } from './SessionManager';
import { DecoderSelector } from './DecoderSelector';
import { VisualizationControls } from './VisualizationControls';
import { useStore } from '../store';
import { DecoderLoadingOverlay } from './LoadingStates';

// Minimal latency indicator for top bar
const LatencyIndicator = memo(function LatencyIndicator() {
  const totalLatency = useStore((state) => state.totalLatency);
  const isConnected = useStore((state) => state.isConnected);
  
  if (!isConnected) return null;
  
  const color = totalLatency < 30 ? 'bg-green-500' : 
                totalLatency < 50 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900/80 border border-gray-700/50">
      <div className={`w-2 h-2 rounded-full ${color} animate-pulse`} />
      <span className="text-xs font-mono text-gray-300">
        {totalLatency.toFixed(0)}ms
      </span>
    </div>
  );
});

// Global decoder loading overlay - uses portal for immediate rendering
const GlobalLoadingOverlay = memo(function GlobalLoadingOverlay() {
  const isDecoderLoading = useStore((state) => state.isDecoderLoading);
  const decoderLoadingMessage = useStore((state) => state.decoderLoadingMessage);
  
  // Use portal to render directly in document.body for guaranteed z-index
  if (!isDecoderLoading) return null;
  
  return createPortal(
    <DecoderLoadingOverlay 
      isVisible={isDecoderLoading} 
      decoderName={decoderLoadingMessage} 
    />,
    document.body
  );
});

export const Dashboard = memo(function Dashboard() {
  return (
    <>
      {/* Global loading overlay - renders via portal */}
      <GlobalLoadingOverlay />
      
      <div className="absolute inset-0 pointer-events-none z-50">
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-start justify-between">
          <div className="flex flex-col gap-1 pointer-events-auto animate-slide-down">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-phantom via-loopback to-biolink bg-clip-text text-transparent">
              PHANTOM LOOP
            </h1>
            <p className="text-xs text-gray-500 tracking-wider">NEURAL GAUNTLET ARENA</p>
          </div>
          
          <div className="flex items-center gap-3 pointer-events-auto">
            <LatencyIndicator />
            <ConnectionStatus />
          </div>
        </div>

        {/* Left Sidebar - Scrollable */}
        <div className="absolute top-24 left-4 bottom-16 flex flex-col gap-3 pointer-events-none overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin">
          <SessionManager />
          <DecoderSelector />
          <VisualizationControls />
        </div>
        
        {/* Bottom right - minimal keyboard hint */}
        <div className="absolute bottom-4 right-4 text-xs text-gray-600 pointer-events-none">
          <span className="opacity-50">Scroll to zoom • Drag to rotate</span>
        </div>
      </div>
    </>
  );
});

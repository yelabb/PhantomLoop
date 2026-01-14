// Research Dashboard - Optimized visualization for BCI researchers
// Clear at-a-glance decoder performance with deep drill-down capability

import { memo, useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CenterOutArena } from './visualization/CenterOutArena';
import { PerformanceRing } from './visualization/PerformanceRing';
import { AccuracyGauge } from './visualization/AccuracyGauge';
import { QuickStats } from './visualization/QuickStats';
import { ConnectionStatus } from './ConnectionStatus';
import { SessionManager } from './SessionManager';
import { DecoderSelector } from './DecoderSelector';
import { DecoderLoadingOverlay } from './LoadingStates';
import { useStore } from '../store';
import { createPortal } from 'react-dom';

// Status indicator badge
const StatusBadge = memo(function StatusBadge({
  status,
  label,
}: {
  status: 'good' | 'warning' | 'bad';
  label: string;
}) {
  const colors = {
    good: 'bg-green-500',
    warning: 'bg-yellow-500',
    bad: 'bg-red-500',
  };
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900/80 border border-gray-700/50">
      <motion.div
        className={`w-2 h-2 rounded-full ${colors[status]}`}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
      />
      <span className="text-xs font-medium text-gray-300">{label}</span>
    </div>
  );
});

// Main performance indicator - big and visible
const MainPerformanceDisplay = memo(function MainPerformanceDisplay() {
  const currentPacket = useStore((state) => state.currentPacket);
  const decoderOutput = useStore((state) => state.decoderOutput);
  const activeDecoder = useStore((state) => state.activeDecoder);
  const updateAccuracy = useStore((state) => state.updateAccuracy);
  
  // Calculate accuracy
  const { accuracy, error } = useMemo(() => {
    if (!currentPacket?.data?.kinematics || !decoderOutput) {
      return { accuracy: 0, error: 0 };
    }
    
    const { x: gtX, y: gtY } = currentPacket.data.kinematics;
    const { x: decX, y: decY } = decoderOutput;
    
    // Calculate normalized error (0-1, where 0 is perfect)
    const dist = Math.sqrt((gtX - decX) ** 2 + (gtY - decY) ** 2);
    const normalizedError = Math.min(dist / 200, 1);
    const acc = Math.max(0, 1 - normalizedError);
    
    return { accuracy: acc, error: normalizedError };
  }, [currentPacket?.data?.kinematics, decoderOutput]);
  
  // Update store with accuracy
  useEffect(() => {
    if (decoderOutput) {
      updateAccuracy(accuracy, error);
    }
  }, [accuracy, error, decoderOutput, updateAccuracy]);
  
  if (!activeDecoder) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-900/50 rounded-2xl border border-gray-700/50">
        <div className="text-4xl mb-4">🧠</div>
        <span className="text-lg font-semibold text-gray-400">Select a Decoder</span>
        <span className="text-sm text-gray-500 mt-1">to begin analysis</span>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center gap-6">
      <PerformanceRing
        accuracy={accuracy}
        error={error}
        size={180}
        showLabels
      />
      
      <div className="text-center">
        <span className="text-xs text-gray-500 uppercase tracking-wider">
          Decoder Performance
        </span>
      </div>
    </div>
  );
});

// Global decoder loading overlay
const GlobalLoadingOverlay = memo(function GlobalLoadingOverlay() {
  const isDecoderLoading = useStore((state) => state.isDecoderLoading);
  const decoderLoadingMessage = useStore((state) => state.decoderLoadingMessage);
  
  if (!isDecoderLoading) return null;
  
  return createPortal(
    <DecoderLoadingOverlay
      isVisible={isDecoderLoading}
      decoderName={decoderLoadingMessage}
    />,
    document.body
  );
});

// Collapsible panel
const CollapsiblePanel = memo(function CollapsiblePanel({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="dashboard-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          {title}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-gray-500 text-sm"
        >
          ▼
        </motion.span>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 pt-0">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export const ResearchDashboard = memo(function ResearchDashboard() {
  const isConnected = useStore((state) => state.isConnected);
  const totalLatency = useStore((state) => state.totalLatency);
  const currentAccuracy = useStore((state) => state.currentAccuracy);
  const currentError = useStore((state) => state.currentError);
  
  // Overall system status
  const systemStatus = useMemo(() => {
    if (!isConnected) return 'bad';
    if (totalLatency > 50) return 'bad';
    if (totalLatency > 30) return 'warning';
    return 'good';
  }, [isConnected, totalLatency]);
  
  return (
    <>
      <GlobalLoadingOverlay />
      
      {/* Full Dashboard Layout */}
      <div className="absolute inset-0 flex flex-col bg-gray-950 z-50">
        {/* Top Header Bar */}
        <header className="dashboard-header flex items-center justify-between shrink-0 pointer-events-auto">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-green-400 bg-clip-text text-transparent">
                PHANTOM LOOP
              </h1>
              <p className="text-[10px] text-gray-500 tracking-widest uppercase">
                BCI Decoder Analysis Platform
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <StatusBadge
              status={systemStatus}
              label={isConnected ? `${totalLatency.toFixed(0)}ms latency` : 'Offline'}
            />
            <ConnectionStatus />
          </div>
        </header>
        
        {/* Main Content Area */}
        <div className="flex flex-1 min-h-0 pointer-events-auto">
          {/* Left Sidebar - Controls */}
          <aside className="dashboard-sidebar w-80 shrink-0 overflow-y-auto scrollbar-hide">
            <CollapsiblePanel title="Session Control" defaultOpen={true}>
              <SessionManager />
            </CollapsiblePanel>
            
            <CollapsiblePanel title="Decoder Selection" defaultOpen={true}>
              <DecoderSelector />
            </CollapsiblePanel>
          </aside>
          
          {/* Center - Main Visualization */}
          <main className="flex-1 flex items-center justify-center p-6 min-w-0 bg-gray-900/30">
            <div className="dashboard-card p-6">
              <CenterOutArena />
            </div>
          </main>
          
          {/* Right Sidebar - Metrics */}
          <aside className="dashboard-sidebar w-96 shrink-0 overflow-y-auto scrollbar-hide">
            {/* Performance Overview Card */}
            <div className="dashboard-card p-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Performance Overview
              </h3>
              <div className="flex justify-center">
                <MainPerformanceDisplay />
              </div>
            </div>
            
            {/* Quick Stats Card */}
            <div className="dashboard-card p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Live Metrics
              </h3>
              <QuickStats />
            </div>
            
            {/* Accuracy History Card */}
            <div className="dashboard-card p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Accuracy History
              </h3>
              <AccuracyGauge
                accuracy={currentAccuracy}
                error={currentError}
                historyLength={60}
              />
            </div>
          </aside>
        </div>
        
        {/* Bottom Status Bar */}
        <footer className="px-6 py-3 bg-gray-950/90 border-t border-gray-800/50 flex items-center justify-between shrink-0 relative">
          {/* Legend */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
              <span className="text-xs text-gray-400">Ground Truth</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
              <span className="text-xs text-gray-400">Decoded</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border border-purple-500" />
              <span className="text-xs text-gray-400">Target</span>
            </div>
          </div>
          
          {/* Keyboard hints */}
          <div className="text-xs text-gray-500">
            <span>R: Reset • Space: Pause • V: View Mode</span>
          </div>
        </footer>
      </div>
    </>
  );
});

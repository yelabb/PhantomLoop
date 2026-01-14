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
import { DesyncAlert } from './DesyncAlert';
import { DecoderLoadingOverlay } from './LoadingStates';
import { useStore } from '../store';
import { createPortal } from 'react-dom';

// View mode toggle
type ViewMode = 'research' | 'minimal' | 'legacy';

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
    <div className="flex flex-col items-center gap-4">
      <PerformanceRing
        accuracy={accuracy}
        error={error}
        size={160}
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
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-3 hover:bg-gray-800/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {title}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-gray-500"
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
            <div className="p-3 pt-0">{children}</div>
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
      
      <div className="absolute inset-0 pointer-events-none z-50">
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-start justify-between">
          <div className="flex flex-col gap-1 pointer-events-auto animate-slide-down">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-green-400 bg-clip-text text-transparent">
              PHANTOM LOOP
            </h1>
            <p className="text-[10px] text-gray-500 tracking-wider uppercase">
              BCI Decoder Analysis
            </p>
          </div>
          
          <div className="flex items-center gap-3 pointer-events-auto">
            <StatusBadge
              status={systemStatus}
              label={isConnected ? `${totalLatency.toFixed(0)}ms` : 'Offline'}
            />
            <ConnectionStatus />
          </div>
        </div>
        
        {/* Main content area - Center */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <CenterOutArena />
          </div>
        </div>
        
        {/* Left Sidebar - Controls */}
        <div className="absolute top-20 left-4 bottom-16 w-72 flex flex-col gap-3 pointer-events-auto overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin">
          <CollapsiblePanel title="Session" defaultOpen={true}>
            <SessionManager />
          </CollapsiblePanel>
          
          <CollapsiblePanel title="Decoder" defaultOpen={true}>
            <DecoderSelector />
          </CollapsiblePanel>
        </div>
        
        {/* Right Sidebar - Metrics */}
        <div className="absolute top-20 right-4 bottom-16 w-80 flex flex-col gap-3 pointer-events-auto overflow-y-auto overflow-x-hidden pl-2 scrollbar-thin">
          {/* Main Performance Ring */}
          <div className="flex justify-center py-4">
            <MainPerformanceDisplay />
          </div>
          
          {/* Quick Stats */}
          <QuickStats />
          
          {/* Accuracy History */}
          <AccuracyGauge
            accuracy={currentAccuracy}
            error={currentError}
            historyLength={60}
          />
        </div>
        
        {/* Bottom Center - Desync Alert */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto">
          <DesyncAlert />
        </div>
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex items-center gap-4 pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
            <span className="text-[10px] text-gray-400">Ground Truth</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
            <span className="text-[10px] text-gray-400">Decoded</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border border-purple-500" />
            <span className="text-[10px] text-gray-400">Target</span>
          </div>
        </div>
        
        {/* Keyboard hints */}
        <div className="absolute bottom-4 right-4 text-[10px] text-gray-600 pointer-events-none">
          <span className="opacity-50">R: Reset • Space: Pause</span>
        </div>
      </div>
    </>
  );
});

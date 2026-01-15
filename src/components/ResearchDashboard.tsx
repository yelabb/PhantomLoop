// Research Dashboard - Optimized visualization for BCI researchers
// Clear at-a-glance decoder performance with deep drill-down capability

import { memo, useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CenterOutArena } from './visualization/CenterOutArena';
import { AccuracyGauge } from './visualization/AccuracyGauge';
import { QuickStats } from './visualization/QuickStats';
import { NeuronActivityGrid } from './visualization/NeuronActivityGrid';
import { NeuralWaterfall } from './visualization/NeuralWaterfall';
// Advanced Research Panels
import { NeuralDynamicsPanel } from './visualization/NeuralDynamicsPanel';
import { SpikeRasterPlot } from './visualization/SpikeRasterPlot';
import { PopulationDynamics } from './visualization/PopulationDynamics';
import { SpectralPowerPanel } from './visualization/SpectralPowerPanel';
import { NeuronCorrelationMatrix } from './visualization/NeuronCorrelationMatrix';
import { ConnectionStatus } from './ConnectionStatus';
import { PlaybackControls } from './PlaybackControls';
import { DecoderSelector } from './DecoderSelector';
import { TemporalInspector } from './TemporalInspector';
import { DecoderLoadingOverlay } from './LoadingStates';
import { DraggablePanel } from './DraggablePanel';
import { ResizablePanel } from './ResizablePanel';
import { useStore } from '../store';
import { createPortal } from 'react-dom';

// Panel types - Extended with new research panels
type PanelId = 'decoder' | 'temporal' | 'accuracy' | 'waterfall' | 'grid' | 'stats' 
  | 'dynamics' | 'raster' | 'manifold' | 'spectral' | 'correlation';

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
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/80 border border-gray-700/50">
      <motion.div
        className={`w-2 h-2`}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
        style={{ backgroundColor: colors[status] }}
      />
      <span className="text-xs font-medium text-gray-300">{label}</span>
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

export const ResearchDashboard = memo(function ResearchDashboard() {
  const isConnected = useStore((state) => state.isConnected);
  const totalLatency = useStore((state) => state.totalLatency);
  const currentAccuracy = useStore((state) => state.currentAccuracy);
  const currentError = useStore((state) => state.currentError);
  const currentPacket = useStore((state) => state.currentPacket);
  const decoderOutput = useStore((state) => state.decoderOutput);
  const updateAccuracy = useStore((state) => state.updateAccuracy);
  
  // Panel ordering state with localStorage persistence
  // Extended with new research panels for dream dashboard
  const allPanels: PanelId[] = [
    'decoder', 'temporal', 'accuracy', 'waterfall', 'grid', 'stats',
    'dynamics', 'raster', 'manifold', 'spectral', 'correlation'
  ];
  const [leftPanelOrder, setLeftPanelOrder] = useState<PanelId[]>(() => {
    const saved = localStorage.getItem('phantomloop-left-panels-v2');
    return saved ? JSON.parse(saved) : ['decoder', 'temporal', 'dynamics', 'raster'];
  });
  const [rightPanelOrder, setRightPanelOrder] = useState<PanelId[]>(() => {
    const saved = localStorage.getItem('phantomloop-right-panels-v2');
    return saved ? JSON.parse(saved) : ['accuracy', 'manifold', 'spectral', 'correlation', 'stats'];
  });
  const [lockedPanels, setLockedPanels] = useState<Set<PanelId>>(() => {
    const saved = localStorage.getItem('phantomloop-locked-panels');
    return saved ? new Set(JSON.parse(saved)) : new Set(allPanels);
  });
  const [draggedPanel, setDraggedPanel] = useState<PanelId | null>(null);
  const [dragSource, setDragSource] = useState<'left' | 'right' | null>(null);
  const [dragOverSidebar, setDragOverSidebar] = useState<'left' | 'right' | null>(null);
  
  // Persist panel orders to localStorage
  useEffect(() => {
    localStorage.setItem('phantomloop-left-panels-v2', JSON.stringify(leftPanelOrder));
  }, [leftPanelOrder]);
  
  useEffect(() => {
    localStorage.setItem('phantomloop-right-panels-v2', JSON.stringify(rightPanelOrder));
  }, [rightPanelOrder]);

  useEffect(() => {
    localStorage.setItem('phantomloop-locked-panels', JSON.stringify([...lockedPanels]));
  }, [lockedPanels]);

  const handleToggleLock = (panelId: PanelId) => {
    setLockedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(panelId)) {
        next.delete(panelId);
      } else {
        next.add(panelId);
      }
      return next;
    });
  };

  useEffect(() => {
    // Ensure all panels exist and balance between sidebars
    setLeftPanelOrder((left) => {
      const right = rightPanelOrder;
      const combined = new Set([...left, ...right]);
      const missing = allPanels.filter((panel) => !combined.has(panel));
      let nextLeft = [...left, ...missing];
      let nextRight = right.filter((panel) => allPanels.includes(panel));

      // Remove duplicates
      nextLeft = nextLeft.filter((panel, idx) => nextLeft.indexOf(panel) === idx);
      nextRight = nextRight.filter((panel, idx) => nextRight.indexOf(panel) === idx && !nextLeft.includes(panel));

      // Balance if one side is overloaded
      while (nextLeft.length - nextRight.length > 1) {
        const moved = nextLeft.pop();
        if (moved) nextRight.unshift(moved);
      }
      while (nextRight.length - nextLeft.length > 1) {
        const moved = nextRight.shift();
        if (moved) nextLeft.push(moved);
      }

      setRightPanelOrder(nextRight);
      return nextLeft;
    });
  }, []);
  
  // Calculate and update accuracy continuously
  useEffect(() => {
    if (!currentPacket?.data?.kinematics || !decoderOutput) {
      return;
    }
    
    const { x: gtX, y: gtY } = currentPacket.data.kinematics;
    const { x: decX, y: decY } = decoderOutput;
    
    // Exclude ANY sample where ANY coordinate is 0 or very close to 0 (initialization/missing data)
    // This is more aggressive but necessary to eliminate bias completely
    const threshold = 0.01; // Consider values < 0.01 as effectively zero
    const hasZeroCoordinate = Math.abs(gtX) < threshold || Math.abs(gtY) < threshold || 
                               Math.abs(decX) < threshold || Math.abs(decY) < threshold;
    
    if (hasZeroCoordinate) {
      // Track but don't include in metrics
      updateAccuracy(0, 1, false);
      return;
    }
    
    // Calculate normalized error (0-1, where 0 is perfect)
    const dist = Math.sqrt((gtX - decX) ** 2 + (gtY - decY) ** 2);
    const normalizedError = Math.min(dist / 200, 1);
    const accuracy = Math.max(0, 1 - normalizedError);
    
    updateAccuracy(accuracy, normalizedError, true);
  }, [currentPacket?.data?.kinematics, decoderOutput, updateAccuracy]);
  
  // Drag and drop handlers
  const handleDragStart = (panelId: PanelId, source: 'left' | 'right') => {
    setDraggedPanel(panelId);
    setDragSource(source);
  };

  const handleDragEnd = () => {
    setDraggedPanel(null);
    setDragSource(null);
    setDragOverSidebar(null);
  };

  const handleDrop = (targetPanelId: PanelId, targetSource: 'left' | 'right') => {
    if (!draggedPanel || !dragSource) return;

    // Get source and target arrays
    const sourceArray = dragSource === 'left' ? [...leftPanelOrder] : [...rightPanelOrder];
    const targetArray = targetSource === 'left' ? [...leftPanelOrder] : [...rightPanelOrder];

    // Remove from source
    const draggedIndex = sourceArray.indexOf(draggedPanel);
    sourceArray.splice(draggedIndex, 1);

    // Add to target
    const targetIndex = targetArray.indexOf(targetPanelId);
    if (dragSource === targetSource) {
      // Same sidebar - reorder
      const newArray = dragSource === 'left' ? [...leftPanelOrder] : [...rightPanelOrder];
      const dragIdx = newArray.indexOf(draggedPanel);
      const dropIdx = newArray.indexOf(targetPanelId);
      newArray.splice(dragIdx, 1);
      newArray.splice(dropIdx, 0, draggedPanel);
      
      if (dragSource === 'left') {
        setLeftPanelOrder(newArray);
      } else {
        setRightPanelOrder(newArray);
      }
    } else {
      // Different sidebar - move
      targetArray.splice(targetIndex, 0, draggedPanel);
      
      if (dragSource === 'left') {
        setLeftPanelOrder(sourceArray);
        setRightPanelOrder(targetArray);
      } else {
        setRightPanelOrder(sourceArray);
        setLeftPanelOrder(targetArray);
      }
    }
    
    setDragOverSidebar(null);
  };

  // Handle dropping on empty sidebar area
  const handleSidebarDrop = (targetSide: 'left' | 'right') => {
    if (!draggedPanel || !dragSource) return;
    
    if (dragSource === targetSide) {
      // Same sidebar, do nothing
      return;
    }

    // Remove from source
    const sourceArray = dragSource === 'left' ? [...leftPanelOrder] : [...rightPanelOrder];
    const targetArray = targetSide === 'left' ? [...leftPanelOrder] : [...rightPanelOrder];
    
    const draggedIndex = sourceArray.indexOf(draggedPanel);
    sourceArray.splice(draggedIndex, 1);
    
    // Add to end of target
    targetArray.push(draggedPanel);
    
    if (dragSource === 'left') {
      setLeftPanelOrder(sourceArray);
      setRightPanelOrder(targetArray);
    } else {
      setRightPanelOrder(sourceArray);
      setLeftPanelOrder(targetArray);
    }
    
    setDragOverSidebar(null);
  };

  // Panel content renderer - Extended with advanced research panels
  const renderPanelContent = (panelId: PanelId) => {
    switch (panelId) {
      case 'decoder':
        return <DecoderSelector />;
      case 'temporal':
        return <TemporalInspector />;
      case 'accuracy':
        return (
          <>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Accuracy History
            </h3>
            <AccuracyGauge accuracy={currentAccuracy} error={currentError} />
          </>
        );
      case 'waterfall':
        return (
          <>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Neural Waterfall
            </h3>
            <NeuralWaterfall width={330} height={150} maxNeurons={96} />
          </>
        );
      case 'grid':
        return <NeuronActivityGrid columns={12} maxNeurons={96} showLabels={true} />;
      case 'stats':
        return (
          <>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Live Metrics
            </h3>
            <QuickStats />
          </>
        );
      // Advanced Research Panels
      case 'dynamics':
        return <NeuralDynamicsPanel maxNeurons={96} showControls={true} />;
      case 'raster':
        return <SpikeRasterPlot maxNeurons={96} timeWindowMs={5000} />;
      case 'manifold':
        return <PopulationDynamics maxHistory={500} trailLength={100} />;
      case 'spectral':
        return <SpectralPowerPanel sampleRate={60} />;
      case 'correlation':
        return <NeuronCorrelationMatrix maxNeurons={32} windowSize={60} />;
    }
  };

  // Panel titles - Extended with research panel names
  const panelTitles: Record<PanelId, string> = {
    decoder: 'Decoder Selection',
    temporal: 'Temporal Inspector',
    accuracy: 'Accuracy History',
    waterfall: 'Neural Waterfall',
    grid: 'Neuron Activity Grid',
    stats: 'Live Metrics',
    // Advanced Research Panels
    dynamics: 'Neural Dynamics',
    raster: 'Spike Raster',
    manifold: 'Population Manifold',
    spectral: 'Spectral Analysis',
    correlation: 'Correlation Matrix',
  };

  // Panel help texts - Contextual explanations for each panel
  const panelHelpTexts: Record<PanelId, string> = {
    decoder: `Select a neural decoder to process incoming spike data.

• Neural Networks: TensorFlow.js models (LSTM, Dense, etc.) that predict cursor position from neural activity
• Baselines: Simple JavaScript decoders for comparison (PCA, linear regression)
• Custom Models: Load your own TensorFlow.js model from URL

The decoder latency shows real-time inference speed. GPU acceleration is used when available.`,
    
    temporal: `Time-travel debugging for neural data streams.

• Scrub through recorded packets to replay past neural activity
• Step frame-by-frame or jump ±1 second
• Set replay range to loop a specific segment
• Capture snapshots to compare decoder behavior at different times
• View realtime delta (Δ) between current position and live stream

Use this to analyze decoder errors at specific moments.`,
    
    accuracy: `Track decoder accuracy over time with a rolling sparkline.

• Green line: Accuracy (0-100%) based on distance between decoded and ground truth positions
• Error histogram: Distribution of errors over recent samples
• Samples with zero coordinates are excluded (initialization/missing data)

Higher accuracy = decoder predictions closer to actual cursor position.`,
    
    waterfall: `Scrolling heatmap of neural activity over time.

Each vertical column represents one time step. Each row represents one neuron. Color intensity shows spike count:
• Dark = no spikes
• Bright green = high firing rate

Useful for spotting patterns, oscillations, or bursts in population activity.`,
    
    grid: `GitHub-style contribution grid for neuron activity.

Each cell represents one neuron:
• Dark gray = inactive (0 spikes)
• Green shades = active (brighter = more spikes)

Quick overview of which neurons are currently firing and their relative activity levels.`,
    
    stats: `Real-time performance metrics at a glance.

• FPS: Visualization frame rate
• Network Latency: WebSocket round-trip time (ms)
• Decoder Latency: Neural network inference time (ms)
• Dropped Packets: Data transmission losses

Green = healthy, Yellow = warning, Red = critical.`,
    
    dynamics: `Advanced neural dynamics visualization with interactive controls.

• Pan and zoom to explore neural trajectories
• Toggle fullscreen for detailed analysis
• Shows temporal evolution of population neural activity
• Useful for identifying neural states and transitions`,
    
    raster: `Classic spike raster plot showing individual spike times.

• Each row = one neuron
• Each dot = one spike event
• Time flows left to right

Essential for visualizing precise spike timing patterns across the neural population. Click fullscreen for detailed analysis.`,
    
    manifold: `Neural population dynamics in reduced dimensionality space (PCA-style).

• Each point = one moment's population state
• Trail shows recent trajectory through neural state space
• Reveals low-dimensional structure in high-dimensional neural activity

Useful for identifying distinct neural states and transitions during movement.`,
    
    spectral: `Frequency band power analysis of neural signals.

Shows power in standard frequency bands:
• Delta (0.5-4 Hz): Slow oscillations
• Theta (4-8 Hz): Movement-related rhythms
• Alpha (8-13 Hz): Idle/attention states
• Beta (13-30 Hz): Motor planning
• Gamma (30-100 Hz): Active processing

Real-time spectrogram shows frequency content over time.`,
    
    correlation: `Cross-neuron correlation heatmap.

Shows functional connectivity between neuron pairs:
• Red = positive correlation (fire together)
• Blue = negative correlation (anti-correlated)
• Gray = no relationship

Reveals neural ensembles and functional groups. Hover for exact correlation values.`,
  };
  
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
        <header className="dashboard-header flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="PhantomLoop" 
                className="h-12 w-auto object-contain"
              />
              <p className="text-[10px] text-gray-500 tracking-wider uppercase">
                Neural Analysis Platform
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <StatusBadge
              status={systemStatus}
              label={isConnected ? `${totalLatency.toFixed(0)}ms` : 'Offline'}
            />
            <ConnectionStatus />
          </div>
        </header>
        
        {/* Main Content Area */}
        <div className="flex flex-1 min-h-0">
          {/* Left Sidebar - Controls */}
          <ResizablePanel 
            side="left" 
            defaultWidth={320} 
            minWidth={250} 
            maxWidth={500}
            onPanelDragOver={() => setDragOverSidebar('left')}
            onPanelDragLeave={() => setDragOverSidebar(null)}
            isDragTarget={dragOverSidebar === 'left' && dragSource !== 'left'}
          >
            {leftPanelOrder.map((panelId) => (
              <DraggablePanel
                key={panelId}
                id={panelId}
                title={panelTitles[panelId]}
                helpText={panelHelpTexts[panelId]}
                onDragStart={() => handleDragStart(panelId, 'left')}
                onDragEnd={handleDragEnd}
                onDrop={(targetId) => handleDrop(targetId as PanelId, 'left')}
                isDragging={draggedPanel === panelId}
                defaultOpen={true}
                isLocked={lockedPanels.has(panelId)}
                onToggleLock={(id) => handleToggleLock(id as PanelId)}
              >
                {renderPanelContent(panelId)}
              </DraggablePanel>
            ))}
          </ResizablePanel>
          
          {/* Center - Main Visualization */}
          <main className="flex-1 flex flex-col items-center justify-center p-6 min-w-0 bg-gray-900/50 gap-6 overflow-y-auto">
            <div className="dashboard-card p-6 flex flex-col items-center gap-6">
              <CenterOutArena />
              <div className="w-full flex justify-center">
                <PlaybackControls />
              </div>
            </div>
          </main>
          
          {/* Right Sidebar - Metrics */}
          <ResizablePanel 
            side="right" 
            defaultWidth={384} 
            minWidth={300} 
            maxWidth={600}
            onPanelDragOver={() => setDragOverSidebar('right')}
            onPanelDragLeave={() => setDragOverSidebar(null)}
            isDragTarget={dragOverSidebar === 'right' && dragSource !== 'right'}
          >
            {rightPanelOrder.map((panelId) => (
              <DraggablePanel
                key={panelId}
                id={panelId}
                title={panelTitles[panelId]}
                helpText={panelHelpTexts[panelId]}
                onDragStart={() => handleDragStart(panelId, 'right')}
                onDragEnd={handleDragEnd}
                onDrop={(targetId) => handleDrop(targetId as PanelId, 'right')}
                isDragging={draggedPanel === panelId}
                defaultOpen={true}
                isLocked={lockedPanels.has(panelId)}
                onToggleLock={(id) => handleToggleLock(id as PanelId)}
              >
                {renderPanelContent(panelId)}
              </DraggablePanel>
            ))}
            
            {/* Drop zone for empty area */}
            {draggedPanel && dragSource === 'left' && (
              <div
                className="min-h-[100px] flex items-center justify-center border-2 border-dashed border-blue-500/50 rounded bg-blue-500/5 text-blue-400 text-sm"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverSidebar('right');
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleSidebarDrop('right');
                }}
              >
                Drop panel here
              </div>
            )}
          </ResizablePanel>
        </div>
        
        {/* Bottom Status Bar */}
        <footer className="px-6 py-3 bg-gray-950 border-t border-gray-800/70 flex items-center justify-between shrink-0">
          {/* Legend */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500" />
              <span className="text-xs text-gray-400">Ground Truth</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500" />
              <span className="text-xs text-gray-400">Decoded</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border border-purple-500" />
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

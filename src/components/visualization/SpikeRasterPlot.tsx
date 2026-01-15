// Spike Raster Plot - Essential for neural researchers
// Shows individual spike times across neurons over time

import { memo, useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useStore } from '../../store';

interface SpikeRasterPlotProps {
  maxNeurons?: number;
  timeWindowMs?: number;
}

// Fullscreen portal wrapper
const FullscreenPortal = memo(function FullscreenPortal({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col"
    >
      {children}
    </motion.div>,
    document.body
  );
});

// Control button component
const ControlButton = memo(function ControlButton({
  onClick,
  title,
  children,
  active = false,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-all text-xs ${
        active 
          ? 'bg-phantom/30 text-phantom border border-phantom/50' 
          : 'bg-gray-800/80 hover:bg-gray-700/80 text-gray-400 hover:text-white border border-gray-700/50'
      }`}
    >
      {children}
    </button>
  );
});

interface SpikeEvent {
  neuronId: number;
  timestamp: number;
  count: number;
}

export const SpikeRasterPlot = memo(function SpikeRasterPlot({
  maxNeurons = 96,
  timeWindowMs = 5000,
}: SpikeRasterPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentPacket = useStore((state) => state.currentPacket);
  
  // Spike history buffer
  const spikeHistoryRef = useRef<SpikeEvent[]>([]);
  const timestampRef = useRef(0);
  
  // View state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [selectedNeuron, setSelectedNeuron] = useState<number | null>(null);
  const [spikeStyle, setSpikeStyle] = useState<'dots' | 'lines' | 'ticks'>('dots');
  const [colorByRate, setColorByRate] = useState(true);
  const [displayStats, setDisplayStats] = useState({ uniqueNeurons: 0, totalSpikes: 0, avgRate: 0 });
  
  // Get dimensions
  const getCanvasDimensions = useCallback(() => {
    if (isFullscreen) {
      return { width: window.innerWidth - 100, height: window.innerHeight - 150 };
    }
    return { width: 400, height: 250 };
  }, [isFullscreen]);
  
  const { width, height } = getCanvasDimensions();
  
  // Update spike history
  useEffect(() => {
    if (!currentPacket || isPaused) return;
    
    const spikes = currentPacket.data?.spikes?.spike_counts || [];
    if (spikes.length === 0) return;
    
    const now = timestampRef.current++;
    
    // Add spike events for neurons that fired
    for (let i = 0; i < Math.min(spikes.length, maxNeurons); i++) {
      if (spikes[i] > 0) {
        spikeHistoryRef.current.push({
          neuronId: i,
          timestamp: now,
          count: spikes[i],
        });
      }
    }
    
    // Remove old spikes (keep ~5 seconds at 60fps)
    const maxTimesteps = Math.floor((timeWindowMs / 1000) * 60);
    const cutoff = now - maxTimesteps;
    spikeHistoryRef.current = spikeHistoryRef.current.filter(s => s.timestamp > cutoff);
  }, [currentPacket, maxNeurons, timeWindowMs, isPaused]);
  
  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const spikes = spikeHistoryRef.current;
    const now = timestampRef.current;
    const maxTimesteps = Math.floor((timeWindowMs / 1000) * 60);
    
    // Clear background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    // Update stats for display
    const uniqueNeurons = new Set(spikes.map(s => s.neuronId)).size;
    const totalSpikesCount = spikes.length;
    const avgRateCalc = spikes.length > 0 
      ? spikes.reduce((sum, s) => sum + s.count, 0) / spikes.length 
      : 0;
    setDisplayStats({ uniqueNeurons, totalSpikes: totalSpikesCount, avgRate: avgRateCalc });
    
    if (spikes.length === 0) {
      ctx.fillStyle = '#4b5563';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for spikes...', width / 2, height / 2);
      return;
    }
    
    // Save context for transforms
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);
    
    const plotWidth = width / zoom - 60;
    const plotHeight = height / zoom - 30;
    const plotLeft = 50;
    const plotTop = 10;
    
    // Draw background grid
    ctx.strokeStyle = 'rgba(75, 85, 99, 0.2)';
    ctx.lineWidth = 0.5 / zoom;
    
    // Horizontal lines every 10 neurons
    for (let n = 0; n <= maxNeurons; n += 10) {
      const y = plotTop + (n / maxNeurons) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotLeft + plotWidth, y);
      ctx.stroke();
    }
    
    // Vertical lines every second
    for (let t = 0; t <= timeWindowMs; t += 1000) {
      const x = plotLeft + (1 - t / timeWindowMs) * plotWidth;
      ctx.beginPath();
      ctx.moveTo(x, plotTop);
      ctx.lineTo(x, plotTop + plotHeight);
      ctx.stroke();
    }
    
    // Draw axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = `${10 / zoom}px monospace`;
    ctx.textAlign = 'right';
    
    for (let n = 0; n <= maxNeurons; n += 20) {
      const y = plotTop + (n / maxNeurons) * plotHeight + 3 / zoom;
      ctx.fillText(`N${n}`, plotLeft - 5 / zoom, y);
    }
    
    ctx.textAlign = 'center';
    for (let t = 0; t <= timeWindowMs; t += 1000) {
      const x = plotLeft + (1 - t / timeWindowMs) * plotWidth;
      const label = t === 0 ? 'now' : `-${t / 1000}s`;
      ctx.fillText(label, x, plotTop + plotHeight + 15 / zoom);
    }
    
    // Calculate max spike count for color normalization
    const maxCount = Math.max(...spikes.map(s => s.count), 1);
    
    // Draw spikes
    spikes.forEach(spike => {
      const age = now - spike.timestamp;
      const x = plotLeft + (1 - age / maxTimesteps) * plotWidth;
      const y = plotTop + (spike.neuronId / maxNeurons) * plotHeight;
      
      // Color based on spike count or fixed
      let color: string;
      if (colorByRate) {
        const intensity = spike.count / maxCount;
        const hue = 120 - intensity * 120; // Green to red
        color = `hsl(${hue}, 80%, ${50 + intensity * 30}%)`;
      } else {
        color = '#22c55e';
      }
      
      // Highlight selected neuron
      if (selectedNeuron !== null && spike.neuronId === selectedNeuron) {
        color = '#a855f7';
      }
      
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      
      const spikeHeight = plotHeight / maxNeurons;
      
      switch (spikeStyle) {
        case 'dots':
          ctx.beginPath();
          ctx.arc(x, y + spikeHeight / 2, Math.max(1.5 / zoom, spike.count * 0.5 / zoom), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'lines':
          ctx.lineWidth = Math.max(1 / zoom, spike.count * 0.3 / zoom);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + spikeHeight);
          ctx.stroke();
          break;
        case 'ticks':
          ctx.lineWidth = 1 / zoom;
          ctx.beginPath();
          ctx.moveTo(x, y + spikeHeight * 0.2);
          ctx.lineTo(x, y + spikeHeight * 0.8);
          ctx.stroke();
          break;
      }
    });
    
    // Highlight selected neuron row
    if (selectedNeuron !== null) {
      const y = plotTop + (selectedNeuron / maxNeurons) * plotHeight;
      ctx.fillStyle = 'rgba(168, 85, 247, 0.1)';
      ctx.fillRect(plotLeft, y, plotWidth, plotHeight / maxNeurons);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1 / zoom;
      ctx.strokeRect(plotLeft, y, plotWidth, plotHeight / maxNeurons);
    }
    
    ctx.restore();
    
  }, [currentPacket, width, height, maxNeurons, timeWindowMs, zoom, panOffset, spikeStyle, colorByRate, selectedNeuron, isPaused]);
  
  // Mouse handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(Math.max(z * delta, 0.5), 10));
  }, []);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, []);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setPanOffset(p => ({ x: p.x + dx, y: p.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
    
    // Update selected neuron on hover
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const plotTop = 10 * zoom + panOffset.y;
      const plotHeight = (height - 30) / zoom * zoom;
      const y = e.clientY - rect.top - plotTop;
      const neuronIdx = Math.floor((y / plotHeight) * maxNeurons);
      if (neuronIdx >= 0 && neuronIdx < maxNeurons) {
        setSelectedNeuron(neuronIdx);
      }
    }
  }, [isPanning, lastMousePos, panOffset, zoom, height, maxNeurons]);
  
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setSelectedNeuron(null);
  }, []);
  
  const resetView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);
  
  const { uniqueNeurons, totalSpikes, avgRate } = displayStats;
  
  // Toolbar JSX
  const toolbarContent = (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Zoom controls */}
      <div className="flex items-center gap-1 border-r border-gray-700/50 pr-2">
        <ControlButton onClick={() => setZoom(z => Math.min(z * 1.2, 10))} title="Zoom In">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </ControlButton>
        <ControlButton onClick={() => setZoom(z => Math.max(z * 0.8, 0.5))} title="Zoom Out">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
        </ControlButton>
        <span className="text-[10px] text-gray-500 font-mono w-10 text-center">{(zoom * 100).toFixed(0)}%</span>
        <ControlButton onClick={resetView} title="Reset View">
          ⟲
        </ControlButton>
      </div>
      
      {/* Play/Pause */}
      <ControlButton onClick={() => setIsPaused(!isPaused)} title={isPaused ? 'Resume' : 'Pause'} active={isPaused}>
        {isPaused ? '▶' : '⏸'}
      </ControlButton>
      
      {/* Spike style */}
      <div className="flex items-center gap-1 border-l border-gray-700/50 pl-2">
        <ControlButton onClick={() => setSpikeStyle('dots')} title="Dots" active={spikeStyle === 'dots'}>
          ●
        </ControlButton>
        <ControlButton onClick={() => setSpikeStyle('lines')} title="Lines" active={spikeStyle === 'lines'}>
          │
        </ControlButton>
        <ControlButton onClick={() => setSpikeStyle('ticks')} title="Ticks" active={spikeStyle === 'ticks'}>
          ┃
        </ControlButton>
      </div>
      
      {/* Color by rate toggle */}
      <ControlButton onClick={() => setColorByRate(!colorByRate)} title="Color by firing rate" active={colorByRate}>
        🌈
      </ControlButton>
      
      {/* Fullscreen */}
      <div className="border-l border-gray-700/50 pl-2">
        <ControlButton onClick={() => setIsFullscreen(!isFullscreen)} title="Fullscreen">
          ⛶
        </ControlButton>
      </div>
    </div>
  );
  
  // Stats display JSX
  const statsContent = (
    <div className="flex items-center gap-4 text-[10px] text-gray-400">
      <div className="flex flex-col items-end">
        <span className="text-gray-500 uppercase">Active</span>
        <span className="font-mono font-bold text-green-400">{uniqueNeurons}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-gray-500 uppercase">Spikes</span>
        <span className="font-mono font-bold text-blue-400">{totalSpikes}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-gray-500 uppercase">Avg</span>
        <span className="font-mono font-bold text-purple-400">{avgRate.toFixed(1)} Hz</span>
      </div>
      {selectedNeuron !== null && (
        <div className="flex flex-col items-end border-l border-gray-700/50 pl-4">
          <span className="text-gray-500 uppercase">Selected</span>
          <span className="font-mono font-bold text-phantom">N{selectedNeuron}</span>
        </div>
      )}
    </div>
  );
  
  // Canvas container JSX
  const canvasContent = (
    <div 
      ref={containerRef}
      className="relative overflow-hidden bg-gray-950 border border-gray-700/50 rounded cursor-crosshair"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block"
      />
      
      {isPaused && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-[10px] font-mono">
          PAUSED
        </div>
      )}
    </div>
  );
  
  return (
    <>
      {/* Normal view */}
      <div className={`flex flex-col gap-2 ${isFullscreen ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Spike Raster
          </h3>
          {toolbarContent}
        </div>
        {canvasContent}
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-mono text-gray-500">
            {timeWindowMs / 1000}s window
          </span>
          {statsContent}
        </div>
      </div>
      
      {/* Fullscreen view */}
      <AnimatePresence>
        <FullscreenPortal isOpen={isFullscreen} onClose={() => setIsFullscreen(false)}>
          <div className="flex-1 flex flex-col p-6 gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-white">Spike Raster Analysis</h2>
                {statsContent}
              </div>
              {toolbarContent}
            </div>
            
            <div className="flex-1 flex items-center justify-center">
              <div 
                className="relative overflow-hidden bg-gray-950 border border-gray-700/50 rounded cursor-crosshair"
                style={{ width, height }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
              >
                <canvas
                  ref={canvasRef}
                  width={width}
                  height={height}
                  className="block"
                />
                
                {isPaused && (
                  <div className="absolute top-4 right-4 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-sm font-mono">
                    ⏸ PAUSED
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between text-gray-500 text-sm">
              <span className="font-mono">{timeWindowMs / 1000}s time window • {maxNeurons} neurons</span>
              <span className="text-xs text-gray-600">
                Scroll to zoom • Drag to pan • ESC to exit
              </span>
            </div>
          </div>
        </FullscreenPortal>
      </AnimatePresence>
    </>
  );
});

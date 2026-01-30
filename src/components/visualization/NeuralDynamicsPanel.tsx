// Neural Dynamics Panel - Advanced visualization with zoom, pan, fullscreen
// Dream dashboard component for Neuralink researchers

import { memo, useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useStore } from '../../store';

interface NeuralDynamicsPanelProps {
  maxNeurons?: number;
  showControls?: boolean;
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

export const NeuralDynamicsPanel = memo(function NeuralDynamicsPanel({
  maxNeurons = 96,
  showControls = true,
}: NeuralDynamicsPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentPacket = useStore((state) => state.currentPacket);
  
  // History buffer for temporal data
  const historyRef = useRef<number[][]>([]);
  const maxHistory = 300; // ~5 seconds at 60fps
  
  // View state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [colorMode, setColorMode] = useState<'green' | 'thermal' | 'rainbow'>('green');
  const [isPaused, setIsPaused] = useState(false);
  const [selectedNeuron, setSelectedNeuron] = useState<number | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [displayStats, setDisplayStats] = useState({ activeNeurons: 0, avgRate: 0, peakRate: 0 });
  
  // Get dimensions
  const getCanvasDimensions = useCallback(() => {
    if (isFullscreen) {
      return { width: window.innerWidth - 100, height: window.innerHeight - 150 };
    }
    return { width: 400, height: 200 };
  }, [isFullscreen]);
  
  const { width, height } = getCanvasDimensions();
  
  // Color schemes
  const getColor = useCallback((intensity: number, neuronIdx: number): string => {
    intensity = Math.min(Math.max(intensity, 0), 1);
    
    switch (colorMode) {
      case 'thermal': {
        // Black -> Red -> Yellow -> White
        if (intensity < 0.33) {
          const t = intensity / 0.33;
          return `rgb(${Math.floor(t * 255)}, 0, 0)`;
        } else if (intensity < 0.66) {
          const t = (intensity - 0.33) / 0.33;
          return `rgb(255, ${Math.floor(t * 255)}, 0)`;
        } else {
          const t = (intensity - 0.66) / 0.34;
          return `rgb(255, 255, ${Math.floor(t * 255)})`;
        }
      }
      case 'rainbow': {
        // Rainbow based on neuron index + intensity
        const hue = (neuronIdx / maxNeurons) * 360;
        const lightness = 20 + intensity * 60;
        return `hsl(${hue}, 80%, ${lightness}%)`;
      }
      default: {
        // Matrix green
        const r = Math.floor(intensity * 180);
        const g = Math.floor(50 + intensity * 205);
        const b = Math.floor(intensity * 180);
        return `rgb(${r}, ${g}, ${b})`;
      }
    }
  }, [colorMode, maxNeurons]);
  
  // Update history and render
  useEffect(() => {
    if (!currentPacket || isPaused) return;
    
    const spikes = currentPacket.data?.spikes?.spike_counts || [];
    if (spikes.length === 0) return;
    
    // Add to history
    historyRef.current.push([...spikes.slice(0, maxNeurons)]);
    if (historyRef.current.length > maxHistory) {
      historyRef.current.shift();
    }
  }, [currentPacket, maxNeurons, isPaused]);
  
  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const history = historyRef.current;
    if (history.length === 0) {
      // Draw placeholder
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#4b5563';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for neural data...', width / 2, height / 2);
      return;
    }
    
    // Calculate display parameters with zoom and pan
    
    // Clear and fill background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, width, height);
    
    // Save context for transforms
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);
    
    // Draw heatmap
    const maxSpike = 5; // Normalization factor
    
    for (let t = 0; t < history.length; t++) {
      const timeSlice = history[t];
      const x = (t / history.length) * (width / zoom);
      
      for (let n = 0; n < Math.min(timeSlice.length, maxNeurons); n++) {
        const intensity = Math.min(timeSlice[n] / maxSpike, 1);
        if (intensity > 0) {
          ctx.fillStyle = getColor(intensity, n);
          const y = (n / maxNeurons) * (height / zoom);
          const h = (height / zoom) / maxNeurons;
          ctx.fillRect(x, y, (width / zoom) / history.length + 0.5, h + 0.5);
        }
      }
    }
    
    // Update frame count for display
    setFrameCount(history.length);
    
    // Update stats for display
    if (history.length > 0) {
      const latest = history[history.length - 1] || [];
      const activeNeurons = latest.filter(s => s > 0).length;
      const avgRate = latest.length > 0 ? latest.reduce((a, b) => a + b, 0) / latest.length : 0;
      const peakRate = Math.max(...latest, 0);
      setDisplayStats({ activeNeurons, avgRate, peakRate });
    }
    
    // Draw grid overlay
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 0.5 / zoom;
      
      // Horizontal lines every 10 neurons
      for (let n = 0; n < maxNeurons; n += 10) {
        const y = (n / maxNeurons) * (height / zoom);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width / zoom, y);
        ctx.stroke();
      }
      
      // Vertical lines every 50 time steps
      for (let t = 0; t < history.length; t += 50) {
        const x = (t / history.length) * (width / zoom);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height / zoom);
        ctx.stroke();
      }
    }
    
    // Highlight selected neuron
    if (selectedNeuron !== null) {
      const y = (selectedNeuron / maxNeurons) * (height / zoom);
      const h = (height / zoom) / maxNeurons;
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2 / zoom;
      ctx.strokeRect(0, y, width / zoom, h);
    }
    
    ctx.restore();
    
  }, [currentPacket, width, height, maxNeurons, zoom, panOffset, colorMode, showGrid, selectedNeuron, getColor, isPaused]);
  
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
      const y = (e.clientY - rect.top - panOffset.y) / zoom;
      const neuronIdx = Math.floor((y / (height / zoom)) * maxNeurons);
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
  
  const { activeNeurons, avgRate, peakRate } = displayStats;
  
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
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 20l6.5-6.5M20 4l-6.5 6.5" />
          </svg>
        </ControlButton>
      </div>
      
      {/* Play/Pause */}
      <ControlButton onClick={() => setIsPaused(!isPaused)} title={isPaused ? 'Resume' : 'Pause'} active={isPaused}>
        {isPaused ? (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        )}
      </ControlButton>
      
      {/* Grid toggle */}
      <ControlButton onClick={() => setShowGrid(!showGrid)} title="Toggle Grid" active={showGrid}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
      </ControlButton>
      
      {/* Color mode selector */}
      <div className="flex items-center gap-1 border-l border-gray-700/50 pl-2">
        <ControlButton onClick={() => setColorMode('green')} title="Matrix Green" active={colorMode === 'green'}>
          <div className="w-3 h-3 rounded-sm bg-green-500" />
        </ControlButton>
        <ControlButton onClick={() => setColorMode('thermal')} title="Thermal" active={colorMode === 'thermal'}>
          <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-red-700 via-yellow-500 to-white" />
        </ControlButton>
        <ControlButton onClick={() => setColorMode('rainbow')} title="Rainbow" active={colorMode === 'rainbow'}>
          <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-red-500 via-green-500 to-blue-500" />
        </ControlButton>
      </div>
      
      {/* Fullscreen toggle */}
      <div className="border-l border-gray-700/50 pl-2">
        <ControlButton onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
          {isFullscreen ? (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </ControlButton>
      </div>
    </div>
  );
  
  // Stats display JSX
  const statsContent = (
    <div className="flex items-center gap-4 text-[10px] text-gray-400">
      <div className="flex flex-col items-end">
        <span className="text-gray-500 uppercase">Active</span>
        <span className="font-mono font-bold text-green-400">{activeNeurons}/{maxNeurons}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-gray-500 uppercase">Avg Rate</span>
        <span className="font-mono font-bold text-purple-400">{avgRate.toFixed(1)} Hz</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-gray-500 uppercase">Peak</span>
        <span className="font-mono font-bold text-yellow-400">{peakRate.toFixed(0)} Hz</span>
      </div>
      {selectedNeuron !== null && (
        <div className="flex flex-col items-end border-l border-gray-700/50 pl-4">
          <span className="text-gray-500 uppercase">Selected</span>
          <span className="font-mono font-bold text-phantom">Neuron #{selectedNeuron}</span>
        </div>
      )}
    </div>
  );
  
  // Main canvas container JSX
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
        style={{ imageRendering: 'pixelated' }}
      />
      
      {/* Neuron axis labels */}
      <div className="absolute top-0 left-0 h-full flex flex-col justify-between py-2 px-1 pointer-events-none">
        <span className="text-[8px] text-gray-500 font-mono">N0</span>
        <span className="text-[8px] text-gray-500 font-mono">N{maxNeurons}</span>
      </div>
      
      {/* Time axis labels */}
      <div className="absolute bottom-0 left-0 w-full flex justify-between px-2 py-1 pointer-events-none">
        <span className="text-[8px] text-gray-500 font-mono">-{(frameCount / 60).toFixed(1)}s</span>
        <span className="text-[8px] text-gray-500 font-mono">now</span>
      </div>
      
      {/* Status indicator */}
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
      {!isFullscreen && (
      <div className="flex flex-col gap-2">
        {showControls && (
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Neural Dynamics
            </h3>
            {toolbarContent}
          </div>
        )}
        {canvasContent}
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-mono text-gray-500">
            {frameCount} frames • {colorMode} colormap
          </span>
          {statsContent}
        </div>
      </div>
      )}
      
      {/* Fullscreen view */}
      <AnimatePresence>
        <FullscreenPortal isOpen={isFullscreen} onClose={() => setIsFullscreen(false)}>
          <div className="flex-1 flex flex-col p-6 gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-white">Neural Dynamics Analysis</h2>
                {statsContent}
              </div>
              <div className="flex items-center gap-4">
                {toolbarContent}
              </div>
            </div>
            
            {/* Main canvas - takes most of the space */}
            <div className="flex-1 flex items-center justify-center">
              <div 
                className="relative overflow-hidden bg-gray-950 border border-gray-700/50 rounded cursor-crosshair"
                style={{ width: width, height: height }}
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
                  style={{ imageRendering: 'pixelated' }}
                />
                
                {/* Neuron axis */}
                <div className="absolute top-0 left-0 h-full flex flex-col justify-between py-4 px-2 pointer-events-none">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className="text-[10px] text-gray-400 font-mono">
                      N{Math.floor((i / 4) * maxNeurons)}
                    </span>
                  ))}
                </div>
                
                {/* Status */}
                {isPaused && (
                  <div className="absolute top-4 right-4 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-sm font-mono">
                    ⏸ PAUSED
                  </div>
                )}
              </div>
            </div>
            
            {/* Footer info */}
            <div className="flex items-center justify-between text-gray-500 text-sm">
              <div className="flex items-center gap-4">
                <span className="font-mono">{frameCount} frames</span>
                <span>•</span>
                <span className="font-mono">{maxNeurons} neurons</span>
                <span>•</span>
                <span className="capitalize">{colorMode} colormap</span>
              </div>
              <div className="text-xs text-gray-600">
                Scroll to zoom • Drag to pan • Hover to select neuron • ESC to exit
              </div>
            </div>
          </div>
        </FullscreenPortal>
      </AnimatePresence>
    </>
  );
});

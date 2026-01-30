// Neuron Correlation Matrix - Cross-neuron correlation heatmap
// Essential for understanding functional connectivity between neurons

import { memo, useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useStore } from '../../store';

interface NeuronCorrelationMatrixProps {
  maxNeurons?: number;
  windowSize?: number;
}

// Compute correlation coefficient between two arrays
function correlation(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  const n = a.length;
  const meanA = a.reduce((s, x) => s + x, 0) / n;
  const meanB = b.reduce((s, x) => s + x, 0) / n;
  
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const dA = a[i] - meanA;
    const dB = b[i] - meanB;
    num += dA * dB;
    denA += dA * dA;
    denB += dB * dB;
  }
  
  const den = Math.sqrt(denA) * Math.sqrt(denB);
  return den > 0 ? num / den : 0;
}

// Fullscreen portal
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

// Control button
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

export const NeuronCorrelationMatrix = memo(function NeuronCorrelationMatrix({
  maxNeurons = 32, // Lower default for performance
  windowSize = 60,
}: NeuronCorrelationMatrixProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPacket = useStore((state) => state.currentPacket);
  
  // Signal history for correlation calculation
  const historyRef = useRef<number[][]>([]);
  const correlationMatrixRef = useRef<number[][]>([]);
  const updateCounterRef = useRef(0);
  
  // State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [colorScheme, setColorScheme] = useState<'diverging' | 'sequential'>('diverging');
  const [showValues, setShowValues] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ i: number; j: number } | null>(null);
  const [threshold, setThreshold] = useState(0);
  // Reserved for future clustering feature
  // const [clusterOrder, setClusterOrder] = useState(false);
  
  // Dimensions
  const getCanvasDimensions = useCallback(() => {
    if (isFullscreen) {
      const size = Math.min(window.innerWidth - 200, window.innerHeight - 200);
      return { width: size, height: size };
    }
    return { width: 280, height: 280 };
  }, [isFullscreen]);
  
  const { width, height } = getCanvasDimensions();
  
  // Color mapping
  const getColor = useCallback((value: number): string => {
    // Apply threshold
    if (Math.abs(value) < threshold) {
      return '#1a1a1a';
    }
    
    if (colorScheme === 'diverging') {
      // Blue (negative) - White (zero) - Red (positive)
      if (value < 0) {
        const intensity = Math.abs(value);
        return `rgb(${Math.floor(50 + 100 * (1 - intensity))}, ${Math.floor(50 + 150 * (1 - intensity))}, ${Math.floor(180 + 75 * intensity)})`;
      } else {
        const intensity = value;
        return `rgb(${Math.floor(180 + 75 * intensity)}, ${Math.floor(50 + 150 * (1 - intensity))}, ${Math.floor(50 + 100 * (1 - intensity))})`;
      }
    } else {
      // Sequential: Black to Green to White
      const v = (value + 1) / 2; // Normalize to 0-1
      if (v < 0.5) {
        const t = v * 2;
        return `rgb(0, ${Math.floor(t * 200)}, 0)`;
      } else {
        const t = (v - 0.5) * 2;
        return `rgb(${Math.floor(t * 255)}, ${Math.floor(200 + t * 55)}, ${Math.floor(t * 255)})`;
      }
    }
  }, [colorScheme, threshold]);
  
  // Update history and compute correlations
  useEffect(() => {
    if (!currentPacket || isPaused) return;
    
    const spikes = currentPacket.data?.spikes?.spike_counts || [];
    if (spikes.length === 0) return;
    
    // Add to history
    historyRef.current.push(spikes.slice(0, maxNeurons));
    if (historyRef.current.length > windowSize) {
      historyRef.current.shift();
    }
    
    // Update correlation matrix every 10 frames for performance
    updateCounterRef.current++;
    if (updateCounterRef.current % 10 !== 0) return;
    
    const history = historyRef.current;
    if (history.length < 10) return;
    
    const n = Math.min(maxNeurons, history[0]?.length || 0);
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Extract time series for each neuron
    const timeSeries: number[][] = [];
    for (let i = 0; i < n; i++) {
      timeSeries.push(history.map(h => h[i] || 0));
    }
    
    // Compute correlations
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const corr = correlation(timeSeries[i], timeSeries[j]);
        matrix[i][j] = corr;
        matrix[j][i] = corr; // Symmetric
      }
    }
    
    correlationMatrixRef.current = matrix;
  }, [currentPacket, maxNeurons, windowSize, isPaused]);
  
  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const matrix = correlationMatrixRef.current;
    
    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    if (matrix.length === 0) {
      ctx.fillStyle = '#4b5563';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Computing correlations...', width / 2, height / 2);
      return;
    }
    
    const n = matrix.length;
    const margin = 35;
    const plotSize = Math.min(width, height) - margin * 2;
    const cellSize = plotSize / n;
    
    // Draw matrix
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = margin + j * cellSize;
        const y = margin + i * cellSize;
        const value = matrix[i][j];
        
        ctx.fillStyle = getColor(value);
        ctx.fillRect(x, y, cellSize, cellSize);
        
        // Highlight selected cell
        if (selectedCell && selectedCell.i === i && selectedCell.j === j) {
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, cellSize, cellSize);
        }
        
        // Show values if enabled and cells are large enough
        if (showValues && cellSize > 15) {
          ctx.fillStyle = Math.abs(value) > 0.5 ? '#fff' : '#888';
          ctx.font = `${Math.max(8, cellSize / 3)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(value.toFixed(1), x + cellSize / 2, y + cellSize / 2);
        }
      }
    }
    
    // Draw axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '9px monospace';
    
    // X axis
    ctx.textAlign = 'center';
    for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 10))) {
      const x = margin + i * cellSize + cellSize / 2;
      ctx.fillText(`${i}`, x, margin - 5);
    }
    
    // Y axis
    ctx.textAlign = 'right';
    for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 10))) {
      const y = margin + i * cellSize + cellSize / 2;
      ctx.fillText(`${i}`, margin - 5, y);
    }
    
    // Axis titles
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Neuron j', width / 2, 12);
    
    ctx.save();
    ctx.translate(10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Neuron i', 0, 0);
    ctx.restore();
    
  }, [currentPacket, width, height, getColor, showValues, selectedCell, isPaused]);
  
  // Mouse handler for cell selection
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const matrix = correlationMatrixRef.current;
    if (matrix.length === 0) return;
    
    const n = matrix.length;
    const margin = 35;
    const plotSize = Math.min(width, height) - margin * 2;
    const cellSize = plotSize / n;
    
    const j = Math.floor((x - margin) / cellSize);
    const i = Math.floor((y - margin) / cellSize);
    
    if (i >= 0 && i < n && j >= 0 && j < n) {
      setSelectedCell({ i, j });
    } else {
      setSelectedCell(null);
    }
  }, [width, height]);
  
  // Stats
  const stats = useCallback(() => {
    const matrix = correlationMatrixRef.current;
    if (matrix.length === 0) return { avgCorr: 0, maxCorr: 0, minCorr: 0 };
    
    let sum = 0, count = 0, max = -1, min = 1;
    const n = matrix.length;
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const v = matrix[i][j];
        sum += v;
        count++;
        max = Math.max(max, v);
        min = Math.min(min, v);
      }
    }
    
    return {
      avgCorr: count > 0 ? sum / count : 0,
      maxCorr: max,
      minCorr: min,
    };
  }, []);
  
  const { avgCorr, maxCorr, minCorr } = stats();
  
  // Toolbar
  const Toolbar = () => (
    <div className="flex items-center gap-2 flex-wrap">
      <ControlButton onClick={() => setIsPaused(!isPaused)} title={isPaused ? 'Resume' : 'Pause'} active={isPaused}>
        {isPaused ? '▶' : '⏸'}
      </ControlButton>
      
      <ControlButton onClick={() => setShowValues(!showValues)} title="Show Values" active={showValues}>
        123
      </ControlButton>
      
      <div className="flex items-center gap-1 border-l border-gray-700/50 pl-2">
        <ControlButton onClick={() => setColorScheme('diverging')} title="Diverging Colors" active={colorScheme === 'diverging'}>
          ◐
        </ControlButton>
        <ControlButton onClick={() => setColorScheme('sequential')} title="Sequential Colors" active={colorScheme === 'sequential'}>
          ◑
        </ControlButton>
      </div>
      
      <div className="flex items-center gap-1 border-l border-gray-700/50 pl-2">
        <span className="text-[10px] text-gray-500">Thresh:</span>
        <input
          type="range"
          min="0"
          max="100"
          value={threshold * 100}
          onChange={(e) => setThreshold(Number(e.target.value) / 100)}
          className="w-16 h-1 accent-phantom"
        />
        <span className="text-[10px] text-gray-400 font-mono w-8">{threshold.toFixed(1)}</span>
      </div>
      
      <div className="border-l border-gray-700/50 pl-2">
        <ControlButton onClick={() => setIsFullscreen(!isFullscreen)} title="Fullscreen">
          ⛶
        </ControlButton>
      </div>
    </div>
  );
  
  // Stats display
  const StatsDisplay = () => (
    <div className="flex items-center gap-4 text-[10px] text-gray-400">
      <div className="flex flex-col items-end">
        <span className="text-gray-500 uppercase">Avg</span>
        <span className={`font-mono font-bold ${avgCorr > 0 ? 'text-red-400' : 'text-blue-400'}`}>
          {avgCorr.toFixed(3)}
        </span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-gray-500 uppercase">Max</span>
        <span className="font-mono font-bold text-red-400">{maxCorr.toFixed(3)}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-gray-500 uppercase">Min</span>
        <span className="font-mono font-bold text-blue-400">{minCorr.toFixed(3)}</span>
      </div>
      {selectedCell && (
        <div className="flex flex-col items-end border-l border-gray-700/50 pl-4">
          <span className="text-gray-500 uppercase">N{selectedCell.i}↔N{selectedCell.j}</span>
          <span className="font-mono font-bold text-phantom">
            {correlationMatrixRef.current[selectedCell.i]?.[selectedCell.j]?.toFixed(3) || '?'}
          </span>
        </div>
      )}
    </div>
  );
  
  // Color legend
  const ColorLegend = () => (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-blue-400">-1</span>
      <div 
        className="h-3 flex-1 rounded"
        style={{
          background: colorScheme === 'diverging'
            ? 'linear-gradient(to right, #3b82f6, #1a1a1a, #ef4444)'
            : 'linear-gradient(to right, #000, #00c800, #fff)'
        }}
      />
      <span className="text-[10px] text-red-400">+1</span>
    </div>
  );
  
  return (
    <>
      {!isFullscreen && (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Correlation Matrix
          </h3>
          <Toolbar />
        </div>
        
        <div className="flex justify-center">
          <div className="relative overflow-hidden bg-gray-950 border border-gray-700/50 rounded">
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className="block cursor-crosshair"
              onClick={handleCanvasClick}
            />
            
            {isPaused && (
              <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-[10px] font-mono">
                PAUSED
              </div>
            )}
          </div>
        </div>
        
        <ColorLegend />
        
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-mono text-gray-500">
            {maxNeurons}×{maxNeurons} • {windowSize} frame window
          </span>
          <StatsDisplay />
        </div>
      </div>
      )}
      
      {/* Fullscreen */}
      <AnimatePresence>
        <FullscreenPortal isOpen={isFullscreen} onClose={() => setIsFullscreen(false)}>
          <div className="flex-1 flex flex-col p-6 gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-white">Functional Connectivity Matrix</h2>
                <StatsDisplay />
              </div>
              <Toolbar />
            </div>
            
            <div className="flex-1 flex items-center justify-center gap-8">
              <div className="relative overflow-hidden bg-gray-950 border border-gray-700/50 rounded">
                <canvas
                  ref={canvasRef}
                  width={width}
                  height={height}
                  className="block cursor-crosshair"
                  onClick={handleCanvasClick}
                />
              </div>
              
              {/* Info panel */}
              <div className="w-64 space-y-4">
                <div className="p-4 bg-gray-900/50 border border-gray-700/50 rounded">
                  <h4 className="text-sm font-semibold text-gray-300 mb-3">Color Scale</h4>
                  <ColorLegend />
                  <p className="text-xs text-gray-500 mt-2">
                    {colorScheme === 'diverging' 
                      ? 'Blue = negative correlation, Red = positive' 
                      : 'Sequential intensity scale'}
                  </p>
                </div>
                
                {selectedCell && (
                  <div className="p-4 bg-phantom/10 border border-phantom/30 rounded">
                    <h4 className="text-sm font-semibold text-phantom mb-2">Selected Pair</h4>
                    <div className="text-2xl font-mono font-bold text-white">
                      {correlationMatrixRef.current[selectedCell.i]?.[selectedCell.j]?.toFixed(4) || '?'}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Neuron {selectedCell.i} ↔ Neuron {selectedCell.j}
                    </p>
                  </div>
                )}
                
                <div className="p-4 bg-gray-900/50 border border-gray-700/50 rounded">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Summary</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Window Size:</span>
                      <span className="font-mono text-gray-300">{windowSize} frames</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Neurons:</span>
                      <span className="font-mono text-gray-300">{maxNeurons}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Threshold:</span>
                      <span className="font-mono text-gray-300">{threshold.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-gray-500 text-sm">
              Click cells to inspect correlation values • ESC to exit
            </div>
          </div>
        </FullscreenPortal>
      </AnimatePresence>
    </>
  );
});

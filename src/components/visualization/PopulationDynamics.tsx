// Population Dynamics - PCA/UMAP style neural manifold visualization
// Shows collective neural activity in reduced dimensionality space

import { memo, useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useStore } from '../../store';

interface PopulationDynamicsProps {
  maxHistory?: number;
  trailLength?: number;
}

interface Point2D {
  x: number;
  y: number;
  timestamp: number;
}

// Simple PCA-like dimensionality reduction using first two principal directions
// In a real app, you'd use proper PCA or UMAP
function reduceDimensions(spikes: number[]): { x: number; y: number } {
  if (spikes.length === 0) return { x: 0, y: 0 };
  
  // Create pseudo-principal components by weighted sums
  // PC1: Weighted by neuron index (captures spatial gradient)
  // PC2: Weighted by alternating sign (captures alternating patterns)
  let pc1 = 0, pc2 = 0;
  const n = spikes.length;
  
  for (let i = 0; i < n; i++) {
    const weight1 = (i / n) - 0.5; // -0.5 to 0.5
    const weight2 = Math.sin((i / n) * Math.PI * 4); // Oscillating
    pc1 += spikes[i] * weight1;
    pc2 += spikes[i] * weight2;
  }
  
  // Normalize
  const maxVal = Math.max(Math.abs(pc1), Math.abs(pc2), 1);
  return {
    x: (pc1 / maxVal) * 0.8,
    y: (pc2 / maxVal) * 0.8,
  };
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

export const PopulationDynamics = memo(function PopulationDynamics({
  maxHistory = 500,
  trailLength = 100,
}: PopulationDynamicsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPacket = useStore((state) => state.currentPacket);
  
  // Trajectory history
  const trajectoryRef = useRef<Point2D[]>([]);
  const timestampRef = useRef(0);
  
  // View state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showAxes, setShowAxes] = useState(true);
  const [showTrail, setShowTrail] = useState(true);
  const [colorMode, setColorMode] = useState<'time' | 'velocity' | 'position'>('time');
  const [_trailOpacity] = useState(0.7);
  
  // Display stats (derived from refs, updated during animation)
  const [trajectoryCount, setTrajectoryCount] = useState(0);
  const [displayStats, setDisplayStats] = useState({ x: 0, y: 0, velocity: 0 });
  
  // Dimensions
  const getCanvasDimensions = useCallback(() => {
    if (isFullscreen) {
      const size = Math.min(window.innerWidth - 200, window.innerHeight - 200);
      return { width: size, height: size };
    }
    return { width: 300, height: 300 };
  }, [isFullscreen]);
  
  const { width, height } = getCanvasDimensions();
  const centerX = width / 2;
  const centerY = height / 2;
  const scale = Math.min(width, height) / 2 - 40;
  
  // Update trajectory
  useEffect(() => {
    if (!currentPacket || isPaused) return;
    
    const spikes = currentPacket.data?.spikes?.spike_counts || [];
    if (spikes.length === 0) return;
    
    const point = reduceDimensions(spikes);
    const now = timestampRef.current++;
    
    trajectoryRef.current.push({
      x: point.x,
      y: point.y,
      timestamp: now,
    });
    
    // Trim old points
    if (trajectoryRef.current.length > maxHistory) {
      trajectoryRef.current.shift();
    }
  }, [currentPacket, maxHistory, isPaused]);
  
  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const trajectory = trajectoryRef.current;
    
    // Update trajectory count for display
    setTrajectoryCount(trajectory.length);
    
    // Update stats for display
    if (trajectory.length > 0) {
      const current = trajectory[trajectory.length - 1];
      let velocity = 0;
      if (trajectory.length > 1) {
        const prev = trajectory[trajectory.length - 2];
        velocity = Math.sqrt((current.x - prev.x) ** 2 + (current.y - prev.y) ** 2);
      }
      setDisplayStats({ x: current.x, y: current.y, velocity });
    }
    
    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw axes
    if (showAxes) {
      ctx.strokeStyle = 'rgba(75, 85, 99, 0.3)';
      ctx.lineWidth = 1;
      
      // Cross
      ctx.beginPath();
      ctx.moveTo(centerX, 20);
      ctx.lineTo(centerX, height - 20);
      ctx.moveTo(20, centerY);
      ctx.lineTo(width - 20, centerY);
      ctx.stroke();
      
      // Concentric circles
      ctx.strokeStyle = 'rgba(75, 85, 99, 0.15)';
      for (let r = 0.25; r <= 1; r += 0.25) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, scale * r, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Labels
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PC1', width - 30, centerY - 5);
      ctx.fillText('PC2', centerX + 15, 25);
    }
    
    if (trajectory.length < 2) {
      ctx.fillStyle = '#4b5563';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Collecting neural data...', centerX, centerY);
      return;
    }
    
    // Calculate velocity for coloring
    const velocities: number[] = [];
    for (let i = 1; i < trajectory.length; i++) {
      const dx = trajectory[i].x - trajectory[i - 1].x;
      const dy = trajectory[i].y - trajectory[i - 1].y;
      velocities.push(Math.sqrt(dx * dx + dy * dy));
    }
    const maxVelocity = Math.max(...velocities, 0.01);
    
    // Draw trail
    if (showTrail) {
      const trailStart = Math.max(0, trajectory.length - trailLength);
      
      for (let i = trailStart + 1; i < trajectory.length; i++) {
        const p1 = trajectory[i - 1];
        const p2 = trajectory[i];
        
        const x1 = centerX + p1.x * scale;
        const y1 = centerY - p1.y * scale;
        const x2 = centerX + p2.x * scale;
        const y2 = centerY - p2.y * scale;
        
        // Color based on mode
        let hue: number;
        const age = (i - trailStart) / (trajectory.length - trailStart);
        
        switch (colorMode) {
          case 'velocity':
            hue = (1 - velocities[i - 1] / maxVelocity) * 240; // Blue (slow) to Red (fast)
            break;
          case 'position':
            hue = ((Math.atan2(p2.y, p2.x) / Math.PI + 1) / 2) * 360;
            break;
          default: // time
            hue = age * 280; // Purple to Green
        }
        
        ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${age * _trailOpacity})`;
        ctx.lineWidth = 1 + age * 2;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
    
    // Draw current point
    const current = trajectory[trajectory.length - 1];
    const cx = centerX + current.x * scale;
    const cy = centerY - current.y * scale;
    
    // Glow
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
    gradient.addColorStop(0, 'rgba(168, 85, 247, 0.8)');
    gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.3)');
    gradient.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fill();
    
    // Point
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    
  }, [currentPacket, width, height, showAxes, showTrail, colorMode, trailLength, _trailOpacity, isPaused, centerX, centerY, scale]);
  
  const { x, y, velocity } = displayStats;
  
  // Toolbar JSX
  const toolbarContent = (
    <div className="flex items-center gap-2 flex-wrap">
      <ControlButton onClick={() => setIsPaused(!isPaused)} title={isPaused ? 'Resume' : 'Pause'} active={isPaused}>
        {isPaused ? '▶' : '⏸'}
      </ControlButton>
      
      <ControlButton onClick={() => setShowAxes(!showAxes)} title="Toggle Axes" active={showAxes}>
        ⊕
      </ControlButton>
      
      <ControlButton onClick={() => setShowTrail(!showTrail)} title="Toggle Trail" active={showTrail}>
        〰
      </ControlButton>
      
      <div className="flex items-center gap-1 border-l border-gray-700/50 pl-2">
        <ControlButton onClick={() => setColorMode('time')} title="Color by Time" active={colorMode === 'time'}>
          ⏱
        </ControlButton>
        <ControlButton onClick={() => setColorMode('velocity')} title="Color by Velocity" active={colorMode === 'velocity'}>
          ⚡
        </ControlButton>
        <ControlButton onClick={() => setColorMode('position')} title="Color by Position" active={colorMode === 'position'}>
          📍
        </ControlButton>
      </div>
      
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
        <span className="text-gray-500 uppercase">PC1</span>
        <span className="font-mono font-bold text-blue-400">{x.toFixed(3)}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-gray-500 uppercase">PC2</span>
        <span className="font-mono font-bold text-green-400">{y.toFixed(3)}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-gray-500 uppercase">Velocity</span>
        <span className="font-mono font-bold text-purple-400">{velocity.toFixed(4)}</span>
      </div>
    </div>
  );
  
  return (
    <>
      <div className={`flex flex-col gap-2 ${isFullscreen ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Population Dynamics
          </h3>
          {toolbarContent}
        </div>
        
        <div className="flex justify-center">
          <div className="relative overflow-hidden bg-gray-950 border border-gray-700/50 rounded">
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
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-mono text-gray-500">
            {trajectoryCount} points • {trailLength} trail
          </span>
          {statsContent}
        </div>
      </div>
      
      {/* Fullscreen */}
      <AnimatePresence>
        <FullscreenPortal isOpen={isFullscreen} onClose={() => setIsFullscreen(false)}>
          <div className="flex-1 flex flex-col p-6 gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-white">Neural Manifold</h2>
                {statsContent}
              </div>
              {toolbarContent}
            </div>
            
            <div className="flex-1 flex items-center justify-center">
              <div className="relative overflow-hidden bg-gray-950 border border-gray-700/50 rounded">
                <canvas
                  ref={canvasRef}
                  width={width}
                  height={height}
                  className="block"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between text-gray-500 text-sm">
              <span className="font-mono">
                {trajectoryCount} trajectory points
              </span>
              <span className="text-xs text-gray-600">
                Real-time dimensionality reduction • ESC to exit
              </span>
            </div>
          </div>
        </FullscreenPortal>
      </AnimatePresence>
    </>
  );
});

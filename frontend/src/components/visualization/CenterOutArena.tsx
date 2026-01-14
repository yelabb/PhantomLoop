// Center-Out Arena - 2D Top-down visualization optimized for researchers
// Shows targets, cursor trajectories, and real-time error visualization

import { memo, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { COLORS } from '../../utils/constants';

interface Point {
  x: number;
  y: number;
}

// Constants
const ARENA_SIZE = 640;
const CENTER = ARENA_SIZE / 2;
const TARGET_RADIUS = 260;
const CURSOR_SIZE = 22;
const TARGET_SIZE = 32;

// Target positions (8 directions like Neuralink's center-out task)
const TARGET_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const TARGETS = TARGET_ANGLES.map(angle => ({
  id: angle,
  x: CENTER + Math.cos((angle * Math.PI) / 180) * TARGET_RADIUS,
  y: CENTER - Math.sin((angle * Math.PI) / 180) * TARGET_RADIUS,
  angle,
}));

// Normalize -100 to 100 range to arena coordinates
function toArenaCoords(x: number, y: number): Point {
  return {
    x: CENTER + (x / 100) * (ARENA_SIZE / 2 - 30),
    y: CENTER - (y / 100) * (ARENA_SIZE / 2 - 30),
  };
}

// Calculate distance between two points
function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Color for error magnitude (green -> yellow -> red)
function errorToColor(error: number): string {
  if (error < 0.1) return '#22c55e'; // Green
  if (error < 0.2) return '#84cc16'; // Lime
  if (error < 0.3) return '#eab308'; // Yellow
  if (error < 0.4) return '#f97316'; // Orange
  return '#ef4444'; // Red
}

// Particle system for visualizing neural spikes
interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  intensity: number;
  channel: number;
}

// Neural spike background visualization
const NeuralBackground = memo(function NeuralBackground({ 
  spikes 
}: { 
  spikes: number[] | null 
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameIdRef = useRef<number | null>(null);
  const particleIdRef = useRef(0);
  const lastSpikeProcessRef = useRef<number>(0);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return;
    
    // Enable hardware acceleration hints
    ctx.imageSmoothingEnabled = false;
    
    // Generate particles based on spike activity (throttled to every 50ms)
    const processSpikes = () => {
      const now = performance.now();
      if (now - lastSpikeProcessRef.current < 50) return;
      lastSpikeProcessRef.current = now;
      
      if (!spikes || spikes.length === 0) return;
      
      const totalSpikes = spikes.reduce((sum, s) => sum + s, 0);
      const avgSpikes = totalSpikes / spikes.length;
      
      // Normalize spike counts to intensity (0-1 range)
      const maxSpikes = Math.max(...spikes, 1);
      
      // Create particles based on spike activity (reduced particle count for performance)
      if (avgSpikes > 0 && particlesRef.current.length < 150) {
        // Sample a subset of channels with intensity above 0.15 threshold
        const activeChannels = spikes
          .map((count, idx) => ({ 
            count, 
            idx,
            intensity: count / maxSpikes 
          }))
          .filter(c => c.intensity > 0.15) // Only neurons firing above 0.15 intensity
          .sort((a, b) => b.count - a.count)
          .slice(0, 15); // Top 15 active channels
        
        activeChannels.forEach(({ count, idx, intensity }) => {
          // Spawn fewer particles per channel for performance
          const particleCount = Math.min(Math.ceil(count / 3), 2);
          for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = TARGET_RADIUS + Math.random() * 40;
            const x = CENTER + Math.cos(angle) * radius;
            const y = CENTER + Math.sin(angle) * radius;
            
            particlesRef.current.push({
              id: particleIdRef.current++,
              x,
              y,
              vx: (Math.random() - 0.5) * 0.5,
              vy: (Math.random() - 0.5) * 0.5,
              life: 0,
              maxLife: 70 + Math.random() * 50,
              intensity: Math.min(intensity * 1.2, 1.2), // Use normalized intensity
              channel: idx,
            });
          }
        });
      }
    };
    
    // Animation loop with optimizations
    const animate = () => {
      processSpikes();
      ctx.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);
      
      // Batch particle updates and rendering
      const aliveparticles: Particle[] = [];
      
      // Update all particles first
      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        
        const alpha = (1 - p.life / p.maxLife) * p.intensity;
        if (alpha > 0.05) { // Skip nearly invisible particles
          aliveparticles.push(p);
        }
      }
      
      // Render all particles in batches
      ctx.globalCompositeOperation = 'lighter'; // Additive blending for glow effect
      
      for (let i = 0; i < aliveparticles.length; i++) {
        const p = aliveparticles[i];
        const alpha = (1 - p.life / p.maxLife) * p.intensity;
        
        // Simplified single-pass rendering
        const size = 18 + p.intensity * 6;
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
        gradient.addColorStop(0, `rgba(196, 181, 253, ${alpha * 0.9})`);
        gradient.addColorStop(0.4, `rgba(139, 92, 246, ${alpha * 0.5})`);
        gradient.addColorStop(0.7, `rgba(99, 102, 241, ${alpha * 0.2})`);
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.globalCompositeOperation = 'source-over'; // Reset blending
      particlesRef.current = aliveparticles;
      
      frameIdRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
    };
  }, [spikes]);
  
  return (
    <canvas
      ref={canvasRef}
      width={ARENA_SIZE}
      height={ARENA_SIZE}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
});

// Single target component
const Target = memo(function Target({ 
  x, 
  y, 
  isActive, 
  wasHit,
}: { 
  x: number; 
  y: number; 
  isActive: boolean;
  wasHit: boolean;
}) {
  return (
    <div
      className="absolute rounded-full border-2 flex items-center justify-center transition-all duration-200"
      style={{
        width: TARGET_SIZE,
        height: TARGET_SIZE,
        left: x - TARGET_SIZE / 2,
        top: y - TARGET_SIZE / 2,
        borderColor: isActive ? '#a855f7' : wasHit ? '#22c55e' : '#4b5563',
        backgroundColor: isActive 
          ? 'rgba(168, 85, 247, 0.2)' 
          : wasHit 
          ? 'rgba(34, 197, 94, 0.1)' 
          : 'transparent',
        transform: isActive ? 'scale(1.05)' : 'scale(1)',
        boxShadow: isActive ? '0 0 20px rgba(168, 85, 247, 0.5)' : 'none',
      }}
    >
      {wasHit && (
        <div className="w-2 h-2 rounded-full bg-green-500" />
      )}
    </div>
  );
});

// Cursor component (decoder output) - optimized without animations
const Cursor = memo(function Cursor({
  x,
  y,
  type,
  color,
  label,
}: {
  x: number;
  y: number;
  type: 'ground-truth' | 'decoded' | 'target';
  color: string;
  label?: string;
}) {
  const size = type === 'decoded' ? CURSOR_SIZE : CURSOR_SIZE * 0.8;
  
  return (
    <div
      className="absolute flex items-center justify-center transition-all duration-100"
      style={{
        width: size,
        height: size,
        left: x - size / 2,
        top: y - size / 2,
      }}
    >
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full blur-sm"
        style={{ backgroundColor: color, opacity: 0.5 }}
      />
      
      {/* Main cursor */}
      <div
        className="relative rounded-full border-2"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          borderColor: 'rgba(255,255,255,0.3)',
          boxShadow: `0 0 ${type === 'decoded' ? 15 : 8}px ${color}`,
        }}
      />
      
      {/* Label */}
      {label && (
        <span 
          className="absolute top-full mt-1 text-[9px] font-semibold whitespace-nowrap"
          style={{ color }}
        >
          {label}
        </span>
      )}
    </div>
  );
});

// Error line between ground truth and decoded
const ErrorLine = memo(function ErrorLine({
  from,
  to,
  error,
}: {
  from: Point;
  to: Point;
  error: number;
}) {
  const color = errorToColor(error);
  
  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={color}
        strokeWidth={2}
        strokeDasharray="4,4"
        opacity={0.7}
      />
      {/* Error magnitude indicator */}
      <circle
        cx={(from.x + to.x) / 2}
        cy={(from.y + to.y) / 2}
        r={6}
        fill={color}
        opacity={0.8}
      />
      <text
        x={(from.x + to.x) / 2}
        y={(from.y + to.y) / 2 + 3}
        fontSize={8}
        fill="white"
        textAnchor="middle"
        fontWeight="bold"
      >
        {(error * 100).toFixed(0)}
      </text>
    </svg>
  );
});

export const CenterOutArena = memo(function CenterOutArena() {
  const currentPacket = useStore((state) => state.currentPacket);
  const decoderOutput = useStore((state) => state.decoderOutput);
  
  // Extract spike data
  const spikes = useMemo(() => {
    return currentPacket?.data?.spikes?.spike_counts || null;
  }, [currentPacket]);
  
  // Active target (based on intention)
  const activeTarget = useMemo(() => {
    if (!currentPacket?.data?.intention) return null;
    
    const { target_x, target_y } = currentPacket.data.intention;
    const targetPos = toArenaCoords(target_x, target_y);
    
    // Find closest target
    let closest = TARGETS[0];
    let minDist = Infinity;
    
    for (const t of TARGETS) {
      const d = distance(targetPos, t);
      if (d < minDist) {
        minDist = d;
        closest = t;
      }
    }
    
    return minDist < 50 ? closest : null;
  }, [currentPacket?.data?.intention]);
  
  // Ground truth position (BioLink)
  const groundTruthPos = useMemo(() => {
    if (!currentPacket?.data?.kinematics) return { x: CENTER, y: CENTER };
    const { x, y } = currentPacket.data.kinematics;
    return toArenaCoords(x, y);
  }, [currentPacket]);
  
  // Decoded position (LoopBack)
  const decodedPos = useMemo(() => {
    if (!decoderOutput) return groundTruthPos;
    return toArenaCoords(decoderOutput.x, decoderOutput.y);
  }, [decoderOutput, groundTruthPos]);
  
  // Error calculation (normalized 0-1)
  const error = useMemo(() => {
    const d = distance(groundTruthPos, decodedPos);
    return Math.min(d / (ARENA_SIZE / 2), 1);
  }, [groundTruthPos, decodedPos]);
  
  // Calculate average spike rate
  const spikeRate = useMemo(() => {
    if (!spikes || spikes.length === 0) return 0;
    const total = spikes.reduce((sum, s) => sum + s, 0);
    return total / spikes.length;
  }, [spikes]);
  
  return (
    <div 
      className="relative rounded-2xl overflow-hidden"
      style={{ 
        width: ARENA_SIZE, 
        height: ARENA_SIZE,
        background: 'radial-gradient(circle at center, #1a1a2e 0%, #0f0f1a 100%)',
        boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5), 0 0 40px rgba(0,0,0,0.3)',
        willChange: 'transform', // Performance hint
      }}
    >
      {/* Neural spike particle background */}
      <NeuralBackground spikes={spikes} />
      
      {/* Grid overlay */}
      <svg className="absolute inset-0 pointer-events-none opacity-20">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#444" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Center crosshair */}
        <line x1={CENTER} y1={CENTER - 20} x2={CENTER} y2={CENTER + 20} stroke="#555" strokeWidth="1" />
        <line x1={CENTER - 20} y1={CENTER} x2={CENTER + 20} y2={CENTER} stroke="#555" strokeWidth="1" />
        
        {/* Target circle */}
        <circle cx={CENTER} cy={CENTER} r={TARGET_RADIUS} fill="none" stroke="#333" strokeWidth="1" strokeDasharray="4,4" />
      </svg>
      
      {/* Error line */}
      {decoderOutput && (
        <ErrorLine from={groundTruthPos} to={decodedPos} error={error} />
      )}
      
      {/* Targets */}
      {TARGETS.map(target => (
        <Target
          key={target.id}
          x={target.x}
          y={target.y}
          isActive={activeTarget?.id === target.id}
          wasHit={false}
        />
      ))}
      
      {/* Ground Truth Cursor */}
      <Cursor
        x={groundTruthPos.x}
        y={groundTruthPos.y}
        type="ground-truth"
        color={COLORS.BIOLINK}
        label="TRUTH"
      />
      
      {/* Decoded Cursor */}
      {decoderOutput && (
        <Cursor
          x={decodedPos.x}
          y={decodedPos.y}
          type="decoded"
          color={COLORS.LOOPBACK}
          label="DECODED"
        />
      )}
      
      {/* Center start zone */}
      <div 
        className="absolute rounded-full border border-gray-600"
        style={{
          width: 30,
          height: 30,
          left: CENTER - 15,
          top: CENTER - 15,
          backgroundColor: 'rgba(255,255,255,0.05)',
        }}
      />
      
      {/* Error magnitude display */}
      <div className="absolute bottom-3 left-3 right-3 space-y-1.5">
        {/* Error bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Error</span>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{ 
                backgroundColor: errorToColor(error),
                width: `${error * 100}%`
              }}
            />
          </div>
          <span className="text-[10px] font-mono font-bold" style={{ color: errorToColor(error) }}>
            {(error * 100).toFixed(1)}%
          </span>
        </div>
        
        {/* Neural activity indicator */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Neural</span>
          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 transition-all duration-100"
              style={{ width: `${Math.min(spikeRate * 10, 100)}%` }}
            />
          </div>
          <span className="text-[9px] font-mono text-purple-400">
            {spikeRate.toFixed(1)} Hz
          </span>
        </div>
      </div>
    </div>
  );
});

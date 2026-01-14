// Center-Out Arena - 2D Top-down visualization optimized for researchers
// Shows targets, cursor trajectories, and real-time error visualization

import { memo, useMemo, useReducer, useRef } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../../store';
import { COLORS } from '../../utils/constants';

interface Point {
  x: number;
  y: number;
}

// Constants
const ARENA_SIZE = 480;
const CENTER = ARENA_SIZE / 2;
const TARGET_RADIUS = 210;
const CURSOR_SIZE = 18;
const TARGET_SIZE = 28;
const TRAIL_MAX_LENGTH = 60;

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
    <motion.div
      className="absolute rounded-full border-2 flex items-center justify-center"
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
      }}
      animate={{
        scale: isActive ? [1, 1.1, 1] : 1,
        boxShadow: isActive 
          ? '0 0 20px rgba(168, 85, 247, 0.5)' 
          : 'none',
      }}
      transition={{
        scale: { repeat: Infinity, duration: 1.5 },
      }}
    >
      {wasHit && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-2 h-2 rounded-full bg-green-500"
        />
      )}
    </motion.div>
  );
});

// Cursor component (decoder output)
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
    <motion.div
      className="absolute flex items-center justify-center"
      style={{
        width: size,
        height: size,
        left: x - size / 2,
        top: y - size / 2,
      }}
      animate={{ x: 0, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full blur-sm"
        style={{ backgroundColor: color, opacity: 0.5 }}
      />
      
      {/* Main cursor */}
      <motion.div
        className="relative rounded-full border-2"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          borderColor: 'rgba(255,255,255,0.3)',
          boxShadow: `0 0 ${type === 'decoded' ? 15 : 8}px ${color}`,
        }}
        animate={{
          scale: type === 'decoded' ? [1, 1.05, 1] : 1,
        }}
        transition={{
          scale: { repeat: Infinity, duration: 0.5 },
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
    </motion.div>
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

// Trail visualization (shows recent trajectory)
const Trail = memo(function Trail({
  points,
  color,
}: {
  points: Point[];
  color: string;
}) {
  if (points.length < 2) return null;
  
  const pathData = points.reduce((acc, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    return `${acc} L ${point.x} ${point.y}`;
  }, '');
  
  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
      <defs>
        <linearGradient id={`trail-${color}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <path
        d={pathData}
        fill="none"
        stroke={`url(#trail-${color})`}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});

export const CenterOutArena = memo(function CenterOutArena() {
  const currentPacket = useStore((state) => state.currentPacket);
  const decoderOutput = useStore((state) => state.decoderOutput);
  
  // Trail history - using refs with a counter for safe updates
  const groundTruthTrailRef = useRef<Point[]>([]);
  const decodedTrailRef = useRef<Point[]>([]);
  const [, forceRender] = useReducer(x => x + 1, 0);
  
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
  
  // Update trails inline (before render) - avoids useEffect setState issues
  // This is safe because we're only mutating refs
  if (groundTruthPos.x !== CENTER || groundTruthPos.y !== CENTER) {
    const lastGT = groundTruthTrailRef.current[groundTruthTrailRef.current.length - 1];
    if (!lastGT || lastGT.x !== groundTruthPos.x || lastGT.y !== groundTruthPos.y) {
      groundTruthTrailRef.current = [
        ...groundTruthTrailRef.current.slice(-TRAIL_MAX_LENGTH + 1),
        groundTruthPos,
      ];
    }
  }
  
  if (decoderOutput) {
    const lastDec = decodedTrailRef.current[decodedTrailRef.current.length - 1];
    if (!lastDec || lastDec.x !== decodedPos.x || lastDec.y !== decodedPos.y) {
      decodedTrailRef.current = [
        ...decodedTrailRef.current.slice(-TRAIL_MAX_LENGTH + 1),
        decodedPos,
      ];
    }
  }
  
  // Copy refs to local vars for render (avoids compiler warnings)
  const groundTruthTrail = groundTruthTrailRef.current;
  const decodedTrail = decodedTrailRef.current;
  
  return (
    <div 
      className="relative rounded-2xl overflow-hidden"
      style={{ 
        width: ARENA_SIZE, 
        height: ARENA_SIZE,
        background: 'radial-gradient(circle at center, #1a1a2e 0%, #0f0f1a 100%)',
        boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5), 0 0 40px rgba(0,0,0,0.3)',
      }}
    >
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
      
      {/* Trails */}
      <Trail points={groundTruthTrail} color={COLORS.BIOLINK} />
      {decoderOutput && <Trail points={decodedTrail} color={COLORS.LOOPBACK} />}
      
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
      <div className="absolute bottom-3 left-3 right-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Error</span>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: errorToColor(error) }}
              animate={{ width: `${error * 100}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          <span className="text-[10px] font-mono font-bold" style={{ color: errorToColor(error) }}>
            {(error * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
});

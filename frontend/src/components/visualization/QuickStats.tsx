// Quick Stats - At-a-glance metrics for researchers
// Large, clear numbers that are visible from across the room

import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store';

interface StatCardProps {
  label: string;
  value: number | string;
  unit?: string;
  status: 'good' | 'warning' | 'bad' | 'neutral';
  icon?: React.ReactNode;
  subtitle?: string;
}

const statusColors = {
  good: { text: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)' },
  warning: { text: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)' },
  bad: { text: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)' },
  neutral: { text: '#9ca3af', bg: 'rgba(156, 163, 175, 0.1)', border: 'rgba(156, 163, 175, 0.3)' },
};

const StatCard = memo(function StatCard({
  label,
  value,
  unit,
  status,
  icon,
  subtitle,
}: StatCardProps) {
  const colors = statusColors[status];
  
  return (
    <motion.div
      className="flex flex-col p-3 rounded-xl border backdrop-blur-sm"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {label}
        </span>
        {icon && <span style={{ color: colors.text }}>{icon}</span>}
      </div>
      
      <div className="flex items-baseline gap-1">
        <motion.span
          className="text-2xl font-bold font-mono"
          style={{ color: colors.text }}
          key={String(value)}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.15 }}
        >
          {typeof value === 'number' ? value.toFixed(value < 10 ? 1 : 0) : value}
        </motion.span>
        {unit && (
          <span className="text-sm font-medium" style={{ color: colors.text, opacity: 0.7 }}>
            {unit}
          </span>
        )}
      </div>
      
      {subtitle && (
        <span className="text-[9px] text-gray-500 mt-1">{subtitle}</span>
      )}
    </motion.div>
  );
});

// Decoder status badge
const DecoderBadge = memo(function DecoderBadge() {
  const activeDecoder = useStore((state) => state.activeDecoder);
  const decoderLatency = useStore((state) => state.decoderLatency);
  
  if (!activeDecoder) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50">
        <div className="w-2 h-2 rounded-full bg-gray-500" />
        <span className="text-xs font-medium text-gray-400">No decoder active</span>
      </div>
    );
  }
  
  const isHealthy = decoderLatency < 25;
  
  return (
    <div 
      className="flex items-center gap-2 px-3 py-2 rounded-lg border"
      style={{
        backgroundColor: isHealthy ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        borderColor: isHealthy ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
      }}
    >
      <motion.div 
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: isHealthy ? '#22c55e' : '#ef4444' }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 1 }}
      />
      <span className="text-xs font-semibold" style={{ color: isHealthy ? '#22c55e' : '#ef4444' }}>
        {activeDecoder.name}
      </span>
      <span className="text-[10px] text-gray-400 font-mono">
        {decoderLatency.toFixed(1)}ms
      </span>
    </div>
  );
});

// Icons
const LatencyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const AccuracyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const PacketIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="21" x2="9" y2="9" />
  </svg>
);

export const QuickStats = memo(function QuickStats() {
  const totalLatency = useStore((state) => state.totalLatency);
  const decoderLatency = useStore((state) => state.decoderLatency);
  const networkLatency = useStore((state) => state.networkLatency);
  const packetsReceived = useStore((state) => state.packetsReceived);
  const droppedPackets = useStore((state) => state.droppedPackets);
  const fps = useStore((state) => state.fps);
  const currentPacket = useStore((state) => state.currentPacket);
  const decoderOutput = useStore((state) => state.decoderOutput);
  
  // Calculate accuracy from current positions
  const accuracy = useMemo(() => {
    if (!currentPacket?.data?.kinematics || !decoderOutput) return 0;
    
    const { x: gtX, y: gtY } = currentPacket.data.kinematics;
    const { x: decX, y: decY } = decoderOutput;
    
    // Calculate normalized error (0-1)
    const error = Math.sqrt((gtX - decX) ** 2 + (gtY - decY) ** 2) / 200;
    return Math.max(0, 1 - error);
  }, [currentPacket?.data?.kinematics, decoderOutput]);
  
  // Latency status
  const latencyStatus = totalLatency < 30 ? 'good' : totalLatency < 50 ? 'warning' : 'bad';
  
  // Accuracy status
  const accuracyStatus = accuracy >= 0.8 ? 'good' : accuracy >= 0.6 ? 'warning' : accuracy > 0 ? 'bad' : 'neutral';
  
  // Packet loss rate
  const lossRate = packetsReceived > 0 ? (droppedPackets / packetsReceived) * 100 : 0;
  const packetStatus = lossRate < 1 ? 'good' : lossRate < 5 ? 'warning' : 'bad';
  
  return (
    <div className="flex flex-col gap-3">
      {/* Decoder badge */}
      <DecoderBadge />
      
      {/* Main stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Accuracy"
          value={accuracy * 100}
          unit="%"
          status={accuracyStatus}
          icon={<AccuracyIcon />}
        />
        
        <StatCard
          label="Total Latency"
          value={totalLatency}
          unit="ms"
          status={latencyStatus}
          icon={<LatencyIcon />}
        />
        
        <StatCard
          label="Decoder"
          value={decoderLatency}
          unit="ms"
          status={decoderLatency < 15 ? 'good' : decoderLatency < 25 ? 'warning' : 'bad'}
          subtitle="Processing time"
        />
        
        <StatCard
          label="Network"
          value={networkLatency}
          unit="ms"
          status={networkLatency < 20 ? 'good' : networkLatency < 40 ? 'warning' : 'bad'}
          subtitle="Round-trip"
        />
      </div>
      
      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center p-2 bg-gray-800/30 rounded-lg">
          <span className="text-[9px] text-gray-500 uppercase">FPS</span>
          <span className={`text-sm font-mono font-bold ${fps >= 55 ? 'text-green-400' : 'text-yellow-400'}`}>
            {fps.toFixed(0)}
          </span>
        </div>
        
        <div className="flex flex-col items-center p-2 bg-gray-800/30 rounded-lg">
          <span className="text-[9px] text-gray-500 uppercase">Packets</span>
          <span className="text-sm font-mono font-bold text-gray-300">
            {packetsReceived}
          </span>
        </div>
        
        <div className="flex flex-col items-center p-2 bg-gray-800/30 rounded-lg">
          <span className="text-[9px] text-gray-500 uppercase">Loss</span>
          <span className={`text-sm font-mono font-bold ${lossRate < 1 ? 'text-green-400' : 'text-red-400'}`}>
            {lossRate.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
});

// Accuracy Gauge - Live-updating sparkline and histogram for decoder performance
// Shows rolling accuracy over time and error distribution

import { memo, useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface AccuracyGaugeProps {
  /** Current accuracy 0-1 */
  accuracy: number;
  /** Current error 0-1 */
  error: number;
  /** Rolling history length */
  historyLength?: number;
}

// Sparkline component
const Sparkline = memo(function Sparkline({
  data,
  color,
  height = 50,
  threshold,
}: {
  data: number[];
  color: string;
  height?: number;
  threshold?: number;
}) {
  if (data.length < 2) return null;
  
  const width = 280;
  const padding = 4;
  const effectiveWidth = width - padding * 2;
  const effectiveHeight = height - padding * 2;
  
  const min = 0;
  const max = 1;
  const range = max - min;
  
  const points = data.map((value, i) => {
    const x = padding + (i / (data.length - 1)) * effectiveWidth;
    const y = padding + effectiveHeight - ((value - min) / range) * effectiveHeight;
    return `${x},${y}`;
  }).join(' ');
  
  const lastPoint = data[data.length - 1];
  const lastX = padding + effectiveWidth;
  const lastY = padding + effectiveHeight - ((lastPoint - min) / range) * effectiveHeight;
  
  // Area fill
  const areaPath = `M ${padding},${padding + effectiveHeight} L ${points} L ${lastX},${padding + effectiveHeight} Z`;
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Threshold line */}
      {threshold !== undefined && (
        <line
          x1={padding}
          y1={padding + effectiveHeight - ((threshold - min) / range) * effectiveHeight}
          x2={padding + effectiveWidth}
          y2={padding + effectiveHeight - ((threshold - min) / range) * effectiveHeight}
          stroke="#ef4444"
          strokeWidth="1"
          strokeDasharray="2,2"
          opacity="0.5"
        />
      )}
      
      {/* Area fill */}
      <path
        d={areaPath}
        fill={color}
        opacity="0.1"
      />
      
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Current value dot */}
      <circle
        cx={lastX}
        cy={lastY}
        r="4"
        fill={color}
      />
      <circle
        cx={lastX}
        cy={lastY}
        r="6"
        fill={color}
        opacity="0.3"
      >
        <animate
          attributeName="r"
          values="4;8;4"
          dur="1s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.3;0.1;0.3"
          dur="1s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
});

// Error distribution histogram
const ErrorHistogram = memo(function ErrorHistogram({
  errors,
  height = 40,
}: {
  errors: number[];
  height?: number;
}) {
  // Bin errors into buckets
  const buckets = useMemo(() => {
    const numBuckets = 10;
    const result = new Array(numBuckets).fill(0);
    
    for (const error of errors) {
      const bucketIndex = Math.min(Math.floor(error * numBuckets), numBuckets - 1);
      result[bucketIndex]++;
    }
    
    const maxCount = Math.max(...result, 1);
    return result.map(count => count / maxCount);
  }, [errors]);
  
  const width = 280;
  const barWidth = width / buckets.length - 3;
  
  return (
    <svg width={width} height={height}>
      {buckets.map((value, i) => {
        const barHeight = value * (height - 4);
        const x = i * (barWidth + 2) + 1;
        const y = height - barHeight - 2;
        
        // Color based on bucket position (left = good, right = bad)
        const hue = 120 - (i / buckets.length) * 120; // Green to red
        const color = `hsl(${hue}, 70%, 50%)`;
        
        return (
          <motion.rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            fill={color}
            opacity={0.7}
            rx={1}
            initial={{ height: 0, y: height }}
            animate={{ height: barHeight, y }}
            transition={{ duration: 0.2 }}
          />
        );
      })}
    </svg>
  );
});

export const AccuracyGauge = memo(function AccuracyGauge({
  accuracy,
  error,
  historyLength = 60,
}: AccuracyGaugeProps) {
  // History buffers - using state for React Compiler compatibility
  const [accuracyHistory, setAccuracyHistory] = useState<number[]>([]);
  const [errorHistory, setErrorHistory] = useState<number[]>([]);
  
  // Update histories
  useEffect(() => {
    setAccuracyHistory(prev => [...prev.slice(-(historyLength - 1)), accuracy]);
    setErrorHistory(prev => [...prev.slice(-(historyLength - 1)), error]);
  }, [accuracy, error, historyLength]);
  
  // Statistics
  const stats = useMemo(() => {
    if (accuracyHistory.length === 0) return { avg: 0, min: 0, max: 0, trend: 0 };
    
    const avg = accuracyHistory.reduce((a, b) => a + b, 0) / accuracyHistory.length;
    const min = Math.min(...accuracyHistory);
    const max = Math.max(...accuracyHistory);
    
    // Calculate trend (positive = improving)
    const recentHalf = accuracyHistory.slice(-Math.floor(accuracyHistory.length / 2));
    const olderHalf = accuracyHistory.slice(0, Math.floor(accuracyHistory.length / 2));
    const recentAvg = recentHalf.length > 0 
      ? recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length 
      : 0;
    const olderAvg = olderHalf.length > 0 
      ? olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length 
      : 0;
    const trend = recentAvg - olderAvg;
    
    return { avg, min, max, trend };
  }, [accuracyHistory]);
  
  // Trend color and icon
  const trendColor = stats.trend > 0.02 ? '#22c55e' : stats.trend < -0.02 ? '#ef4444' : '#6b7280';
  const trendIcon = stats.trend > 0.02 ? '↑' : stats.trend < -0.02 ? '↓' : '→';
  
  // Current status
  const statusColor = accuracy >= 0.8 ? '#22c55e' : accuracy >= 0.6 ? '#eab308' : '#ef4444';
  
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Live Accuracy
        </span>
        <div className="flex items-center gap-3">
          <span 
            className="text-2xl font-bold font-mono"
            style={{ color: statusColor }}
          >
            {(accuracy * 100).toFixed(1)}%
          </span>
          <span 
            className="text-lg font-bold"
            style={{ color: trendColor }}
          >
            {trendIcon}
          </span>
        </div>
      </div>
      
      {/* Sparkline */}
      <div className="flex flex-col gap-2">
        <Sparkline
          data={accuracyHistory}
          color={statusColor}
          height={50}
          threshold={0.7}
        />
        <div className="flex justify-between text-xs text-gray-500 px-1">
          <span>{historyLength}s ago</span>
          <span>Now</span>
        </div>
      </div>
      
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center p-3 bg-gray-800/50 rounded-xl border border-gray-700/30">
          <span className="text-xs text-gray-500 mb-1">AVG</span>
          <span className="text-sm font-mono font-semibold text-gray-300">
            {(stats.avg * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex flex-col items-center p-3 bg-gray-800/50 rounded-xl border border-gray-700/30">
          <span className="text-xs text-gray-500 mb-1">MIN</span>
          <span className="text-sm font-mono font-semibold text-red-400">
            {(stats.min * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex flex-col items-center p-3 bg-gray-800/50 rounded-xl border border-gray-700/30">
          <span className="text-xs text-gray-500 mb-1">MAX</span>
          <span className="text-sm font-mono font-semibold text-green-400">
            {(stats.max * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      
      {/* Error distribution */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-gray-500 uppercase tracking-wider">
          Error Distribution
        </span>
        <ErrorHistogram errors={errorHistory} height={40} />
        <div className="flex justify-between text-xs text-gray-600 px-1">
          <span>0%</span>
          <span>Error</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
});

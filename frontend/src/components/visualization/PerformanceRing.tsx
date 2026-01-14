// Performance Ring - Visual indicator showing decoder accuracy at a glance
// Inspired by fitness rings but for BCI performance

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

interface PerformanceRingProps {
  /** Decoder accuracy 0-1 */
  accuracy: number;
  /** Average error in normalized units */
  error: number;
  /** Ring size in pixels */
  size?: number;
  /** Show labels */
  showLabels?: boolean;
}

export const PerformanceRing = memo(function PerformanceRing({
  accuracy,
  error,
  size = 120,
  showLabels = true,
}: PerformanceRingProps) {
  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate stroke dash for accuracy ring
  const accuracyOffset = circumference * (1 - accuracy);
  
  // Color based on accuracy
  const ringColor = useMemo(() => {
    if (accuracy >= 0.9) return '#22c55e'; // Green - excellent
    if (accuracy >= 0.7) return '#eab308'; // Yellow - acceptable  
    if (accuracy >= 0.5) return '#f97316'; // Orange - poor
    return '#ef4444'; // Red - failing
  }, [accuracy]);

  // Glow intensity based on performance
  const glowOpacity = accuracy >= 0.7 ? 0.6 : 0.2;
  
  // Status text
  const statusText = useMemo(() => {
    if (accuracy >= 0.9) return 'EXCELLENT';
    if (accuracy >= 0.7) return 'GOOD';
    if (accuracy >= 0.5) return 'POOR';
    return 'FAILING';
  }, [accuracy]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Glow filter */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1f2937"
          strokeWidth={strokeWidth}
        />
        
        {/* Accuracy ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: accuracyOffset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          filter="url(#glow)"
          style={{ opacity: glowOpacity + 0.4 }}
        />
        
        {/* Inner error ring (smaller) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius * 0.7}
          fill="none"
          stroke="#374151"
          strokeWidth={strokeWidth * 0.5}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius * 0.7}
          fill="none"
          stroke={error < 0.1 ? '#22c55e' : error < 0.2 ? '#eab308' : '#ef4444'}
          strokeWidth={strokeWidth * 0.5}
          strokeLinecap="round"
          strokeDasharray={circumference * 0.7}
          animate={{ strokeDashoffset: circumference * 0.7 * Math.min(error * 5, 1) }}
          transition={{ duration: 0.3 }}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          className="text-2xl font-bold font-mono"
          style={{ color: ringColor }}
          key={Math.round(accuracy * 100)}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {Math.round(accuracy * 100)}%
        </motion.span>
        {showLabels && (
          <span 
            className="text-[10px] font-semibold tracking-wider"
            style={{ color: ringColor, opacity: 0.8 }}
          >
            {statusText}
          </span>
        )}
      </div>
    </div>
  );
});

/**
 * Electrode Placement Panel
 * 3D visualization of electrode positions with impedance heatmap
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../../store';
import { IMPEDANCE_THRESHOLDS } from '../../types/electrodes';

export function ElectrodePlacementPanel() {
  const { electrodeConfig, impedanceValues } = useStore();

  // Calculate head outline for 2D top-down view
  const headOutline = useMemo(() => {
    const points: string[] = [];
    const centerX = 200;
    const centerY = 200;
    const radius = 150;

    // Draw circle for head
    for (let angle = 0; angle <= 360; angle += 10) {
      const rad = (angle * Math.PI) / 180;
      const x = centerX + radius * Math.cos(rad);
      const y = centerY + radius * Math.sin(rad);
      points.push(`${x},${y}`);
    }

    return points.join(' ');
  }, []);

  // Map electrode positions to 2D view
  const electrodePositions = useMemo(() => {
    if (!electrodeConfig) return [];

    const centerX = 200;
    const centerY = 200;
    const scale = 120; // Scale factor for visualization

    return electrodeConfig.layout.electrodes.map((electrode) => {
      // Convert 3D position to 2D top-down view
      // X stays X (left-right), Y becomes depth (anterior-posterior)
      const x = centerX + electrode.position.x * scale;
      const y = centerY - electrode.position.y * scale; // Invert Y for screen coordinates

      const impedance = impedanceValues.get(electrode.channelIndex);
      const quality = electrode.quality || 'disconnected';

      return {
        ...electrode,
        x,
        y,
        impedance,
        quality,
      };
    });
  }, [electrodeConfig, impedanceValues]);

  // Get color based on impedance quality
  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'good':
        return '#10b981'; // green-500
      case 'fair':
        return '#eab308'; // yellow-500
      case 'poor':
        return '#f97316'; // orange-500
      default:
        return '#6b7280'; // gray-500
    }
  };

  if (!electrodeConfig) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No electrode configuration loaded
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{electrodeConfig.layout.name}</h3>
        <p className="text-sm text-gray-400">
          {electrodeConfig.channelCount} channels • {electrodeConfig.layout.montage} montage
        </p>
      </div>

      {/* 2D Top-down View */}
      <div className="flex-1 flex items-center justify-center">
        <svg
          viewBox="0 0 400 400"
          className="w-full h-full max-w-md max-h-md"
          style={{ maxHeight: '400px' }}
        >
          {/* Head outline */}
          <polyline
            points={headOutline}
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="2"
          />

          {/* Nose indicator (anterior) */}
          <line
            x1="200"
            y1="50"
            x2="200"
            y2="20"
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="2"
          />
          <text
            x="200"
            y="15"
            textAnchor="middle"
            fill="rgba(255, 255, 255, 0.5)"
            fontSize="10"
          >
            Anterior
          </text>

          {/* Ears indicators */}
          <circle cx="50" cy="200" r="15" fill="none" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="2" />
          <circle cx="350" cy="200" r="15" fill="none" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="2" />

          {/* Electrodes */}
          {electrodePositions.map((electrode, idx) => (
            <g key={electrode.id}>
              {/* Electrode circle */}
              <motion.circle
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.02 }}
                cx={electrode.x}
                cy={electrode.y}
                r="8"
                fill={getQualityColor(electrode.quality)}
                stroke="white"
                strokeWidth="1"
                opacity={electrode.isActive ? 1 : 0.3}
              />

              {/* Electrode label */}
              <text
                x={electrode.x}
                y={electrode.y - 12}
                textAnchor="middle"
                fill="white"
                fontSize="10"
                fontWeight="bold"
              >
                {electrode.label}
              </text>

              {/* Impedance value */}
              {electrode.impedance !== undefined && (
                <text
                  x={electrode.x}
                  y={electrode.y + 18}
                  textAnchor="middle"
                  fill="rgba(255, 255, 255, 0.7)"
                  fontSize="8"
                >
                  {electrode.impedance.toFixed(1)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }} />
            <span>Good (&lt; {IMPEDANCE_THRESHOLDS.GOOD} kΩ)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#eab308' }} />
            <span>Fair (&lt; {IMPEDANCE_THRESHOLDS.FAIR} kΩ)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }} />
            <span>Poor (&lt; {IMPEDANCE_THRESHOLDS.POOR} kΩ)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#6b7280' }} />
            <span>Disconnected</span>
          </div>
        </div>
      </div>
    </div>
  );
}

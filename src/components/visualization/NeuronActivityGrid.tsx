// Neuron Activity Grid - GitHub contribution chart style visualization
// Each cell represents a neuron, color intensity shows firing rate

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../../store';

interface NeuronActivityGridProps {
  /** Number of columns in the grid */
  columns?: number;
  /** Maximum number of neurons to display */
  maxNeurons?: number;
  /** Show neuron labels */
  showLabels?: boolean;
}

export const NeuronActivityGrid = memo(function NeuronActivityGrid({
  columns = 16,
  maxNeurons = 96,
  showLabels = true,
}: NeuronActivityGridProps) {
  const currentPacket = useStore((state) => state.currentPacket);
  
  // Extract spike data
  const neuronData = useMemo(() => {
    const spikes = currentPacket?.data?.spikes?.spike_counts || [];
    if (spikes.length === 0) return [];
    
    // Calculate max spike count for normalization
    const maxSpikes = Math.max(...spikes, 1);
    
    // Take up to maxNeurons and normalize to 0-1 range
    return spikes.slice(0, maxNeurons).map((count, idx) => ({
      id: idx,
      count,
      intensity: count / maxSpikes,
    }));
  }, [currentPacket, maxNeurons]);
  
  // Get color based on intensity (GitHub-style green gradient)
  const getColor = (intensity: number) => {
    if (intensity === 0) return '#161b22'; // Dark background (no activity)
    if (intensity < 0.2) return '#0e4429'; // Very light green
    if (intensity < 0.4) return '#006d32'; // Light green
    if (intensity < 0.6) return '#26a641'; // Medium green
    if (intensity < 0.8) return '#39d353'; // Bright green
    return '#57ff73'; // Very bright green (high activity)
  };
  
  // Calculate statistics
  const stats = useMemo(() => {
    if (neuronData.length === 0) {
      return { active: 0, total: 0, avgRate: 0, maxRate: 0 };
    }
    
    const active = neuronData.filter(n => n.count > 0).length;
    const total = neuronData.length;
    const avgRate = neuronData.reduce((sum, n) => sum + n.count, 0) / total;
    const maxRate = Math.max(...neuronData.map(n => n.count));
    
    return { active, total, avgRate, maxRate };
  }, [neuronData]);
  
  if (neuronData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-900/50 rounded-xl border border-gray-700/50">
        <div className="text-3xl mb-3">🧠</div>
        <span className="text-sm font-medium text-gray-400">No Neural Data</span>
        <span className="text-xs text-gray-500 mt-1">Waiting for stream...</span>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col gap-4">
      {/* Header with stats */}
      {showLabels && (
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Neural Activity
            </span>
            <span className="text-[10px] text-gray-500">
              {stats.active} of {stats.total} neurons firing
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <div className="flex flex-col items-end">
              <span className="text-gray-500">AVG</span>
              <span className="font-mono font-bold text-purple-400">
                {stats.avgRate.toFixed(1)} Hz
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-gray-500">MAX</span>
              <span className="font-mono font-bold text-green-400">
                {stats.maxRate.toFixed(0)} Hz
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Grid container */}
      <div 
        className="rounded-xl border border-gray-700/50 bg-gray-950/80 p-3"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: '3px',
        }}
      >
        {neuronData.map((neuron) => (
          <motion.div
            key={neuron.id}
            className="aspect-square rounded-sm relative group cursor-pointer"
            style={{
              backgroundColor: getColor(neuron.intensity),
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: 1, 
              opacity: 1,
            }}
            whileHover={{ 
              scale: 1.2,
              zIndex: 10,
            }}
            transition={{ 
              duration: 0.15,
              scale: { type: "spring", stiffness: 300, damping: 20 }
            }}
          >
            {/* Tooltip on hover */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 rounded border border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 text-[10px]">
              <div className="font-mono font-bold text-white">
                Neuron {neuron.id}
              </div>
              <div className="text-gray-400">
                {neuron.count.toFixed(1)} Hz
              </div>
              <div className="text-gray-500">
                {(neuron.intensity * 100).toFixed(0)}% intensity
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Legend */}
      {showLabels && (
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>Less</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#161b22' }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#0e4429' }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#006d32' }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#26a641' }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#39d353' }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#57ff73' }} />
          </div>
          <span>More</span>
        </div>
      )}
    </div>
  );
});

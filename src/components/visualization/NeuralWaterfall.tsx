import { useRef, useEffect, memo } from 'react';
import { useStore } from '../../store';

interface NeuralWaterfallProps {
  width?: number;
  height?: number;
  maxNeurons?: number;
}

export const NeuralWaterfall = memo(function NeuralWaterfall({
  width = 600,
  height = 200,
  maxNeurons = 96
}: NeuralWaterfallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPacket = useStore((state) => state.currentPacket);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentPacket) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Shift existing content to the left by 1 pixel
    // We capture the current state, shift it, and draw the new column
    // An optimized way is to draw the canvas onto itself
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(canvas, -1, 0);
    ctx.globalCompositeOperation = 'source-over';

    // Draw new column at the right edge
    const spikes = currentPacket.data.spikes.spike_counts || [];
    const maxSpikeEstimate = 5; // Normalize brightness
    
    // Draw background for the new column
    const columnX = width - 1;
    ctx.fillStyle = '#0d1117'; // Dark background
    ctx.fillRect(columnX, 0, 1, height);

    // Draw neurons
    // We Map neurons to vertical pixels. 
    // If height < maxNeurons, we might lose details, or need to scale.
    // If height > maxNeurons, we scale up blocks.
    
    const displayNeurons = Math.min(spikes.length, maxNeurons);
    const cellHeight = height / displayNeurons;

    for (let i = 0; i < displayNeurons; i++) {
        const count = spikes[i];
        if (count > 0) {
            // Calculate intensity
            const intensity = Math.min(count / maxSpikeEstimate, 1.0);
            
            // Green color gradient similar to GitHub contribution graph or Matrix
            // High intensity = bright white/green, Low = dark green
            const r = Math.floor(intensity * 180);
            const g = Math.floor(50 + intensity * 205);
            const b = Math.floor(intensity * 180);
            
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            
            // Draw the pixel(s)
            ctx.fillRect(columnX, Math.floor(i * cellHeight), 1, Math.ceil(cellHeight));
        }
    }

  }, [currentPacket, width, height, maxNeurons]);

  return (
    <div className="relative overflow-hidden border border-gray-700/50 bg-gray-950">
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full h-full block"
            style={{ imageRendering: 'pixelated' }}
        />
        <div className="absolute top-2 left-2 px-2 py-1 bg-gray-900/80 border border-gray-700/50">
            <span className="text-[10px] font-mono text-gray-400">NEURAL_WATERFALL</span>
        </div>
    </div>
  );
});

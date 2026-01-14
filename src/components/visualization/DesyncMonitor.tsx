import { useRef, useEffect, memo } from 'react';
import { useStore } from '../../store';

interface DesyncMonitorProps {
  width?: number;
  height?: number;
  color?: string;
}

export const DesyncMonitor = memo(function DesyncMonitor({
  width = 350,
  height = 100,
  color = '#ef4444' // red-500
}: DesyncMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPacket = useStore((state) => state.currentPacket);
  const decoderOutput = useStore((state) => state.decoderOutput);
  
  // Keep track of previous error for line drawing
  const lastY = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Shift canvas left
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(canvas, -1, 0);
    ctx.globalCompositeOperation = 'source-over';

    // Clear the new column
    const x = width - 1;
    ctx.clearRect(x, 0, 1, height);

    // Calculate Error
    let error = 0;
    
    if (currentPacket?.data?.kinematics && decoderOutput) {
        const { x: gtX, y: gtY } = currentPacket.data.kinematics;
        const { x: decX, y: decY } = decoderOutput;
        
         // Euclidean distance
        const dist = Math.sqrt((gtX - decX) ** 2 + (gtY - decY) ** 2);
        
        // Normalize for display
        // Assuming arena is roughly -100 to 100? or standardized. 
        // Let's assume max reasonable error is 50mm/units.
        const maxExpectedError = 50; 
        error = Math.min(dist / maxExpectedError, 1.0);
    }

    // Determine Y position (0 at bottom, 1 at top)
    // We want 0 error at bottom
    const y = height - (error * height);
    
    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    if (lastY.current !== null) {
        ctx.moveTo(x - 1, lastY.current);
        ctx.lineTo(x, y);
    } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    lastY.current = y;
    
    // Draw threshold line (e.g. at 20% error)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(x, height * 0.8, 1, 1); // 20% error line mark

  }, [currentPacket, decoderOutput, width, height, color]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-700/50 bg-gray-950/50 backdrop-blur-sm shadow-inner">
       <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full h-full block"
        />
        <div className="absolute top-2 left-2 pointer-events-none">
            <span className="text-[10px] font-mono font-bold text-red-400">DESYNC_MONITOR</span>
        </div>
        <div className="absolute bottom-1 right-2 pointer-events-none">
            <span className="text-[9px] text-gray-600">30s HISTORY</span>
        </div>
    </div>
  );
});

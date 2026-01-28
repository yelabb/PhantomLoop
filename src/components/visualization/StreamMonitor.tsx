/**
 * Stream Monitor Component
 * 
 * Real-time visualization of any multichannel stream.
 * Adapts to any channel count and data type.
 */

import { useRef, useEffect, useMemo } from 'react';
import { useStore } from '../../store';

// Selectors
const selectCurrentStreamSample = (s: ReturnType<typeof useStore.getState>) => s.currentStreamSample;
const selectActiveStreamConfig = (s: ReturnType<typeof useStore.getState>) => s.activeStreamConfig;
const selectStreamBuffer = (s: ReturnType<typeof useStore.getState>) => s.streamBuffer;

interface StreamMonitorProps {
  /** Number of seconds of history to display */
  windowSeconds?: number;
  /** Height of each channel row in pixels */
  channelHeight?: number;
  /** Show channel labels */
  showLabels?: boolean;
  /** Color scheme */
  colorScheme?: 'thermal' | 'green' | 'blue' | 'rainbow';
}

export function StreamMonitor({
  windowSeconds = 2,
  channelHeight = 20,
  showLabels = true,
  colorScheme = 'thermal',
}: StreamMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentSample = useStore(selectCurrentStreamSample);
  const config = useStore(selectActiveStreamConfig);
  const streamBuffer = useStore(selectStreamBuffer);

  // Calculate dimensions
  const channelCount = config?.channelCount ?? 8;
  const samplingRate = config?.samplingRate ?? 250;
  const samplesPerWindow = Math.floor(windowSeconds * samplingRate);
  const height = channelCount * channelHeight;

  // Color map generator
  const getColor = useMemo(() => {
    const schemes = {
      thermal: (value: number) => {
        // Blue -> Cyan -> Green -> Yellow -> Red
        const v = Math.max(0, Math.min(1, value));
        if (v < 0.25) {
          return `rgb(0, ${Math.floor(v * 4 * 255)}, 255)`;
        } else if (v < 0.5) {
          return `rgb(0, 255, ${Math.floor((1 - (v - 0.25) * 4) * 255)})`;
        } else if (v < 0.75) {
          return `rgb(${Math.floor((v - 0.5) * 4 * 255)}, 255, 0)`;
        } else {
          return `rgb(255, ${Math.floor((1 - (v - 0.75) * 4) * 255)}, 0)`;
        }
      },
      green: (value: number) => {
        const v = Math.max(0, Math.min(1, value));
        return `rgb(0, ${Math.floor(v * 255)}, ${Math.floor(v * 100)})`;
      },
      blue: (value: number) => {
        const v = Math.max(0, Math.min(1, value));
        return `rgb(${Math.floor(v * 100)}, ${Math.floor(v * 150)}, ${Math.floor(v * 255)})`;
      },
      rainbow: (value: number) => {
        const v = Math.max(0, Math.min(1, value));
        const h = v * 300; // 0 to 300 degrees (purple to red)
        return `hsl(${h}, 100%, 50%)`;
      },
    };
    return schemes[colorScheme];
  }, [colorScheme]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentSample) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get buffered samples
    const samples = streamBuffer.getLast(samplesPerWindow);
    if (samples.length === 0) return;

    const width = canvas.width;
    const pixelWidth = width / samplesPerWindow;

    // Calculate min/max for normalization
    let globalMin = Infinity;
    let globalMax = -Infinity;
    for (const sample of samples) {
      for (const value of sample.channels) {
        if (value < globalMin) globalMin = value;
        if (value > globalMax) globalMax = value;
      }
    }
    const range = globalMax - globalMin || 1;

    // Clear and draw
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Draw each sample column
    samples.forEach((sample, sampleIdx) => {
      const x = Math.floor(sampleIdx * pixelWidth);
      const colWidth = Math.max(1, Math.ceil(pixelWidth));

      sample.channels.forEach((value, chIdx) => {
        if (chIdx >= channelCount) return;

        const y = chIdx * channelHeight;
        const normalized = (value - globalMin) / range;
        
        ctx.fillStyle = getColor(normalized);
        ctx.fillRect(x, y, colWidth, channelHeight - 1);
      });
    });

    // Draw channel labels
    if (showLabels && config?.channelLabels) {
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      config.channelLabels.forEach((label, idx) => {
        if (idx >= channelCount) return;
        const y = idx * channelHeight + channelHeight - 4;
        ctx.fillText(label, 4, y);
      });
    }

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= channelCount; i++) {
      const y = i * channelHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

  }, [currentSample, config, streamBuffer, samplesPerWindow, channelCount, channelHeight, showLabels, getColor, height]);

  // Quality indicators
  const qualities = currentSample?.metadata?.quality ?? [];

  if (!config) {
    return (
      <div className="flex items-center justify-center h-32 bg-black/20 rounded-lg text-gray-500">
        No stream connected
      </div>
    );
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={400}
        height={height}
        className="w-full rounded-lg"
        style={{ imageRendering: 'pixelated' }}
      />
      
      {/* Quality overlay */}
      {qualities.length > 0 && (
        <div 
          className="absolute right-0 top-0 bottom-0 w-2"
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          {qualities.map((quality, idx) => (
            <div
              key={idx}
              style={{
                flex: 1,
                backgroundColor:
                  quality === 'good' ? '#22c55e' :
                  quality === 'fair' ? '#eab308' :
                  quality === 'poor' ? '#f97316' :
                  '#6b7280',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Compact stats display for current stream
 */
export function StreamStats() {
  const currentSample = useStore(selectCurrentStreamSample);
  const config = useStore(selectActiveStreamConfig);

  if (!currentSample || !config) {
    return null;
  }

  // Calculate basic stats
  const channels = currentSample.channels;
  const mean = channels.reduce((a, b) => a + b, 0) / channels.length;
  const min = Math.min(...channels);
  const max = Math.max(...channels);

  const unit = config.unit === 'µV' ? 'µV' : config.unit === 'spikes' ? 'sp' : '';

  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <div className="bg-black/20 rounded-lg p-2 text-center">
        <div className="text-gray-500">Mean</div>
        <div className="text-white font-mono">{mean.toFixed(1)} {unit}</div>
      </div>
      <div className="bg-black/20 rounded-lg p-2 text-center">
        <div className="text-gray-500">Min</div>
        <div className="text-white font-mono">{min.toFixed(1)} {unit}</div>
      </div>
      <div className="bg-black/20 rounded-lg p-2 text-center">
        <div className="text-gray-500">Max</div>
        <div className="text-white font-mono">{max.toFixed(1)} {unit}</div>
      </div>
    </div>
  );
}

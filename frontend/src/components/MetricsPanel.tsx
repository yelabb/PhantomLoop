// Metrics Panel Component

import { useStore } from '../store';
import { PERFORMANCE_THRESHOLDS } from '../utils/constants';

// Define MetricItem outside the component
const MetricItem = ({ 
  label, 
  value, 
  unit, 
  threshold, 
  inverse = false 
}: { 
  label: string; 
  value: number; 
  unit?: string;
  threshold?: number;
  inverse?: boolean;
}) => {
  let color = 'text-white';
  if (threshold !== undefined) {
    const isGood = inverse 
      ? value >= threshold 
      : value <= threshold;
    color = isGood ? 'text-green-400' : 'text-red-400';
  }

  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm font-mono font-semibold ${color}`}>
        {value.toFixed(value < 10 ? 2 : 0)}{unit}
      </span>
    </div>
  );
};

export function MetricsPanel() {
  const {
    fps,
    networkLatency,
    decoderLatency,
    totalLatency,
    droppedPackets,
    packetsReceived,
  } = useStore();

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm p-4 rounded-lg border border-gray-700 w-64">
      <h3 className="text-sm font-semibold text-white mb-3">Performance</h3>
      
      <div className="flex flex-col">
        <MetricItem
          label="FPS"
          value={fps}
          threshold={PERFORMANCE_THRESHOLDS.TARGET_FPS}
          inverse={true}
        />
        <MetricItem
          label="Network Latency"
          value={networkLatency}
          unit="ms"
          threshold={PERFORMANCE_THRESHOLDS.MAX_NETWORK_LATENCY_MS}
        />
        <MetricItem
          label="Decoder Latency"
          value={decoderLatency}
          unit="ms"
          threshold={PERFORMANCE_THRESHOLDS.MAX_DECODER_LATENCY_MS}
        />
        <MetricItem
          label="Total Latency"
          value={totalLatency}
          unit="ms"
          threshold={PERFORMANCE_THRESHOLDS.MAX_TOTAL_LATENCY_MS}
        />
        <MetricItem
          label="Packets Received"
          value={packetsReceived}
        />
        <MetricItem
          label="Dropped Packets"
          value={droppedPackets}
        />
      </div>

      {/* Latency Budget Bar */}
      <div className="mt-4">
        <p className="text-xs text-gray-400 mb-2">Latency Budget</p>
        <div className="relative h-6 bg-gray-800 rounded overflow-hidden">
          <div
            className={`absolute top-0 left-0 h-full transition-all ${
              totalLatency > PERFORMANCE_THRESHOLDS.MAX_TOTAL_LATENCY_MS
                ? 'bg-red-500'
                : totalLatency > PERFORMANCE_THRESHOLDS.MAX_TOTAL_LATENCY_MS * 0.8
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{
              width: `${Math.min((totalLatency / PERFORMANCE_THRESHOLDS.MAX_TOTAL_LATENCY_MS) * 100, 100)}%`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-mono font-semibold text-white">
            {totalLatency.toFixed(1)} / {PERFORMANCE_THRESHOLDS.MAX_TOTAL_LATENCY_MS}ms
          </div>
        </div>
      </div>
    </div>
  );
}

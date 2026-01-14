// Desync Alert Component - Memoized

import { memo } from 'react';
import { useStore } from '../store';

export const DesyncAlert = memo(function DesyncAlert() {
  // Use individual selectors
  const desyncDetected = useStore((state) => state.desyncDetected);
  const totalLatency = useStore((state) => state.totalLatency);

  if (!desyncDetected) {
    return null;
  }

  return (
    <div className="bg-red-600/90 backdrop-blur-sm px-6 py-3 rounded-lg border-2 border-red-400 animate-pulse">
      <div className="flex items-center gap-3">
        <svg
          className="w-6 h-6 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <p className="text-white font-bold text-sm">DESYNC DETECTED</p>
          <p className="text-white text-xs">
            Latency: {totalLatency.toFixed(1)}ms exceeds threshold
          </p>
        </div>
      </div>
    </div>
  );
});

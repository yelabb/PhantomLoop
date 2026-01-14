// Desync Alert Component - Memoized with cinematic styling

import { memo } from 'react';
import { useStore } from '../store';

export const DesyncAlert = memo(function DesyncAlert() {
  const desyncDetected = useStore((state) => state.desyncDetected);
  const totalLatency = useStore((state) => state.totalLatency);

  if (!desyncDetected) {
    return null;
  }

  return (
    <div className="relative animate-fade-in">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-red-500/30 blur-xl rounded-full" />
      
      {/* Alert card */}
      <div className="relative bg-gradient-to-r from-red-900/90 to-red-800/90 backdrop-blur-md 
        px-6 py-3 rounded-xl border border-red-500/50 shadow-2xl shadow-red-500/30">
        <div className="flex items-center gap-4">
          {/* Animated warning icon */}
          <div className="relative">
            <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-50" />
            <svg
              className="relative w-6 h-6 text-red-300"
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
          </div>
          
          <div>
            <p className="text-red-100 font-bold text-sm tracking-wider">DESYNC DETECTED</p>
            <p className="text-red-300/80 text-xs font-mono">
              Latency: {totalLatency.toFixed(1)}ms • Threshold exceeded
            </p>
          </div>
          
          {/* Latency bar */}
          <div className="ml-4 w-16 h-2 bg-red-950 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-red-500 to-red-300 animate-pulse"
              style={{ width: `${Math.min((totalLatency / 100) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

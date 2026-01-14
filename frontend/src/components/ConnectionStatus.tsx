// Connection Status Indicator - Memoized with improved UI

import { memo } from 'react';
import { useStore } from '../store';

export const ConnectionStatus = memo(function ConnectionStatus() {
  const isConnected = useStore((state) => state.isConnected);
  const sessionCode = useStore((state) => state.sessionCode);
  const connectionError = useStore((state) => state.connectionError);

  return (
    <div className={`glass-panel px-4 py-2.5 rounded-xl transition-all duration-300 ${
      isConnected ? 'border-green-500/30' : connectionError ? 'border-red-500/30' : ''
    }`}>
      <div className="flex items-center gap-3">
        {/* Status Indicator */}
        <div className="relative">
          <div className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
            isConnected ? 'bg-green-500' : connectionError ? 'bg-red-500' : 'bg-gray-500'
          }`}>
            {isConnected && (
              <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-50" />
            )}
          </div>
        </div>

        {/* Status Text */}
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium transition-colors duration-300 ${
            isConnected ? 'text-green-400' : connectionError ? 'text-red-400' : 'text-gray-400'
          }`}>
            {isConnected ? 'Live' : connectionError ? 'Error' : 'Offline'}
          </span>
          {sessionCode && isConnected && (
            <span className="text-xs text-gray-500 font-mono bg-gray-800/50 px-2 py-0.5 rounded">
              {sessionCode}
            </span>
          )}
        </div>
      </div>
      
      {connectionError && (
        <p className="text-xs text-red-400/80 mt-1 animate-fade-in">{connectionError}</p>
      )}
    </div>
  );
});

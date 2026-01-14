// Connection Status Indicator

import { useStore } from '../store';

export function ConnectionStatus() {
  const { isConnected, sessionCode, connectionError } = useStore();

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm px-4 py-3 rounded-lg border border-gray-700">
      <div className="flex items-center gap-3">
        {/* Status Indicator */}
        <div className="relative">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}>
            {isConnected && (
              <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75" />
            )}
          </div>
        </div>

        {/* Status Text */}
        <div>
          <p className="text-sm font-medium text-white">
            {isConnected ? 'Connected' : 'Disconnected'}
          </p>
          {sessionCode && (
            <p className="text-xs text-gray-400 font-mono">{sessionCode}</p>
          )}
          {connectionError && (
            <p className="text-xs text-red-400">{connectionError}</p>
          )}
        </div>
      </div>
    </div>
  );
}

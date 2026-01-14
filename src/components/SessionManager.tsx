// Session Manager Component - Memoized with improved UI

import { memo, useState, useCallback } from 'react';
import { useStore } from '../store';
import { SERVER_CONFIG } from '../utils/constants';
import { Spinner } from './LoadingStates';

export const SessionManager = memo(function SessionManager() {
  const isConnected = useStore((state) => state.isConnected);
  const connectWebSocket = useStore((state) => state.connectWebSocket);
  const disconnectWebSocket = useStore((state) => state.disconnectWebSocket);
  
  const [sessionInput, setSessionInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = useCallback(async () => {
    if (sessionInput.trim()) {
      setIsConnecting(true);
      connectWebSocket(sessionInput.trim());
      // Reset after a delay (connection state will update)
      setTimeout(() => setIsConnecting(false), 2000);
    }
  }, [sessionInput, connectWebSocket]);

  const handleCreateSession = useCallback(async () => {
    setIsCreating(true);
    try {
      const response = await fetch(`${SERVER_CONFIG.BASE_URL.replace('wss://', 'https://').replace('ws://', 'http://')}/api/sessions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await response.json();
      setSessionInput(data.session_code);
      connectWebSocket(data.session_code);
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsCreating(false);
    }
  }, [connectWebSocket]);

  const sessionCode = useStore((state) => state.sessionCode);

  // When connected, show minimal session info with disconnect
  if (isConnected) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50" />
            <span className="text-sm font-medium text-white">Connected</span>
          </div>
          <span className="text-sm font-mono text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20">
            {sessionCode}
          </span>
        </div>
        
        <button
          onClick={disconnectWebSocket}
          className="w-full bg-red-600/90 text-white px-4 py-3 rounded-xl text-sm font-medium 
            hover:bg-red-500 transition-all duration-200 border border-red-500/50"
        >
          Disconnect Session
        </button>
      </div>
    );
  }

  // When not connected, show full session form (though WelcomeScreen handles this now)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2.5 h-2.5 rounded-full bg-gray-500 animate-pulse" />
        <span className="text-sm text-gray-400">Not Connected</span>
      </div>
      
      <input
        type="text"
        value={sessionInput}
        onChange={(e) => setSessionInput(e.target.value)}
        placeholder="Enter session code..."
        className="w-full bg-gray-800/80 text-white px-4 py-3 rounded-xl text-sm border border-gray-600/50 
          focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30
          placeholder:text-gray-500 transition-all duration-200"
      />

      <div className="flex gap-3">
        <button
          onClick={handleConnect}
          disabled={!sessionInput.trim() || isConnecting}
          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 
            text-white px-4 py-3 rounded-xl text-sm font-semibold 
            hover:from-purple-500 hover:to-blue-500 
            disabled:opacity-50 disabled:cursor-not-allowed 
            transition-all duration-200 shadow-lg shadow-purple-500/20"
        >
          {isConnecting ? (
            <>
              <Spinner size="xs" color="phantom" />
              Connecting...
            </>
          ) : (
            'Connect'
          )}
        </button>
        <button
          onClick={handleCreateSession}
          disabled={isCreating}
          className="flex-1 flex items-center justify-center gap-2 bg-gray-800 text-white 
            px-4 py-3 rounded-xl text-sm font-medium 
            hover:bg-gray-700 disabled:opacity-50 
            transition-all duration-200 border border-gray-600/50"
        >
          {isCreating ? (
            <>
              <Spinner size="xs" color="white" />
              Creating...
            </>
          ) : (
            'New Session'
          )}
        </button>
      </div>
    </div>
  );
});

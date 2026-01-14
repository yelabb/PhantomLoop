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

  return (
    <div className="glass-panel p-4 rounded-xl w-80 pointer-events-auto animate-slide-up">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-phantom animate-pulse" />
        <h3 className="text-sm font-semibold text-white">Session</h3>
      </div>
      
      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={sessionInput}
          onChange={(e) => setSessionInput(e.target.value)}
          placeholder="Enter session code..."
          className="bg-gray-800/80 text-white px-3 py-2.5 rounded-lg text-sm border border-gray-600/50 
            focus:border-phantom focus:outline-none focus:ring-1 focus:ring-phantom/50
            placeholder:text-gray-500 transition-all duration-200"
          disabled={isConnected}
        />

        <div className="flex gap-2">
          {!isConnected ? (
            <>
              <button
                onClick={handleConnect}
                disabled={!sessionInput.trim() || isConnecting}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-phantom to-yellow-500 
                  text-black px-3 py-2.5 rounded-lg text-sm font-semibold 
                  hover:from-yellow-400 hover:to-yellow-500 
                  disabled:opacity-50 disabled:cursor-not-allowed 
                  transition-all duration-200 shadow-lg shadow-phantom/20"
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
                className="flex-1 flex items-center justify-center gap-2 bg-gray-700/80 text-white 
                  px-3 py-2.5 rounded-lg text-sm font-medium 
                  hover:bg-gray-600 disabled:opacity-50 
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
            </>
          ) : (
            <button
              onClick={disconnectWebSocket}
              className="w-full bg-red-600/90 text-white px-3 py-2.5 rounded-lg text-sm font-medium 
                hover:bg-red-500 transition-all duration-200 border border-red-500/50"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

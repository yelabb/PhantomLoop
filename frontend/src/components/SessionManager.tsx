// Session Manager Component

import { useState } from 'react';
import { useStore } from '../store';
import { SERVER_CONFIG } from '../utils/constants';

export function SessionManager() {
  const { isConnected, connectWebSocket, disconnectWebSocket } = useStore();
  const [sessionInput, setSessionInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleConnect = () => {
    if (sessionInput.trim()) {
      connectWebSocket(sessionInput.trim());
    }
  };

  const handleCreateSession = async () => {
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
  };

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm p-4 rounded-lg border border-gray-700 w-80">
      <h3 className="text-sm font-semibold text-white mb-3">Session</h3>
      
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={sessionInput}
          onChange={(e) => setSessionInput(e.target.value)}
          placeholder="Session code..."
          className="bg-gray-800 text-white px-3 py-2 rounded text-sm border border-gray-600 focus:border-phantom focus:outline-none"
          disabled={isConnected}
        />

        <div className="flex gap-2">
          {!isConnected ? (
            <>
              <button
                onClick={handleConnect}
                disabled={!sessionInput.trim()}
                className="flex-1 bg-phantom text-black px-3 py-2 rounded text-sm font-medium hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Connect
              </button>
              <button
                onClick={handleCreateSession}
                disabled={isCreating}
                className="flex-1 bg-gray-700 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gray-600 disabled:opacity-50 transition"
              >
                {isCreating ? 'Creating...' : 'New Session'}
              </button>
            </>
          ) : (
            <button
              onClick={disconnectWebSocket}
              className="w-full bg-red-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-red-700 transition"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

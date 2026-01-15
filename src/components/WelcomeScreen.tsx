// Welcome Screen - First-time user onboarding

import { memo, useState, useCallback } from 'react';
import { useStore } from '../store';
import { SERVER_CONFIG } from '../utils/constants';
import { Spinner } from './LoadingStates';

export const WelcomeScreen = memo(function WelcomeScreen() {
  const connectWebSocket = useStore((state) => state.connectWebSocket);
  const connectionError = useStore((state) => state.connectionError);
  
  const [serverUrl, setServerUrl] = useState(SERVER_CONFIG.BASE_URL);
  const [sessionInput, setSessionInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    if (sessionInput.trim()) {
      setIsConnecting(true);
      setError(null);
      connectWebSocket(sessionInput.trim());
      setTimeout(() => setIsConnecting(false), 2000);
    }
  }, [sessionInput, connectWebSocket]);

  const handleCreateSession = useCallback(async () => {
    setIsCreating(true);
    setError(null);
    try {
      const apiUrl = serverUrl.replace('wss://', 'https://').replace('ws://', 'http://');
      const response = await fetch(`${apiUrl}/api/sessions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error('Failed to create session');
      }
      
      const data = await response.json();
      setSessionInput(data.session_code);
      connectWebSocket(data.session_code);
    } catch (err) {
      console.error('Failed to create session:', err);
      setError('Failed to create session. Make sure PhantomLink server is running.');
    } finally {
      setIsCreating(false);
    }
  }, [connectWebSocket, serverUrl]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && sessionInput.trim()) {
      handleConnect();
    }
  }, [sessionInput, handleConnect]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
      {/* Animated background gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[100px] opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-phantom/40 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-loopback/40 rounded-full blur-[128px] animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-biolink/30 rounded-full blur-[96px] animate-pulse delay-500" />
        </div>
      </div>

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 200, 50, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 200, 50, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-8 p-8 max-w-lg mx-4">
        {/* Logo and title */}
        <div className="text-center animate-fade-in">
          <div className="flex justify-center mb-4">
            <img 
              src="/logo.png" 
              alt="PhantomLoop" 
              className="h-20 w-auto object-contain"
            />
          </div>
          <p className="text-gray-400 tracking-[0.3em] text-sm uppercase">
        Neural Gauntlet Arena
          </p>
        </div>

        {/* Description */}
        <div className="text-center space-y-2 animate-fade-in delay-200">
          <p className="text-gray-300 text-lg">
            Real-time neural signal visualization & decoder testing
          </p>
          <p className="text-gray-500 text-sm">
            Connect to PhantomLink to stream neural data
          </p>
        </div>

        {/* Session card */}
        <div className="w-full bg-gray-900/90 backdrop-blur-sm p-6 border border-gray-700/50">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-3 h-3 bg-gradient-to-r from-phantom to-loopback" />
            <h2 className="text-lg font-semibold text-white">Start a Session</h2>
          </div>

          <div className="space-y-4">
            {/* Server URL configuration */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400 block">PhantomLink Server URL</label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="ws://localhost:8000"
                className="w-full bg-gray-800/80 text-white px-4 py-3 text-sm 
                  border border-gray-600/50 focus:border-biolink focus:outline-none 
                  focus:ring-1 focus:ring-biolink/30 placeholder:text-gray-500 
                  transition-all duration-200 font-mono"
              />
              <p className="text-xs text-gray-500">
                Enter your server URL or use the default
              </p>
            </div>

            {/* Join existing session */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400 block">Join existing session</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sessionInput}
                  onChange={(e) => setSessionInput(e.target.value.toUpperCase())}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter session code..."
                  className="flex-1 bg-gray-800/80 text-white px-4 py-3 text-sm 
                    border border-gray-600/50 focus:border-phantom focus:outline-none 
                    focus:ring-1 focus:ring-phantom/30 placeholder:text-gray-500 
                    transition-all duration-200 font-mono tracking-wider"
                  disabled={isConnecting}
                  maxLength={8}
                />
                <button
                  onClick={handleConnect}
                  disabled={!sessionInput.trim() || isConnecting}
                  className="px-6 py-3 bg-gradient-to-r from-phantom to-yellow-500 
                    text-black text-sm font-bold
                    hover:from-yellow-400 hover:to-yellow-500 
                    disabled:opacity-50 disabled:cursor-not-allowed 
                    transition-all duration-200
                    flex items-center gap-2 min-w-[100px] justify-center"
                >
                  {isConnecting ? (
                    <>
                      <Spinner size="xs" color="phantom" />
                      <span>...</span>
                    </>
                  ) : (
                    'Join'
                  )}
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 py-2">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
              <span className="text-gray-500 text-xs uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
            </div>

            {/* Create new session */}
            <button
              onClick={handleCreateSession}
              disabled={isCreating}
              className="w-full py-4 bg-gray-800/80 text-white text-sm font-semibold
                hover:bg-gray-700/80 disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200 border border-gray-600/50 hover:border-phantom/50
                flex items-center justify-center gap-3 group"
            >
              {isCreating ? (
                <>
                  <Spinner size="sm" color="white" />
                  <span>Creating session...</span>
                </>
              ) : (
                <>
                  <span className="text-xl group-hover:scale-110 transition-transform">+</span>
                  <span>Create New Session</span>
                </>
              )}
            </button>
          </div>

          {/* Error message */}
          {(error || connectionError) && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50">
              <p className="text-red-400 text-sm text-center">
                {error || connectionError}
              </p>
            </div>
          )}
        </div>

        {/* Features hint */}
        <div className="flex flex-wrap justify-center gap-6 text-center animate-fade-in delay-500">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-2 h-2 rounded-sm bg-phantom" />
            <span>3D Visualization</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-2 h-2 rounded-sm bg-loopback" />
            <span>Neural Decoders</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-2 h-2 rounded-sm bg-biolink" />
            <span>Real-time Metrics</span>
          </div>
        </div>

        {/* Keyboard hint */}
        <p className="text-gray-600 text-xs animate-fade-in delay-700">
          Press Enter to join after entering a session code
        </p>
      </div>
    </div>
  );
});

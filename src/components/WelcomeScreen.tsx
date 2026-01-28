// Welcome Screen - First-time user onboarding

import { memo, useState, useCallback, useEffect } from 'react';
import { useStore } from '../store';
import { SERVER_CONFIG } from '../utils/constants';
import { Spinner } from './LoadingStates';
import { useESPEEG } from '../hooks/useESPEEG';

type DataSourceType = 'phantomlink' | 'esp-eeg';

interface WelcomeScreenProps {
  onConnectToDashboard?: () => void;
  onConnectToESPEEG?: () => void;
}

export const WelcomeScreen = memo(function WelcomeScreen({ onConnectToDashboard, onConnectToESPEEG }: WelcomeScreenProps) {
  const connectWebSocket = useStore((state) => state.connectWebSocket);
  const isConnected = useStore((state) => state.isConnected);
  const connectionError = useStore((state) => state.connectionError);
  const setDataSource = useStore((state) => state.setDataSource);
  
  // ESP-EEG hook
  const { 
    connectionStatus: espConnectionStatus, 
    connect: connectESPEEG, 
    lastError: espLastError,
    isDemoMode,
    startDemoMode,
  } = useESPEEG();
  
  const [dataSourceType, setDataSourceType] = useState<DataSourceType>('phantomlink');
  const [serverUrl, setServerUrl] = useState<string>(SERVER_CONFIG.BASE_URL);
  const [espEEGUrl, setEspEEGUrl] = useState<string>('ws://localhost:8765');
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

  // Handle ESP-EEG connection
  const handleConnectESPEEG = useCallback(() => {
    setIsConnecting(true);
    setError(null);
    setDataSource({
      type: 'esp-eeg',
      url: espEEGUrl,
      protocol: 'websocket',
    });
    connectESPEEG(espEEGUrl);
  }, [espEEGUrl, connectESPEEG, setDataSource]);

  // Handle ESP-EEG demo mode
  const handleStartDemoMode = useCallback(() => {
    setDataSource({
      type: 'esp-eeg',
      url: 'demo://simulated',
      protocol: 'websocket', // Demo uses simulated websocket-like interface
    });
    startDemoMode({ scenario: 'realistic', simulateAlpha: true });
  }, [startDemoMode, setDataSource]);

  // Auto-navigate to dashboard when PhantomLink connected
  useEffect(() => {
    if (isConnected && onConnectToDashboard) {
      onConnectToDashboard();
    }
  }, [isConnected, onConnectToDashboard]);

  // Auto-navigate to electrode placement when ESP-EEG connects or demo mode starts
  useEffect(() => {
    if ((espConnectionStatus === 'connected' || isDemoMode) && onConnectToESPEEG) {
      setIsConnecting(false);
      onConnectToESPEEG();
    }
  }, [espConnectionStatus, isDemoMode, onConnectToESPEEG]);

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
            {/* Data Source Selector */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400 block">Data Source</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDataSourceType('phantomlink')}
                  className={`p-3 border transition-all duration-200 text-left ${
                    dataSourceType === 'phantomlink'
                      ? 'border-phantom bg-phantom/10 text-white'
                      : 'border-gray-600/50 bg-gray-800/50 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${dataSourceType === 'phantomlink' ? 'bg-phantom' : 'bg-gray-500'}`} />
                    <span className="font-medium text-sm">PhantomLink</span>
                  </div>
                  <p className="text-xs text-gray-500">MC_Maze neural spiking data</p>
                </button>
                <button
                  onClick={() => setDataSourceType('esp-eeg')}
                  className={`p-3 border transition-all duration-200 text-left ${
                    dataSourceType === 'esp-eeg'
                      ? 'border-biolink bg-biolink/10 text-white'
                      : 'border-gray-600/50 bg-gray-800/50 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${dataSourceType === 'esp-eeg' ? 'bg-biolink' : 'bg-gray-500'}`} />
                    <span className="font-medium text-sm">ESP-EEG</span>
                  </div>
                  <p className="text-xs text-gray-500">Cerelog 8-ch EEG hardware</p>
                </button>
              </div>
            </div>

            {/* PhantomLink Options */}
            {dataSourceType === 'phantomlink' && (
              <>
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
              </>
            )}

            {/* ESP-EEG Options */}
            {dataSourceType === 'esp-eeg' && (
              <>
                {/* WebSocket Bridge URL */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 block">WebSocket Bridge URL</label>
                  <input
                    type="text"
                    value={espEEGUrl}
                    onChange={(e) => setEspEEGUrl(e.target.value)}
                    placeholder="ws://localhost:8765"
                    className="w-full bg-gray-800/80 text-white px-4 py-3 text-sm 
                      border border-gray-600/50 focus:border-biolink focus:outline-none 
                      focus:ring-1 focus:ring-biolink/30 placeholder:text-gray-500 
                      transition-all duration-200 font-mono"
                    disabled={isConnecting}
                  />
                  <p className="text-xs text-gray-500">
                    Connects to a local bridge that proxies TCP data from the ESP-EEG device.{' '}
                    <a
                      href="https://github.com/yelabb/PhantomLoop/blob/main/CERELOG_INTEGRATION.md"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-biolink hover:text-biolink/80 underline"
                    >
                      Setup guide →
                    </a>
                  </p>
                </div>

                {/* Connect button */}
                <button
                  onClick={handleConnectESPEEG}
                  disabled={isConnecting || espConnectionStatus === 'connecting'}
                  className="w-full py-4 bg-gradient-to-r from-biolink to-cyan-500 
                    text-black text-sm font-bold
                    hover:from-cyan-400 hover:to-cyan-500 
                    disabled:opacity-50 disabled:cursor-not-allowed 
                    transition-all duration-200
                    flex items-center justify-center gap-2"
                >
                  {isConnecting || espConnectionStatus === 'connecting' ? (
                    <>
                      <Spinner size="sm" color="white" />
                      <span>Connecting to ESP-EEG...</span>
                    </>
                  ) : (
                    <>
                      <span>🧠</span>
                      <span>Connect to ESP-EEG</span>
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 py-2">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
                  <span className="text-gray-500 text-xs uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
                </div>

                {/* Demo mode */}
                <button
                  onClick={handleStartDemoMode}
                  className="w-full py-4 bg-gray-800/80 text-white text-sm font-semibold
                    hover:bg-gray-700/80 transition-all duration-200 
                    border border-gray-600/50 hover:border-biolink/50
                    flex items-center justify-center gap-3 group"
                >
                  <span className="text-xl group-hover:scale-110 transition-transform">🎮</span>
                  <span>Start Demo Mode</span>
                </button>

                <p className="text-xs text-gray-500 text-center">
                  Demo mode generates realistic EEG signals for testing without hardware
                </p>
              </>
            )}
          </div>

          {/* Error message */}
          {(error || connectionError || espLastError) && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50">
              <p className="text-red-400 text-sm text-center">
                {error || connectionError || espLastError}
              </p>
            </div>
          )}
        </div>

        {/* Features hint - more compact */}
        <div className="flex flex-wrap justify-center gap-4 text-center animate-fade-in delay-500">
          <div className="flex items-center gap-1.5 text-gray-500 text-xs">
            <div className="w-1.5 h-1.5 rounded-sm bg-phantom" />
            <span>Visualization</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-500 text-xs">
            <div className="w-1.5 h-1.5 rounded-sm bg-loopback" />
            <span>Neural Decoders</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-500 text-xs">
            <div className="w-1.5 h-1.5 rounded-sm bg-biolink" />
            <span>Real-time Metrics</span>
          </div>
        </div>

        {/* Footer with keyboard hint and GitHub - subtle */}
        <div className="flex flex-col items-center gap-3 animate-fade-in delay-600">
          <p className="text-gray-600 text-xs">
            Press Enter to join after entering a session code
          </p>
          <a
            href="https://github.com/yelabb/PhantomLoop"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-400 text-xs transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            <span>Fork on GitHub</span>
          </a>
        </div>
      </div>
    </div>
  );
});

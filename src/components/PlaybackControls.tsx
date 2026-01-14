import { memo, useCallback, useState } from 'react';
import { useStore } from '../store';
import { SERVER_CONFIG } from '../utils/constants';

// Icons
const PlayIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>;
const PauseIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>;
const StopIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>;

export const PlaybackControls = memo(function PlaybackControls() {
  const sessionCode = useStore((state) => state.sessionCode);
  const isConnected = useStore((state) => state.isConnected);
  const [isPlaying, setIsPlaying] = useState(true);

  const getApiUrl = () => {
    // Convert logic from SessionManager
    // e.g. wss://host:port/ws -> https://host:port
    const base = SERVER_CONFIG.BASE_URL.replace('wss://', 'https://').replace('ws://', 'http://');
    // Remove /ws if present (backend server usually has /api at root, but sometimes it's configured differently)
    // Looking at server.py, endpoints are /api/control/...
    // SessionManager used: .../api/sessions/create
    return base;
  };

  const handleControl = useCallback(async (action: 'pause' | 'resume' | 'stop') => {
    if (!sessionCode) return;
    try {
      const url = `${getApiUrl()}/api/control/${sessionCode}/${action}`;
      await fetch(url, { method: 'POST' });
      
      if (action === 'pause') setIsPlaying(false);
      if (action === 'resume') setIsPlaying(true);
      if (action === 'stop') setIsPlaying(false);
      
    } catch (error) {
      console.error(`Failed to ${action} playback:`, error);
    }
  }, [sessionCode]);

  if (!isConnected) return null;

  return (
    <div className="flex items-center gap-2 bg-gray-800/80 backdrop-blur-sm px-4 py-2 border border-gray-700/50">
      <button
        onClick={() => handleControl('resume')}
        disabled={isPlaying}
        className={`p-2 transition-colors ${
            isPlaying 
                ? 'text-gray-600 cursor-not-allowed' 
                : 'text-white bg-green-600 hover:bg-green-500'
        }`}
        title="Resume Stream"
      >
        <PlayIcon />
      </button>
      
      <button
        onClick={() => handleControl('pause')}
        disabled={!isPlaying}
        className={`p-2 transition-colors ${
            !isPlaying 
                ? 'text-gray-600 cursor-not-allowed' 
                : 'text-white bg-yellow-600 hover:bg-yellow-500'
        }`}
        title="Pause Stream"
      >
        <PauseIcon />
      </button>

      <div className="w-px h-6 bg-gray-700 mx-1" />

       <button
        onClick={() => handleControl('stop')}
        className="p-2 text-red-400 hover:bg-red-500/10 transition-colors"
        title="Stop/Reset"
      >
        <StopIcon />
      </button>
    </div>
  );
});

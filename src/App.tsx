// PhantomLoop - The Neural Gauntlet Arena

import { useEffect, useState } from 'react';
import { Arena } from './components/Arena';
import { Dashboard } from './components/Dashboard';
import { ResearchDashboard } from './components/ResearchDashboard';
import { WelcomeScreen } from './components/WelcomeScreen';
import { useMessagePack } from './hooks/useMessagePack';
import { useDecoder } from './hooks/useDecoder';
import { usePerformance } from './hooks/usePerformance';
import { useStore } from './store';

type ViewMode = 'research' | 'legacy' | '3d';

function App() {
  // Check connection state
  const isConnected = useStore((state) => state.isConnected);
  
  // View mode toggle (default to research view)
  const [viewMode, setViewMode] = useState<ViewMode>('research');
  
  // Initialize hooks
  useMessagePack();
  useDecoder();
  usePerformance();
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'v' || e.key === 'V') {
        setViewMode(prev => {
          const modes: ViewMode[] = ['research', '3d', 'legacy'];
          const currentIndex = modes.indexOf(prev);
          return modes[(currentIndex + 1) % modes.length];
        });
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-black relative">
      {/* Welcome screen when not connected */}
      {!isConnected && <WelcomeScreen />}
      
      {/* 3D Visualization (behind 2D overlay when in research mode) */}
      {viewMode !== 'research' && <Arena />}
      
      {/* UI Overlay based on mode */}
      {viewMode === 'research' ? (
        <ResearchDashboard />
      ) : (
        <Dashboard />
      )}
      
      {/* View mode indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
        <div className="flex items-center gap-1 bg-gray-900/80 backdrop-blur-sm rounded-full p-1 border border-gray-700/50">
          {(['research', '3d', 'legacy'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-[10px] font-medium uppercase tracking-wider rounded-full transition-all ${
                viewMode === mode
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {mode === 'research' ? '2D Research' : mode === '3d' ? '3D Arena' : 'Legacy'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;

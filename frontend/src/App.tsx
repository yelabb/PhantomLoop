// PhantomLoop - The Neural Gauntlet Arena

import { useEffect } from 'react';
import { Arena } from './components/Arena';
import { Dashboard } from './components/Dashboard';
import { WelcomeScreen } from './components/WelcomeScreen';
import { useWebSocket } from './hooks/useWebSocket';
import { useMessagePack } from './hooks/useMessagePack';
import { useDecoder } from './hooks/useDecoder';
import { usePerformance } from './hooks/usePerformance';
import { useStore } from './store';

function App() {
  // Check connection state
  const isConnected = useStore((state) => state.isConnected);
  
  // Initialize hooks
  useMessagePack();
  useDecoder();
  usePerformance();

  return (
    <div className="w-screen h-screen overflow-hidden bg-black relative">
      {/* Welcome screen when not connected */}
      {!isConnected && <WelcomeScreen />}
      
      {/* 3D Visualization */}
      <Arena />
      
      {/* UI Overlay */}
      <Dashboard />
    </div>
  );
}

export default App;

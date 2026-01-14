// PhantomLoop - The Neural Gauntlet Arena

import { useEffect } from 'react';
import { Arena } from './components/Arena';
import { Dashboard } from './components/Dashboard';
import { useWebSocket } from './hooks/useWebSocket';
import { useMessagePack } from './hooks/useMessagePack';
import { useDecoder } from './hooks/useDecoder';
import { usePerformance } from './hooks/usePerformance';

function App() {
  // Initialize hooks
  useMessagePack();
  useDecoder();
  usePerformance();

  return (
    <div className="w-screen h-screen overflow-hidden bg-black relative">
      {/* 3D Visualization */}
      <Arena />
      
      {/* UI Overlay */}
      <Dashboard />
    </div>
  );
}

export default App;

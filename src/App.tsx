// PhantomLoop - The Neural Gauntlet Arena

import { ResearchDashboard } from './components/ResearchDashboard';
import { WelcomeScreen } from './components/WelcomeScreen';
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
      
      {/* Research Dashboard */}
      <ResearchDashboard />
    </div>
  );
}

export default App;

// PhantomLoop - The Neural Gauntlet Arena

import { useState, useEffect, useRef } from 'react';
import { ResearchDashboard } from './components/ResearchDashboard';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ElectrodePlacementScreen } from './components/ElectrodePlacementScreen';
import { useMessagePack } from './hooks/useMessagePack';
import { useDecoder } from './hooks/useDecoder';
import { usePerformance } from './hooks/usePerformance';
import { useStore } from './store';

type AppScreen = 'welcome' | 'electrode-placement' | 'dashboard';

function App() {
  // Navigation state
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('welcome');
  
  // Check connection state
  const isConnected = useStore((state) => state.isConnected);
  
  // Initialize hooks
  useMessagePack();
  useDecoder();
  usePerformance();

  // Handle disconnection - return to welcome screen
  // Track previous connection state to detect disconnect
  const wasConnectedRef = useRef(false);
  
  useEffect(() => {
    if (wasConnectedRef.current && !isConnected && currentScreen === 'dashboard') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentScreen('welcome');
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected, currentScreen]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-black relative">
      {/* Welcome screen */}
      {currentScreen === 'welcome' && (
        <WelcomeScreen 
          onConnectToDashboard={() => setCurrentScreen('dashboard')}
          onConnectToESPEEG={() => setCurrentScreen('electrode-placement')}
        />
      )}
      
      {/* Electrode placement screen */}
      {currentScreen === 'electrode-placement' && (
        <ElectrodePlacementScreen 
          onBack={() => setCurrentScreen('welcome')}
          onContinue={() => setCurrentScreen('dashboard')}
        />
      )}
      
      {/* Research Dashboard */}
      {currentScreen === 'dashboard' && (
        <ResearchDashboard 
          onConfigureElectrodes={() => setCurrentScreen('electrode-placement')}
        />
      )}
    </div>
  );
}

export default App;

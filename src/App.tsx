// PhantomLoop - The Neural Gauntlet Arena

import { useState, useEffect, useRef } from 'react';
import { ResearchDashboard } from './components/ResearchDashboard';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ElectrodePlacementScreen } from './components/ElectrodePlacementScreen';
import { useMessagePack } from './hooks/useMessagePack';
import { useDecoder } from './hooks/useDecoder';
import { usePerformance } from './hooks/usePerformance';
import { useESPEEG } from './hooks/useESPEEG';
import { useStore } from './store';

type AppScreen = 'welcome' | 'electrode-placement' | 'dashboard';

function App() {
  // Navigation state
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('welcome');
  
  // Check connection state (PhantomLink)
  const isConnected = useStore((state) => state.isConnected);
  const dataSource = useStore((state) => state.dataSource);
  
  // Check ESP-EEG connection state
  const { connectionStatus: espConnectionStatus } = useESPEEG();
  
  // Initialize hooks
  useMessagePack();
  useDecoder();
  usePerformance();

  // Handle disconnection - return to welcome screen
  // Track previous connection state to detect disconnect
  const wasConnectedRef = useRef(false);
  const wasESPConnectedRef = useRef(false);
  
  // PhantomLink disconnection handling
  useEffect(() => {
    if (wasConnectedRef.current && !isConnected && currentScreen === 'dashboard') {
      setCurrentScreen('welcome');
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected, currentScreen]);

  // ESP-EEG disconnection handling
  useEffect(() => {
    const isESPConnected = espConnectionStatus === 'connected';
    const isOnESPScreen = currentScreen === 'electrode-placement' || 
      (currentScreen === 'dashboard' && dataSource?.type === 'esp-eeg');
    
    if (wasESPConnectedRef.current && !isESPConnected && isOnESPScreen) {
      setCurrentScreen('welcome');
    }
    wasESPConnectedRef.current = isESPConnected;
  }, [espConnectionStatus, currentScreen, dataSource?.type]);

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

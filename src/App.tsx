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
  
  // Check if a modal is blocking navigation
  const isModalBlocking = useStore((state) => state.isModalBlocking);
  
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
    // Don't navigate away if a modal is open (e.g., Add Decoder modal with AI generation)
    if (isModalBlocking()) {
      wasConnectedRef.current = isConnected;
      return;
    }
    
    if (wasConnectedRef.current && !isConnected && currentScreen === 'dashboard') {
      // Use setTimeout to avoid setState during render cycle
      setTimeout(() => setCurrentScreen('welcome'), 0);
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected, currentScreen, isModalBlocking]);

  // ESP-EEG disconnection handling
  useEffect(() => {
    const isESPConnected = espConnectionStatus === 'connected';
    const isOnESPScreen = currentScreen === 'electrode-placement' || 
      (currentScreen === 'dashboard' && dataSource?.type === 'esp-eeg');
    
    // Don't navigate away if a modal is open
    if (isModalBlocking()) {
      wasESPConnectedRef.current = isESPConnected;
      return;
    }
    
    if (wasESPConnectedRef.current && !isESPConnected && isOnESPScreen) {
      // Use setTimeout to avoid setState during render cycle
      setTimeout(() => setCurrentScreen('welcome'), 0);
    }
    wasESPConnectedRef.current = isESPConnected;
  }, [espConnectionStatus, currentScreen, dataSource?.type, isModalBlocking]);

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

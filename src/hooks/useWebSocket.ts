// WebSocket connection hook

import { useEffect } from 'react';
import { useStore } from '../store';
import { STREAM_CONFIG } from '../utils/constants';

export function useWebSocket() {
  const { 
    websocket, 
    isConnected, 
    sessionCode,
    connectWebSocket, 
    disconnectWebSocket 
  } = useStore();

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (websocket && isConnected) {
        disconnectWebSocket();
      }
    };
  }, [websocket, isConnected, disconnectWebSocket]);

  return {
    websocket,
    isConnected,
    sessionCode,
    connect: connectWebSocket,
    disconnect: disconnectWebSocket,
  };
}

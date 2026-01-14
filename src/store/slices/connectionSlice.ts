// Connection state slice

import type { StateCreator } from 'zustand';
import { SERVER_CONFIG } from '../../utils/constants';

export interface ConnectionSlice {
  websocket: WebSocket | null;
  isConnected: boolean;
  sessionCode: string | null;
  connectionError: string | null;
  
  connectWebSocket: (sessionCode: string) => void;
  disconnectWebSocket: () => void;
  setConnectionError: (error: string | null) => void;
}

export const createConnectionSlice: StateCreator<
  ConnectionSlice,
  [],
  [],
  ConnectionSlice
> = (set, get) => ({
  websocket: null,
  isConnected: false,
  sessionCode: null,
  connectionError: null,

  connectWebSocket: (sessionCode: string) => {
    const { websocket: existingWs } = get();
    
    // Close existing connection
    if (existingWs) {
      existingWs.close();
    }

    try {
      const wsUrl = `${SERVER_CONFIG.BASE_URL}/stream/binary/${sessionCode}`;
      console.log(`[PhantomLoop] 🔌 CONNECTING TO: ${wsUrl}`);
      console.log(`[PhantomLoop] 📍 BASE_URL: ${SERVER_CONFIG.BASE_URL}`);
      
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        console.log(`[PhantomLoop] ✅ CONNECTED to session: ${sessionCode}`);
        set({ 
          isConnected: true, 
          sessionCode, 
          connectionError: null 
        });
      };

      ws.onerror = (error) => {
        console.error('[PhantomLoop] WebSocket error:', error);
        set({ 
          connectionError: 'Failed to connect to PhantomLink server',
          isConnected: false 
        });
      };

      ws.onclose = () => {
        console.log('[PhantomLoop] Connection closed');
        set({ 
          isConnected: false, 
          websocket: null 
        });
      };

      set({ websocket: ws });
    } catch (error) {
      console.error('[PhantomLoop] Connection error:', error);
      set({ 
        connectionError: error instanceof Error ? error.message : 'Unknown error',
        isConnected: false 
      });
    }
  },

  disconnectWebSocket: () => {
    const { websocket } = get();
    if (websocket) {
      websocket.close();
      set({ 
        websocket: null, 
        isConnected: false, 
        sessionCode: null 
      });
    }
  },

  setConnectionError: (error: string | null) => {
    set({ connectionError: error });
  },
});

// MessagePack decoder hook - Optimized with selectors

import { useEffect, useRef } from 'react';
import msgpack from 'msgpack-lite';
import { useStore } from '../store';
import type { StreamPacket, MetadataMessage } from '../types/packets';

// Use selectors to prevent unnecessary re-renders
const selectWebSocket = (state: ReturnType<typeof useStore.getState>) => state.websocket;
const selectIsConnected = (state: ReturnType<typeof useStore.getState>) => state.isConnected;
const selectReceivePacket = (state: ReturnType<typeof useStore.getState>) => state.receivePacket;
const selectUpdateNetworkLatency = (state: ReturnType<typeof useStore.getState>) => state.updateNetworkLatency;

export function useMessagePack() {
  const websocket = useStore(selectWebSocket);
  const isConnected = useStore(selectIsConnected);
  const receivePacket = useStore(selectReceivePacket);
  const updateNetworkLatency = useStore(selectUpdateNetworkLatency);
  
  // Track packet count for throttled logging
  const packetCountRef = useRef(0);

  useEffect(() => {
    if (!websocket || !isConnected) {
      return;
    }

    console.log('[PhantomLoop] 📬 MessagePack: Listening for messages...');

    const handleMessage = (event: MessageEvent) => {
      try {
        const receiveTime = performance.now();
        
        // Decode MessagePack binary data
        const decoded = msgpack.decode(new Uint8Array(event.data));
        
        if (decoded.type === 'data') {
          const packet = decoded as StreamPacket;
          packetCountRef.current++;
          
          // Calculate network latency using packet timestamp
          if (packet.data?.timestamp) {
            const packetTimestamp = packet.data.timestamp * 1000; // Convert to ms
            const latency = receiveTime - packetTimestamp;
            updateNetworkLatency(Math.max(0, latency));
          }
          
          // Log every 100th packet to reduce console spam
          if (packetCountRef.current % 100 === 0) {
            console.log(`[PhantomLoop] 📊 Received ${packetCountRef.current} packets`);
          }
          
          // Update store
          receivePacket(packet);
          
        } else if (decoded.type === 'metadata') {
          const metadata = decoded as MetadataMessage;
          console.log('[PhantomLoop] Received metadata:', metadata.data);
        }
      } catch (error) {
        console.error('[PhantomLoop] ❌ MessagePack decode error:', error);
      }
    };

    websocket.addEventListener('message', handleMessage);
    
    // Capture current value for cleanup
    const currentPacketCount = packetCountRef.current;

    return () => {
      websocket.removeEventListener('message', handleMessage);
      console.log(`[PhantomLoop] 🔇 Disconnected after ${currentPacketCount} packets`);
    };
  }, [websocket, isConnected, receivePacket, updateNetworkLatency]);
}

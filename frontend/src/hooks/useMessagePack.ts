// MessagePack decoder hook

import { useEffect } from 'react';
import msgpack from 'msgpack-lite';
import { useStore } from '../store';
import type { StreamPacket, MetadataMessage } from '../types/packets';

export function useMessagePack() {
  const { 
    websocket, 
    isConnected,
    receivePacket,
    updateNetworkLatency 
  } = useStore();

  useEffect(() => {
    if (!websocket || !isConnected) {
      console.log('[PhantomLoop] 📭 MessagePack hook: No WebSocket or not connected');
      return;
    }

    console.log('[PhantomLoop] 📬 MessagePack hook: Listening for messages...');

    const handleMessage = (event: MessageEvent) => {
      console.log('[PhantomLoop] 📨 Received message, size:', event.data.byteLength, 'bytes');
      
      try {
        const receiveTime = performance.now();
        
        // Decode MessagePack binary data
        const decoded = msgpack.decode(new Uint8Array(event.data));
        console.log('[PhantomLoop] ✅ Decoded packet:', JSON.stringify(decoded).substring(0, 200));
        
        if (decoded.type === 'data') {
          const packet = decoded as StreamPacket;
          
          // Calculate network latency using packet timestamp
          if (packet.data?.timestamp) {
            const packetTimestamp = packet.data.timestamp * 1000; // Convert to ms
            const latency = receiveTime - packetTimestamp;
            console.log('[PhantomLoop] 📊 Packet #', packet.data.sequence_number, 'latency:', latency.toFixed(2), 'ms');
            updateNetworkLatency(Math.max(0, latency));
          }
          
          // Update store
          receivePacket(packet);
          
        } else if (decoded.type === 'metadata') {
          const metadata = decoded as MetadataMessage;
          console.log('[PhantomLoop] Received metadata:', metadata.data);
        }
      } catch (error) {
        console.error('[PhantomLoop] ❌ MessagePack decode error:', error);
        console.error('[PhantomLoop] Raw data preview:', new Uint8Array(event.data).slice(0, 50));
      }
    };

    websocket.addEventListener('message', handleMessage);
    console.log('[PhantomLoop] ✅ Message listener attached');

    return () => {
      websocket.removeEventListener('message', handleMessage);
      console.log('[PhantomLoop] 🔇 Message listener removed');
    };
  }, [websocket, isConnected, receivePacket, updateNetworkLatency]);
}

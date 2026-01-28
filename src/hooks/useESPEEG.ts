/**
 * Custom hook for managing ESP-EEG device connection
 * Handles WebSocket connection, impedance monitoring, and data streaming
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useStore } from '../store';
import type { ImpedanceData } from '../types/electrodes';
import { getImpedanceQuality } from '../types/electrodes';

interface ESPEEGMessage {
  type: 'impedance' | 'data' | 'status';
  timestamp: number;
  payload: unknown;
}

interface ImpedanceMessage {
  type: 'impedance';
  timestamp: number;
  payload: {
    channels: Array<{
      channel: number;
      impedance: number;
    }>;
  };
}

interface DataMessage {
  type: 'data';
  timestamp: number;
  payload: {
    samples: number[][];
    sampleRate: number;
  };
}

interface StatusMessage {
  type: 'status';
  timestamp: number;
  payload: {
    connected: boolean;
    battery?: number;
    error?: string;
  };
}

export function useESPEEG() {
  const {
    isMonitoringImpedance,
    batchUpdateImpedances,
    setImpedanceMonitoring,
  } = useStore();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectUrlRef = useRef<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);

  // Handle impedance data
  const handleImpedanceMessage = useCallback((message: ImpedanceMessage) => {
    const impedanceData: ImpedanceData[] = message.payload.channels.map((ch) => ({
      channelId: ch.channel,
      electrodeId: `electrode-${ch.channel}`,
      impedance: ch.impedance,
      timestamp: message.timestamp,
      quality: getImpedanceQuality(ch.impedance),
    }));

    batchUpdateImpedances(impedanceData);
  }, [batchUpdateImpedances]);

  // Handle neural data stream
  const handleDataMessage = useCallback((message: DataMessage) => {
    // TODO: Convert ESP-EEG data format to PhantomLoop StreamPacket format
    console.log('Received data message:', message.payload.samples.length, 'samples');
  }, []);

  // Handle status updates
  const handleStatusMessage = useCallback((message: StatusMessage) => {
    if (message.payload.error) {
      setLastError(message.payload.error);
    }
    console.log('ESP-EEG status:', message.payload);
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback((message: ESPEEGMessage) => {
    switch (message.type) {
      case 'impedance':
        handleImpedanceMessage(message as ImpedanceMessage);
        break;
      case 'data':
        handleDataMessage(message as DataMessage);
        break;
      case 'status':
        handleStatusMessage(message as StatusMessage);
        break;
      default:
        console.warn('Unknown message type:', message);
    }
  }, [handleImpedanceMessage, handleDataMessage, handleStatusMessage]);

  // Connect to ESP-EEG device
  const connect = useCallback((url: string) => {
    if (wsRef.current) {
      console.warn('Already connected to ESP-EEG');
      return;
    }

    connectUrlRef.current = url;
    setConnectionStatus('connecting');
    setLastError(null);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to ESP-EEG:', url);
        setConnectionStatus('connected');
        
        // Request initial impedance check
        ws.send(JSON.stringify({ command: 'start_impedance' }));
      };

      ws.onmessage = (event) => {
        try {
          const message: ESPEEGMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Failed to parse ESP-EEG message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('ESP-EEG WebSocket error:', error);
        setLastError('Connection error occurred');
      };

      ws.onclose = () => {
        console.log('ESP-EEG connection closed');
        setConnectionStatus('disconnected');
        wsRef.current = null;

        // Attempt reconnection if monitoring is still enabled (simple retry)
        if (isMonitoringImpedance && connectUrlRef.current) {
          setTimeout(() => {
            if (wsRef.current === null && connectUrlRef.current) {
              console.log('Auto-reconnecting to ESP-EEG...');
              const evt = new CustomEvent('esp-eeg-reconnect', { detail: { url: connectUrlRef.current } });
              window.dispatchEvent(evt);
            }
          }, 3000);
        }
      };
    } catch (error) {
      console.error('Failed to connect to ESP-EEG:', error);
      setConnectionStatus('disconnected');
      setLastError(error instanceof Error ? error.message : 'Unknown error');
    }
  }, [isMonitoringImpedance, handleMessage]);

  // Disconnect from ESP-EEG
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      // Send stop command before closing
      try {
        wsRef.current.send(JSON.stringify({ command: 'stop_impedance' }));
      } catch (error) {
        console.error('Failed to send stop command:', error);
      }

      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus('disconnected');
    setImpedanceMonitoring(false);
  }, [setImpedanceMonitoring]);

  // Handle incoming messages - removed duplicate definitions above

  // Request impedance check
  const requestImpedanceCheck = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command: 'check_impedance' }));
    }
  }, []);

  // Periodic impedance monitoring
  useEffect(() => {
    if (isMonitoringImpedance && connectionStatus === 'connected') {
      const interval = setInterval(() => {
        requestImpedanceCheck();
      }, 5000); // Check every 5 seconds

      return () => clearInterval(interval);
    }
  }, [isMonitoringImpedance, connectionStatus, requestImpedanceCheck]);

  return {
    connectionStatus,
    lastError,
    connect,
    disconnect,
    requestImpedanceCheck,
  };
}

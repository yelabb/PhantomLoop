/**
 * Custom hook for managing Cerelog ESP-EEG device connection
 * 
 * ACTUAL Cerelog ESP-EEG Protocol (from WiFi_Support/Python_wifi_LSL.py):
 * - TCP connection on port 1112 (NOT WebSocket!)
 * - UDP discovery on port 4445: send "CERELOG_FIND_ME" → receive "CERELOG_HERE"
 * - Binary packet format: 37 bytes total
 *   [0-1]   Start marker: 0xABCD
 *   [2]     Length: 31
 *   [3-6]   Timestamp (uint32, ms since connection)
 *   [7-33]  ADS1299 data: 3 status bytes + 24 bytes (8 ch × 3 bytes, signed 24-bit)
 *   [34]    Checksum: (sum of bytes 2-33) & 0xFF
 *   [35-36] End marker: 0xDCBA
 * 
 * - Hardware: ADS1299 chip at 250 SPS, VREF=4.50V, GAIN=24
 * - WiFi AP: SSID "CERELOG_EEG", password "cerelog123", IP 192.168.4.1
 * 
 * IMPORTANT: ADS1299 does NOT support impedance measurement!
 * Signal quality must be estimated from signal amplitude/noise characteristics.
 * 
 * Since browsers cannot open raw TCP sockets, this hook requires:
 * - WebSocket bridge that proxies TCP binary packets
 * 
 * For direct device access, use the Python scripts from Cerelog.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useStore } from '../store';
import type { ImpedanceData } from '../types/electrodes';

// Cerelog ESP-EEG Protocol Constants (from firmware documentation)
export const CERELOG_PROTOCOL = {
  // Network configuration
  WIFI_SSID: 'CERELOG_EEG',
  WIFI_PASSWORD: 'cerelog123',
  DEVICE_IP: '192.168.4.1',
  TCP_PORT: 1112,
  UDP_DISCOVERY_PORT: 4445,
  DISCOVERY_REQUEST: 'CERELOG_FIND_ME',
  DISCOVERY_RESPONSE: 'CERELOG_HERE',
  
  // Packet structure
  PACKET_SIZE: 37,
  START_MARKER: 0xABCD,
  END_MARKER: 0xDCBA,
  
  // Hardware specs
  SAMPLING_RATE: 250,
  NUM_CHANNELS: 8,
  BYTES_PER_CHANNEL: 3,
  STATUS_BYTES: 3,
  VREF: 4.50,
  GAIN: 24,
} as const;

// Signal quality thresholds (µV) - derived from signal characteristics
// Since ADS1299 has no impedance measurement, we estimate from amplitude
export const SIGNAL_THRESHOLDS = {
  NOISE_FLOOR_UV: 5,      // Below = no signal (disconnected)
  GOOD_MAX_UV: 100,       // Normal EEG range (good contact)
  FAIR_MAX_UV: 200,       // Slightly elevated noise
  POOR_MAX_UV: 500,       // High noise/poor contact
  // Above POOR_MAX = saturated/open circuit
};

export interface ESPEEGSample {
  timestamp: number;        // ms since connection
  channels: number[];       // 8 channels in µV
  status: number;           // ADS1299 status register
}

export interface ChannelStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  peakToPeak: number;
  quality: 'good' | 'fair' | 'poor' | 'disconnected';
  estimatedImpedance: number; // Pseudo-impedance for UI (kΩ)
}

/**
 * Parse ADS1299 24-bit signed value to µV
 * Based on: Python_wifi_LSL.py voltage conversion
 * @exported for testing
 */
export function parseADS1299ToMicrovolts(bytes: Uint8Array, offset: number): number {
  // 24-bit big-endian signed integer
  let value = (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
  
  // Sign extend 24-bit to 32-bit
  if (value & 0x800000) {
    value = value - 0x1000000;
  }
  
  // Convert to µV: (2 * VREF / GAIN) / 2^24 * 1e6
  const scaleFactor = (2 * CERELOG_PROTOCOL.VREF / CERELOG_PROTOCOL.GAIN) / Math.pow(2, 24);
  return value * scaleFactor * 1e6;
}

/**
 * Parse binary packet from ESP-EEG TCP stream
 * Returns null if packet is invalid
 * @exported for testing
 */
export function parsePacket(data: Uint8Array): ESPEEGSample | null {
  if (data.length !== CERELOG_PROTOCOL.PACKET_SIZE) {
    return null;
  }
  
  // Verify start marker (0xABCD, big-endian)
  const startMarker = (data[0] << 8) | data[1];
  if (startMarker !== CERELOG_PROTOCOL.START_MARKER) {
    return null;
  }
  
  // Verify end marker (0xDCBA, big-endian)
  const endMarker = (data[35] << 8) | data[36];
  if (endMarker !== CERELOG_PROTOCOL.END_MARKER) {
    return null;
  }
  
  // Verify checksum (sum of bytes 2-33 & 0xFF)
  let checksum = 0;
  for (let i = 2; i < 34; i++) {
    checksum = (checksum + data[i]) & 0xFF;
  }
  if (checksum !== data[34]) {
    return null;
  }
  
  // Parse timestamp (bytes 3-6, uint32 big-endian)
  const timestamp = (data[3] << 24) | (data[4] << 16) | (data[5] << 8) | data[6];
  
  // Parse ADS1299 status register (bytes 7-9)
  const status = (data[7] << 16) | (data[8] << 8) | data[9];
  
  // Parse 8 channel values (bytes 10-33)
  const channels: number[] = [];
  for (let ch = 0; ch < CERELOG_PROTOCOL.NUM_CHANNELS; ch++) {
    const offset = 7 + CERELOG_PROTOCOL.STATUS_BYTES + (ch * CERELOG_PROTOCOL.BYTES_PER_CHANNEL);
    channels.push(parseADS1299ToMicrovolts(data, offset));
  }
  
  return { timestamp, channels, status };
}

/**
 * Estimate signal quality from amplitude statistics
 * ADS1299 doesn't have impedance measurement - we infer quality from signal characteristics
 * @exported for testing
 */
export function estimateQualityFromSignal(stats: { std: number; peakToPeak: number }): 'good' | 'fair' | 'poor' | 'disconnected' {
  // Use the more reliable metric between std and peak-to-peak/4
  const amplitude = Math.max(stats.std, stats.peakToPeak / 4);
  
  if (amplitude < SIGNAL_THRESHOLDS.NOISE_FLOOR_UV) {
    return 'disconnected'; // Flatline = electrode not connected
  } else if (amplitude > SIGNAL_THRESHOLDS.POOR_MAX_UV) {
    return 'disconnected'; // Saturated/railing = open circuit
  } else if (amplitude <= SIGNAL_THRESHOLDS.GOOD_MAX_UV) {
    return 'good';
  } else if (amplitude <= SIGNAL_THRESHOLDS.FAIR_MAX_UV) {
    return 'fair';
  } else {
    return 'poor';
  }
}

/**
 * Convert signal amplitude to pseudo-impedance for UI display
 * This is NOT real impedance - just a visual indicator
 * Good contact (~5µV noise) → ~5kΩ display
 * Poor contact (~500µV noise) → ~50kΩ display
 * @exported for testing
 */
export function estimatePseudoImpedance(std: number): number {
  if (std < SIGNAL_THRESHOLDS.NOISE_FLOOR_UV) {
    return 999; // Open circuit indicator
  }
  // Rough logarithmic mapping for UI display
  const pseudoImpedance = 5 + Math.log10(1 + std) * 15;
  return Math.min(Math.round(pseudoImpedance * 10) / 10, 100);
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
  const sampleBufferRef = useRef<ESPEEGSample[]>([]);
  const lastSampleTimeRef = useRef<number>(0);
  
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);
  const [sampleRate, setSampleRate] = useState<number>(0);
  const [channelStats, setChannelStats] = useState<ChannelStats[]>(
    Array.from({ length: CERELOG_PROTOCOL.NUM_CHANNELS }, () => ({
      mean: 0,
      std: 0,
      min: 0,
      max: 0,
      peakToPeak: 0,
      quality: 'disconnected' as const,
      estimatedImpedance: 999,
    }))
  );
  const [packetCount, setPacketCount] = useState(0);

  /**
   * Calculate channel statistics from buffered samples and update store
   */
  const updateChannelStats = useCallback(() => {
    const buffer = sampleBufferRef.current;
    if (buffer.length < 10) return; // Need sufficient samples
    
    const stats: ChannelStats[] = [];
    
    for (let ch = 0; ch < CERELOG_PROTOCOL.NUM_CHANNELS; ch++) {
      const values = buffer.map(s => s.channels[ch]);
      
      // Calculate statistics
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const peakToPeak = max - min;
      
      // Estimate quality from signal characteristics
      const quality = estimateQualityFromSignal({ std, peakToPeak });
      const estimatedImpedance = estimatePseudoImpedance(std);
      
      stats.push({ mean, std, min, max, peakToPeak, quality, estimatedImpedance });
    }
    
    setChannelStats(stats);
    
    // Update store with pseudo-impedance data (for UI compatibility)
    const impedanceData: ImpedanceData[] = stats.map((stat, ch) => ({
      channelId: ch,
      electrodeId: `electrode-${ch}`,
      impedance: stat.estimatedImpedance,
      timestamp: Date.now(),
      quality: stat.quality,
    }));
    
    batchUpdateImpedances(impedanceData);
    
    // Calculate actual sample rate from timestamps
    if (buffer.length > 1) {
      const firstTimestamp = buffer[0].timestamp;
      const lastTimestamp = buffer[buffer.length - 1].timestamp;
      const durationMs = lastTimestamp - firstTimestamp;
      if (durationMs > 0) {
        setSampleRate(Math.round((buffer.length / durationMs) * 1000));
      }
    }
  }, [batchUpdateImpedances]);

  /**
   * Process incoming binary packet data
   */
  const processBinaryData = useCallback((data: ArrayBuffer) => {
    const bytes = new Uint8Array(data);
    
    // Handle single packet or batch
    const packetSize = CERELOG_PROTOCOL.PACKET_SIZE;
    const packetCount = Math.floor(bytes.length / packetSize);
    
    for (let i = 0; i < packetCount; i++) {
      const packetData = bytes.slice(i * packetSize, (i + 1) * packetSize);
      const sample = parsePacket(packetData);
      
      if (sample) {
        sampleBufferRef.current.push(sample);
        lastSampleTimeRef.current = Date.now();
        setPacketCount(prev => prev + 1);
      }
    }
    
    // Keep last 2 seconds of samples for analysis
    const maxSamples = CERELOG_PROTOCOL.SAMPLING_RATE * 2;
    if (sampleBufferRef.current.length > maxSamples) {
      sampleBufferRef.current = sampleBufferRef.current.slice(-maxSamples);
    }
  }, []);

  /**
   * Handle JSON messages (for hybrid bridge mode)
   */
  const processJsonMessage = useCallback((data: string) => {
    try {
      const msg = JSON.parse(data);
      
      // Support direct sample format from bridge
      if (msg.type === 'sample' && Array.isArray(msg.channels)) {
        const sample: ESPEEGSample = {
          timestamp: msg.timestamp || Date.now(),
          channels: msg.channels,
          status: msg.status || 0,
        };
        
        sampleBufferRef.current.push(sample);
        lastSampleTimeRef.current = Date.now();
        setPacketCount(prev => prev + 1);
        
        // Keep last 2 seconds
        const maxSamples = CERELOG_PROTOCOL.SAMPLING_RATE * 2;
        if (sampleBufferRef.current.length > maxSamples) {
          sampleBufferRef.current = sampleBufferRef.current.slice(-maxSamples);
        }
      }
      // Support batch sample format
      else if (msg.type === 'samples' && Array.isArray(msg.data)) {
        for (const sample of msg.data) {
          sampleBufferRef.current.push({
            timestamp: sample.timestamp || Date.now(),
            channels: sample.channels,
            status: sample.status || 0,
          });
        }
        setPacketCount(prev => prev + msg.data.length);
        
        const maxSamples = CERELOG_PROTOCOL.SAMPLING_RATE * 2;
        if (sampleBufferRef.current.length > maxSamples) {
          sampleBufferRef.current = sampleBufferRef.current.slice(-maxSamples);
        }
      }
      // Handle status messages
      else if (msg.type === 'status') {
        console.log('ESP-EEG status:', msg);
        if (msg.error) {
          setLastError(msg.error);
        }
      }
    } catch {
      console.warn('Failed to parse ESP-EEG JSON message');
    }
  }, []);

  /**
   * WebSocket message handler
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      processBinaryData(event.data);
    } else if (typeof event.data === 'string') {
      processJsonMessage(event.data);
    }
  }, [processBinaryData, processJsonMessage]);

  /**
   * Connect to ESP-EEG via WebSocket bridge
   * 
   * NOTE: Browsers cannot connect directly to TCP sockets.
   * You need a WebSocket-to-TCP bridge running locally.
   * 
   * Options:
   * 1. Run the Python WebSocket bridge (see cerelog-ws-bridge.py)
   * 2. Use the Python scripts directly for actual device access
   */
  const connect = useCallback((url: string) => {
    if (wsRef.current) {
      console.warn('ESP-EEG: Already connected');
      return;
    }

    connectUrlRef.current = url;
    setConnectionStatus('connecting');
    setLastError(null);
    sampleBufferRef.current = [];
    setPacketCount(0);

    console.log(`ESP-EEG: Connecting to bridge at ${url}`);
    console.log(`ESP-EEG: Device uses TCP port ${CERELOG_PROTOCOL.TCP_PORT} on ${CERELOG_PROTOCOL.DEVICE_IP}`);

    try {
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('ESP-EEG: Connected to WebSocket bridge');
        setConnectionStatus('connected');
        
        // Request stream start if bridge supports commands
        try {
          ws.send(JSON.stringify({ 
            command: 'connect',
            deviceIp: CERELOG_PROTOCOL.DEVICE_IP,
            port: CERELOG_PROTOCOL.TCP_PORT,
          }));
        } catch {
          // Bridge may not require explicit connect command
        }
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        console.error('ESP-EEG: Connection error:', error);
        setLastError('Connection failed - is the WebSocket bridge running?');
      };

      ws.onclose = (event) => {
        console.log(`ESP-EEG: Connection closed (code: ${event.code})`);
        setConnectionStatus('disconnected');
        wsRef.current = null;

        // Auto-reconnect if monitoring is still enabled
        if (isMonitoringImpedance && connectUrlRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (wsRef.current === null && connectUrlRef.current) {
              console.log('ESP-EEG: Attempting reconnection...');
              connect(connectUrlRef.current);
            }
          }, 3000);
        }
      };
    } catch (error) {
      console.error('ESP-EEG: Failed to connect:', error);
      setConnectionStatus('disconnected');
      setLastError(error instanceof Error ? error.message : 'Unknown connection error');
    }
  }, [isMonitoringImpedance, handleMessage]);

  /**
   * Disconnect from ESP-EEG
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ command: 'disconnect' }));
      } catch {
        // Ignore send errors on close
      }

      wsRef.current.close();
      wsRef.current = null;
    }

    connectUrlRef.current = '';
    setConnectionStatus('disconnected');
    setImpedanceMonitoring(false);
    sampleBufferRef.current = [];
  }, [setImpedanceMonitoring]);

  /**
   * Request signal quality check (updates stats from current buffer)
   */
  const requestSignalCheck = useCallback(() => {
    updateChannelStats();
  }, [updateChannelStats]);

  // Periodic stats update when connected
  useEffect(() => {
    if (connectionStatus === 'connected') {
      const interval = setInterval(() => {
        updateChannelStats();
      }, 500); // Update every 500ms

      return () => clearInterval(interval);
    }
  }, [connectionStatus, updateChannelStats]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // Connection state
    connectionStatus,
    lastError,
    
    // Streaming stats
    sampleRate,
    packetCount,
    channelStats,
    
    // Actions
    connect,
    disconnect,
    requestSignalCheck,
    
    // Protocol info (for UI/documentation)
    protocolInfo: CERELOG_PROTOCOL,
  };
}

/**
 * Stream Adapters Index
 * 
 * Registry of all available stream sources including universal EEG device support.
 */

import type { StreamAdapterRegistry } from '../types/stream';
import { createPhantomLinkAdapter } from './PhantomLinkAdapter';
import { createESPEEGAdapter } from './ESPEEGAdapter';
import { createUniversalEEGAdapter } from './UniversalEEGAdapter';
import { listDeviceProfiles } from '../devices/deviceProfiles';

// Re-export adapters
export { PhantomLinkAdapter, createPhantomLinkAdapter } from './PhantomLinkAdapter';
export { ESPEEGAdapter, createESPEEGAdapter } from './ESPEEGAdapter';
export { 
  UniversalEEGAdapter, 
  createUniversalEEGAdapter, 
  createAdapterForDevice,
  estimateQualityFromSignal,
  parseADS1299ToMicrovolts,
} from './UniversalEEGAdapter';

/**
 * Registry of available stream adapters
 */
export const streamAdapterRegistry: StreamAdapterRegistry = {
  // -------------------------------------------------------------------------
  // PhantomLink (Original spike data)
  // -------------------------------------------------------------------------
  'phantomlink': {
    name: 'PhantomLink MC_Maze',
    description: '142-channel spike data from MC_Maze dataset (40 Hz)',
    factory: createPhantomLinkAdapter,
    defaultUrl: 'wss://phantomlink.fly.dev',
  },
  
  // -------------------------------------------------------------------------
  // OpenBCI Devices
  // -------------------------------------------------------------------------
  'openbci-cyton': {
    name: 'OpenBCI Cyton',
    description: '8-channel research-grade EEG with ADS1299 (250 Hz)',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'openbci-cyton', ...opts }),
    defaultUrl: 'ws://localhost:8766',
  },
  'openbci-cyton-daisy': {
    name: 'OpenBCI Cyton + Daisy',
    description: '16-channel research-grade EEG with dual ADS1299 (125 Hz)',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'openbci-cyton-daisy', ...opts }),
    defaultUrl: 'ws://localhost:8766',
  },
  'openbci-ganglion': {
    name: 'OpenBCI Ganglion',
    description: '4-channel affordable BLE EEG (200 Hz)',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'openbci-ganglion', ...opts }),
    defaultUrl: 'ws://localhost:8767',
  },
  
  // -------------------------------------------------------------------------
  // NeuroSky Devices
  // -------------------------------------------------------------------------
  'neurosky-mindwave': {
    name: 'NeuroSky MindWave',
    description: 'Single-channel dry-electrode EEG (512 Hz)',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'neurosky-mindwave', ...opts }),
    defaultUrl: 'ws://localhost:8768',
  },
  
  // -------------------------------------------------------------------------
  // Muse Devices
  // -------------------------------------------------------------------------
  'muse-2': {
    name: 'Muse 2',
    description: '4-channel consumer EEG with motion sensors (256 Hz)',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'muse-2', ...opts }),
    defaultUrl: 'ws://localhost:8767',
  },
  'muse-s': {
    name: 'Muse S',
    description: '4-channel sleep-focused EEG headband (256 Hz)',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'muse-s', ...opts }),
    defaultUrl: 'ws://localhost:8767',
  },
  
  // -------------------------------------------------------------------------
  // Emotiv Devices
  // -------------------------------------------------------------------------
  'emotiv-insight': {
    name: 'Emotiv Insight',
    description: '5-channel wireless EEG with motion sensors (128 Hz)',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'emotiv-insight', ...opts }),
    defaultUrl: 'ws://localhost:8769',
  },
  'emotiv-epoc-x': {
    name: 'Emotiv EPOC X',
    description: '14-channel research-ready wireless EEG (128/256 Hz)',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'emotiv-epoc-x', ...opts }),
    defaultUrl: 'ws://localhost:8769',
  },
  
  // -------------------------------------------------------------------------
  // Cerelog ESP-EEG (Legacy entry, uses original adapter)
  // -------------------------------------------------------------------------
  'esp-eeg': {
    name: 'Cerelog ESP-EEG',
    description: '8-channel WiFi EEG via ADS1299 (250 Hz) - requires WebSocket bridge',
    factory: createESPEEGAdapter,
    defaultUrl: 'ws://localhost:8765',
  },
  'cerelog-esp-eeg': {
    name: 'Cerelog ESP-EEG (Universal)',
    description: '8-channel WiFi EEG via ADS1299 (250 Hz) - universal adapter',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'cerelog-esp-eeg', ...opts }),
    defaultUrl: 'ws://localhost:8765',
  },
  
  // -------------------------------------------------------------------------
  // Lab Streaming Layer (LSL) - Universal Protocol
  // Supports 130+ devices via pylsl bridge
  // -------------------------------------------------------------------------
  'lsl-generic-8': {
    name: 'LSL Stream (8-Channel)',
    description: 'Generic 8-channel LSL stream - any LSL-compatible EEG device',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'lsl-generic-8', ...opts }),
    defaultUrl: 'ws://localhost:8767',
  },
  'lsl-generic-16': {
    name: 'LSL Stream (16-Channel)',
    description: 'Generic 16-channel LSL stream for research-grade EEG',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'lsl-generic-16', ...opts }),
    defaultUrl: 'ws://localhost:8767',
  },
  'lsl-generic-32': {
    name: 'LSL Stream (32-Channel)',
    description: 'Generic 32-channel LSL stream for high-density EEG',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'lsl-generic-32', ...opts }),
    defaultUrl: 'ws://localhost:8767',
  },
  'lsl-generic-64': {
    name: 'LSL Stream (64-Channel)',
    description: 'Generic 64-channel LSL stream for research-grade high-density EEG',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'lsl-generic-64', ...opts }),
    defaultUrl: 'ws://localhost:8767',
  },
  'lsl-brainproducts': {
    name: 'Brain Products (LSL)',
    description: 'Brain Products actiCHamp/LiveAmp via LSL (up to 25kHz)',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'lsl-brainproducts', ...opts }),
    defaultUrl: 'ws://localhost:8767',
  },
  'lsl-biosemi': {
    name: 'BioSemi ActiveTwo (LSL)',
    description: 'BioSemi ActiveTwo research EEG via LSL (up to 16kHz)',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'lsl-biosemi', ...opts }),
    defaultUrl: 'ws://localhost:8767',
  },
  'lsl-gtec': {
    name: 'g.tec (LSL)',
    description: 'g.tec g.USBamp/g.Nautilus via g.NEEDaccess LSL',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'lsl-gtec', ...opts }),
    defaultUrl: 'ws://localhost:8767',
  },
  'lsl-cognionics': {
    name: 'Cognionics Quick-20/30 (LSL)',
    description: 'Cognionics dry-electrode EEG via LSL',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'lsl-cognionics', ...opts }),
    defaultUrl: 'ws://localhost:8767',
  },
  'lsl-antneuro': {
    name: 'ANT Neuro eego (LSL)',
    description: 'ANT Neuro eego sport/mylab via LSL',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'lsl-antneuro', ...opts }),
    defaultUrl: 'ws://localhost:8767',
  },
  'lsl-nirx': {
    name: 'NIRx fNIRS (LSL)',
    description: 'NIRx NIRSport/NIRScout fNIRS via LSL',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'lsl-nirx', ...opts }),
    defaultUrl: 'ws://localhost:8767',
  },
  
  // -------------------------------------------------------------------------
  // Brainflow Generic
  // -------------------------------------------------------------------------
  'brainflow-synthetic': {
    name: 'Brainflow Synthetic',
    description: 'Synthetic board for testing without hardware',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'synthetic', ...opts }),
    defaultUrl: 'ws://localhost:8770',
  },
  'synthetic': {
    name: 'Synthetic Board (Testing)',
    description: 'Synthetic board for testing without hardware',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'synthetic', ...opts }),
    defaultUrl: 'ws://localhost:8770',
  },
};

/**
 * Get adapter info by ID
 */
export function getAdapterInfo(adapterId: string) {
  return streamAdapterRegistry[adapterId];
}

/**
 * Create adapter instance by ID
 */
export function createAdapter(adapterId: string, options?: Record<string, unknown>) {
  const info = streamAdapterRegistry[adapterId];
  if (!info) {
    throw new Error(`Unknown stream adapter: ${adapterId}`);
  }
  return info.factory(options);
}

/**
 * List all available adapters
 */
export function listAdapters() {
  return Object.entries(streamAdapterRegistry).map(([id, info]) => ({
    id,
    name: info.name,
    description: info.description,
    defaultUrl: info.defaultUrl,
  }));
}

/**
 * List adapters grouped by category
 */
export function listAdaptersByCategory() {
  const categories = {
    'Neural Data': ['phantomlink'],
    'OpenBCI': ['openbci-cyton', 'openbci-cyton-daisy', 'openbci-ganglion'],
    'Consumer EEG': ['neurosky-mindwave', 'muse-2', 'muse-s'],
    'Research EEG': ['emotiv-insight', 'emotiv-epoc-x'],
    'Custom Hardware': ['esp-eeg', 'cerelog-esp-eeg'],
    'Lab Streaming Layer': [
      'lsl-generic-8', 'lsl-generic-16', 'lsl-generic-32', 'lsl-generic-64',
      'lsl-brainproducts', 'lsl-biosemi', 'lsl-gtec', 'lsl-cognionics', 
      'lsl-antneuro', 'lsl-nirx'
    ],
    'Testing': ['brainflow-synthetic'],
  };
  
  return Object.entries(categories).map(([category, ids]) => ({
    category,
    adapters: ids
      .filter(id => streamAdapterRegistry[id])
      .map(id => ({
        id,
        ...streamAdapterRegistry[id],
      })),
  }));
}

/**
 * Get supported devices from device profiles
 */
export function getSupportedDevices() {
  return listDeviceProfiles().map(profile => ({
    id: profile.id,
    name: profile.name,
    manufacturer: profile.manufacturer,
    channelCount: profile.channelCount,
    samplingRate: profile.defaultSamplingRate,
    protocols: profile.protocols,
    brainflowSupported: profile.capabilities.supportsBrainflow,
    brainflowBoardId: profile.brainflowBoardId,
  }));
}


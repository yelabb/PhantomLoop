/**
 * Stream Adapters Index
 * 
 * Registry of all available stream sources including universal EEG device support.
 */

import type { StreamAdapterRegistry } from '../types/stream';
import { createPhantomLinkAdapter } from './PhantomLinkAdapter';
import { createESPEEGAdapter } from './ESPEEGAdapter';
import { createSimulationAdapter } from './SimulationAdapter';
import { createUniversalEEGAdapter } from './UniversalEEGAdapter';
import { listDeviceProfiles } from '../devices/deviceProfiles';

// Re-export adapters
export { PhantomLinkAdapter, createPhantomLinkAdapter } from './PhantomLinkAdapter';
export { ESPEEGAdapter, createESPEEGAdapter } from './ESPEEGAdapter';
export { SimulationAdapter, createSimulationAdapter } from './SimulationAdapter';
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
  // Brainflow Generic
  // -------------------------------------------------------------------------
  'brainflow-synthetic': {
    name: 'Brainflow Synthetic',
    description: 'Synthetic board for testing without hardware',
    factory: (opts) => createUniversalEEGAdapter({ deviceId: 'synthetic', ...opts }),
    defaultUrl: 'ws://localhost:8770',
  },
  
  // -------------------------------------------------------------------------
  // Simulation Modes
  // -------------------------------------------------------------------------
  'simulation-eeg': {
    name: 'Simulated EEG',
    description: 'Synthetic EEG with alpha oscillations for testing',
    factory: () => createSimulationAdapter({ pattern: 'eeg-alpha', channelCount: 8 }),
  },
  'simulation-spikes': {
    name: 'Simulated Spikes',
    description: 'Synthetic spike counts for decoder testing',
    factory: () => createSimulationAdapter({ pattern: 'cursor-task', channelCount: 142, samplingRate: 40 }),
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
    'Testing': ['brainflow-synthetic', 'simulation-eeg', 'simulation-spikes'],
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


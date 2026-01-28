/**
 * Stream Adapters Index
 * 
 * Registry of all available stream sources.
 */

import type { StreamAdapterRegistry } from '../types/stream';
import { createPhantomLinkAdapter } from './PhantomLinkAdapter';
import { createESPEEGAdapter } from './ESPEEGAdapter';
import { createSimulationAdapter } from './SimulationAdapter';

// Re-export adapters
export { PhantomLinkAdapter, createPhantomLinkAdapter } from './PhantomLinkAdapter';
export { ESPEEGAdapter, createESPEEGAdapter } from './ESPEEGAdapter';
export { SimulationAdapter, createSimulationAdapter } from './SimulationAdapter';

/**
 * Registry of available stream adapters
 */
export const streamAdapterRegistry: StreamAdapterRegistry = {
  'phantomlink': {
    name: 'PhantomLink MC_Maze',
    description: '142-channel spike data from MC_Maze dataset (40 Hz)',
    factory: createPhantomLinkAdapter,
    defaultUrl: 'wss://phantomlink.fly.dev',
  },
  'esp-eeg': {
    name: 'Cerelog ESP-EEG',
    description: '8-channel EEG via ADS1299 (250 Hz) - requires WebSocket bridge',
    factory: createESPEEGAdapter,
    defaultUrl: 'ws://localhost:8765',
  },
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

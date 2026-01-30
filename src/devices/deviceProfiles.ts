/**
 * Universal EEG Device Profiles
 * 
 * Comprehensive registry of EEG hardware devices with their specifications,
 * connection protocols, and Brainflow board IDs.
 * 
 * Supports: OpenBCI, NeuroSky, Muse, Emotiv, Cerelog ESP-EEG, PiEEG, and more.
 */

import type { Position3D } from '../types/electrodes';

/**
 * Connection protocol for device communication
 */
export type DeviceProtocol = 
  | 'serial'           // USB serial connection
  | 'bluetooth'        // Bluetooth Classic
  | 'ble'              // Bluetooth Low Energy
  | 'wifi'             // WiFi TCP/UDP
  | 'wifi-websocket'   // WiFi via WebSocket bridge
  | 'lsl'              // Lab Streaming Layer
  | 'usb-hid';         // USB Human Interface Device

/**
 * Device manufacturer/brand
 */
export type DeviceManufacturer = 
  | 'OpenBCI'
  | 'NeuroSky'
  | 'Muse'
  | 'Emotiv'
  | 'Cerelog'
  | 'PiEEG'
  | 'BrainProducts'
  | 'ANT Neuro'
  | 'G.Tec'
  | 'Cognionics'
  | 'Brainflow'
  | 'Generic';

/**
 * ADC chip types for different devices
 */
export type ADCChip = 
  | 'ADS1299'     // Texas Instruments (OpenBCI, Cerelog, PiEEG)
  | 'ADS1299-8'   // 8-channel variant
  | 'ADS1299-16'  // Daisy-chained 16-channel
  | 'TGAM'        // NeuroSky ThinkGear ASIC Module
  | 'Unknown';

/**
 * Device capability flags
 */
export interface DeviceCapabilities {
  hasImpedanceMeasurement: boolean;
  hasAccelerometer: boolean;
  hasGyroscope: boolean;
  hasBattery: boolean;
  hasAuxChannels: boolean;
  supportsMarkers: boolean;
  supportsBrainflow: boolean;
}

/**
 * Default channel labels for different montages
 */
export interface DefaultMontage {
  channelCount: number;
  labels: string[];
  positions: Position3D[];
}

/**
 * Complete device profile
 */
export interface DeviceProfile {
  id: string;
  name: string;
  manufacturer: DeviceManufacturer;
  model?: string;
  
  // Hardware specifications
  channelCount: number;
  samplingRates: number[];
  defaultSamplingRate: number;
  resolution: number; // bits
  adcChip?: ADCChip;
  
  // Voltage scaling
  vref?: number;
  gain?: number;
  scaleFactorUV?: number; // Direct scale factor to µV if known
  
  // Connection
  protocols: DeviceProtocol[];
  defaultProtocol: DeviceProtocol;
  defaultPort?: string;
  defaultBaudRate?: number;
  
  // Brainflow integration
  brainflowBoardId?: number;
  brainflowBoardIdBLE?: number; // Some devices have separate BLE ID
  
  // Capabilities
  capabilities: DeviceCapabilities;
  
  // Default electrode configuration
  defaultMontage?: DefaultMontage;
  
  // Protocol-specific configuration
  protocolConfig?: Record<string, unknown>;
  
  // Documentation
  description?: string;
  setupUrl?: string;
}

// ============================================================================
// BRAINFLOW BOARD IDS
// See: https://brainflow.readthedocs.io/en/stable/SupportedBoards.html
// ============================================================================

export const BRAINFLOW_BOARD_IDS = {
  // OpenBCI
  CYTON: 0,
  GANGLION: 1,
  CYTON_DAISY: 2,
  GANGLION_WIFI: 4,
  CYTON_WIFI: 5,
  CYTON_DAISY_WIFI: 6,
  
  // NeuroSky
  MINDWAVE: 18,
  MINDWAVE_MOBILE: 18,
  
  // Muse
  MUSE_S: 21,
  MUSE_2: 22,
  MUSE_S_BLED: 38,
  MUSE_2_BLED: 39,
  
  // Emotiv
  INSIGHT: 25,
  EPOC: 26,
  EPOC_PLUS: 27,
  EPOC_FLEX: 28,
  
  // Neurosity
  NOTION_1: 13,
  NOTION_2: 14,
  CROWN: 23,
  
  // BrainBit
  BRAINBIT: 7,
  BRAINBIT_BLED: 17,
  
  // Ant Neuro
  ANT_NEURO_EE_410: 24,
  ANT_NEURO_EE_411: 29,
  ANT_NEURO_EE_430: 30,
  ANT_NEURO_EE_225: 31,
  
  // Enophone
  ENOPHONE: 37,
  
  // PiEEG
  PIEEG: 46,
  PIEEG_16: 47,
  
  // Generic/Testing
  SYNTHETIC: -1,
  PLAYBACK: 3,
  
  // BrainFlow Streaming
  STREAMING_BOARD: -2,
} as const;

// ============================================================================
// STANDARD 10-20 POSITIONS
// ============================================================================

const POSITIONS_10_20: Record<string, Position3D> = {
  // Frontal pole
  Fp1: { x: -0.309, y: 0.951, z: 0.0 },
  Fp2: { x: 0.309, y: 0.951, z: 0.0 },
  Fpz: { x: 0.0, y: 0.999, z: 0.0 },
  
  // Frontal
  F7: { x: -0.809, y: 0.588, z: 0.0 },
  F3: { x: -0.454, y: 0.707, z: 0.5 },
  Fz: { x: 0.0, y: 0.809, z: 0.588 },
  F4: { x: 0.454, y: 0.707, z: 0.5 },
  F8: { x: 0.809, y: 0.588, z: 0.0 },
  
  // Temporal
  T7: { x: -1.0, y: 0.0, z: 0.0 },
  T3: { x: -1.0, y: 0.0, z: 0.0 }, // T7 alias
  T8: { x: 1.0, y: 0.0, z: 0.0 },
  T4: { x: 1.0, y: 0.0, z: 0.0 },   // T8 alias
  
  // Central
  C3: { x: -0.707, y: 0.0, z: 0.707 },
  Cz: { x: 0.0, y: 0.0, z: 1.0 },
  C4: { x: 0.707, y: 0.0, z: 0.707 },
  
  // Parietal
  P7: { x: -0.809, y: -0.588, z: 0.0 },
  P3: { x: -0.454, y: -0.707, z: 0.5 },
  Pz: { x: 0.0, y: -0.809, z: 0.588 },
  P4: { x: 0.454, y: -0.707, z: 0.5 },
  P8: { x: 0.809, y: -0.588, z: 0.0 },
  
  // Occipital
  O1: { x: -0.309, y: -0.951, z: 0.0 },
  Oz: { x: 0.0, y: -0.999, z: 0.0 },
  O2: { x: 0.309, y: -0.951, z: 0.0 },
  
  // Mastoids
  A1: { x: -0.9, y: -0.2, z: -0.3 },
  A2: { x: 0.9, y: -0.2, z: -0.3 },
  
  // Muse positions (TP9, AF7, AF8, TP10)
  TP9: { x: -0.891, y: -0.309, z: -0.309 },
  TP10: { x: 0.891, y: -0.309, z: -0.309 },
  AF7: { x: -0.588, y: 0.809, z: 0.0 },
  AF8: { x: 0.588, y: 0.809, z: 0.0 },
};

function getPositions(labels: string[]): Position3D[] {
  return labels.map(label => POSITIONS_10_20[label] || { x: 0, y: 0, z: 0 });
}

// ============================================================================
// DEVICE PROFILES REGISTRY
// ============================================================================

export const DEVICE_PROFILES: Record<string, DeviceProfile> = {
  // -------------------------------------------------------------------------
  // OpenBCI Devices
  // -------------------------------------------------------------------------
  'openbci-cyton': {
    id: 'openbci-cyton',
    name: 'OpenBCI Cyton',
    manufacturer: 'OpenBCI',
    model: 'Cyton',
    channelCount: 8,
    samplingRates: [250],
    defaultSamplingRate: 250,
    resolution: 24,
    adcChip: 'ADS1299',
    vref: 4.5,
    gain: 24,
    protocols: ['serial', 'wifi-websocket'],
    defaultProtocol: 'serial',
    defaultBaudRate: 115200,
    brainflowBoardId: BRAINFLOW_BOARD_IDS.CYTON,
    capabilities: {
      hasImpedanceMeasurement: true,
      hasAccelerometer: true,
      hasGyroscope: false,
      hasBattery: false,
      hasAuxChannels: true,
      supportsMarkers: true,
      supportsBrainflow: true,
    },
    defaultMontage: {
      channelCount: 8,
      labels: ['Fp1', 'Fp2', 'C3', 'C4', 'P7', 'P8', 'O1', 'O2'],
      positions: getPositions(['Fp1', 'Fp2', 'C3', 'C4', 'P7', 'P8', 'O1', 'O2']),
    },
    description: '8-channel research-grade EEG with ADS1299 ADC',
    setupUrl: 'https://docs.openbci.com/Cyton/CytonLanding/',
  },
  
  'openbci-cyton-daisy': {
    id: 'openbci-cyton-daisy',
    name: 'OpenBCI Cyton + Daisy',
    manufacturer: 'OpenBCI',
    model: 'Cyton Daisy',
    channelCount: 16,
    samplingRates: [125, 250],
    defaultSamplingRate: 125,
    resolution: 24,
    adcChip: 'ADS1299-16',
    vref: 4.5,
    gain: 24,
    protocols: ['serial', 'wifi-websocket'],
    defaultProtocol: 'serial',
    defaultBaudRate: 115200,
    brainflowBoardId: BRAINFLOW_BOARD_IDS.CYTON_DAISY,
    capabilities: {
      hasImpedanceMeasurement: true,
      hasAccelerometer: true,
      hasGyroscope: false,
      hasBattery: false,
      hasAuxChannels: true,
      supportsMarkers: true,
      supportsBrainflow: true,
    },
    defaultMontage: {
      channelCount: 16,
      labels: ['Fp1', 'Fp2', 'F7', 'F3', 'Fz', 'F4', 'F8', 'T7', 'C3', 'Cz', 'C4', 'T8', 'P3', 'Pz', 'P4', 'O1'],
      positions: getPositions(['Fp1', 'Fp2', 'F7', 'F3', 'Fz', 'F4', 'F8', 'T7', 'C3', 'Cz', 'C4', 'T8', 'P3', 'Pz', 'P4', 'O1']),
    },
    description: '16-channel research-grade EEG with dual ADS1299',
    setupUrl: 'https://docs.openbci.com/AddOns/Headwear/DaisyChain/',
  },
  
  'openbci-ganglion': {
    id: 'openbci-ganglion',
    name: 'OpenBCI Ganglion',
    manufacturer: 'OpenBCI',
    model: 'Ganglion',
    channelCount: 4,
    samplingRates: [200],
    defaultSamplingRate: 200,
    resolution: 24,
    protocols: ['ble', 'wifi-websocket'],
    defaultProtocol: 'ble',
    brainflowBoardId: BRAINFLOW_BOARD_IDS.GANGLION,
    capabilities: {
      hasImpedanceMeasurement: true,
      hasAccelerometer: true,
      hasGyroscope: false,
      hasBattery: false,
      hasAuxChannels: false,
      supportsMarkers: false,
      supportsBrainflow: true,
    },
    defaultMontage: {
      channelCount: 4,
      labels: ['Fp1', 'Fp2', 'O1', 'O2'],
      positions: getPositions(['Fp1', 'Fp2', 'O1', 'O2']),
    },
    description: '4-channel affordable BLE EEG board',
    setupUrl: 'https://docs.openbci.com/Ganglion/GanglionLanding/',
  },

  // -------------------------------------------------------------------------
  // NeuroSky Devices
  // -------------------------------------------------------------------------
  'neurosky-mindwave': {
    id: 'neurosky-mindwave',
    name: 'NeuroSky MindWave',
    manufacturer: 'NeuroSky',
    model: 'MindWave Mobile 2',
    channelCount: 1,
    samplingRates: [512],
    defaultSamplingRate: 512,
    resolution: 12,
    adcChip: 'TGAM',
    protocols: ['bluetooth'],
    defaultProtocol: 'bluetooth',
    brainflowBoardId: BRAINFLOW_BOARD_IDS.MINDWAVE,
    capabilities: {
      hasImpedanceMeasurement: false,
      hasAccelerometer: false,
      hasGyroscope: false,
      hasBattery: true,
      hasAuxChannels: false,
      supportsMarkers: false,
      supportsBrainflow: true,
    },
    defaultMontage: {
      channelCount: 1,
      labels: ['Fp1'],
      positions: getPositions(['Fp1']),
    },
    description: 'Single dry-electrode EEG headset with attention/meditation metrics',
    setupUrl: 'https://store.neurosky.com/pages/mindwave',
  },

  // -------------------------------------------------------------------------
  // Muse Devices
  // -------------------------------------------------------------------------
  'muse-2': {
    id: 'muse-2',
    name: 'Muse 2',
    manufacturer: 'Muse',
    model: 'Muse 2',
    channelCount: 4,
    samplingRates: [256],
    defaultSamplingRate: 256,
    resolution: 12,
    protocols: ['ble'],
    defaultProtocol: 'ble',
    brainflowBoardId: BRAINFLOW_BOARD_IDS.MUSE_2,
    brainflowBoardIdBLE: BRAINFLOW_BOARD_IDS.MUSE_2_BLED,
    capabilities: {
      hasImpedanceMeasurement: false,
      hasAccelerometer: true,
      hasGyroscope: true,
      hasBattery: true,
      hasAuxChannels: true, // PPG, temp
      supportsMarkers: false,
      supportsBrainflow: true,
    },
    defaultMontage: {
      channelCount: 4,
      labels: ['TP9', 'AF7', 'AF8', 'TP10'],
      positions: getPositions(['TP9', 'AF7', 'AF8', 'TP10']),
    },
    description: '4-channel consumer EEG with meditation features',
    setupUrl: 'https://choosemuse.com/',
  },
  
  'muse-s': {
    id: 'muse-s',
    name: 'Muse S',
    manufacturer: 'Muse',
    model: 'Muse S (Gen 2)',
    channelCount: 4,
    samplingRates: [256],
    defaultSamplingRate: 256,
    resolution: 12,
    protocols: ['ble'],
    defaultProtocol: 'ble',
    brainflowBoardId: BRAINFLOW_BOARD_IDS.MUSE_S,
    brainflowBoardIdBLE: BRAINFLOW_BOARD_IDS.MUSE_S_BLED,
    capabilities: {
      hasImpedanceMeasurement: false,
      hasAccelerometer: true,
      hasGyroscope: true,
      hasBattery: true,
      hasAuxChannels: true,
      supportsMarkers: false,
      supportsBrainflow: true,
    },
    defaultMontage: {
      channelCount: 4,
      labels: ['TP9', 'AF7', 'AF8', 'TP10'],
      positions: getPositions(['TP9', 'AF7', 'AF8', 'TP10']),
    },
    description: 'Sleep-focused 4-channel EEG headband',
    setupUrl: 'https://choosemuse.com/',
  },

  // -------------------------------------------------------------------------
  // Emotiv Devices
  // -------------------------------------------------------------------------
  'emotiv-insight': {
    id: 'emotiv-insight',
    name: 'Emotiv Insight',
    manufacturer: 'Emotiv',
    model: 'Insight',
    channelCount: 5,
    samplingRates: [128],
    defaultSamplingRate: 128,
    resolution: 14,
    protocols: ['ble', 'usb-hid'],
    defaultProtocol: 'ble',
    brainflowBoardId: BRAINFLOW_BOARD_IDS.INSIGHT,
    capabilities: {
      hasImpedanceMeasurement: true,
      hasAccelerometer: true,
      hasGyroscope: true,
      hasBattery: true,
      hasAuxChannels: false,
      supportsMarkers: true,
      supportsBrainflow: true,
    },
    defaultMontage: {
      channelCount: 5,
      labels: ['AF3', 'AF4', 'T7', 'T8', 'Pz'],
      positions: [
        { x: -0.588, y: 0.809, z: 0.0 },  // AF3
        { x: 0.588, y: 0.809, z: 0.0 },   // AF4
        { x: -1.0, y: 0.0, z: 0.0 },      // T7
        { x: 1.0, y: 0.0, z: 0.0 },       // T8
        { x: 0.0, y: -0.809, z: 0.588 },  // Pz
      ],
    },
    description: '5-channel wireless EEG with motion sensors',
    setupUrl: 'https://www.emotiv.com/insight/',
  },
  
  'emotiv-epoc-x': {
    id: 'emotiv-epoc-x',
    name: 'Emotiv EPOC X',
    manufacturer: 'Emotiv',
    model: 'EPOC X',
    channelCount: 14,
    samplingRates: [128, 256],
    defaultSamplingRate: 128,
    resolution: 14,
    protocols: ['ble', 'usb-hid'],
    defaultProtocol: 'ble',
    brainflowBoardId: BRAINFLOW_BOARD_IDS.EPOC,
    capabilities: {
      hasImpedanceMeasurement: true,
      hasAccelerometer: true,
      hasGyroscope: true,
      hasBattery: true,
      hasAuxChannels: false,
      supportsMarkers: true,
      supportsBrainflow: true,
    },
    defaultMontage: {
      channelCount: 14,
      labels: ['AF3', 'F7', 'F3', 'FC5', 'T7', 'P7', 'O1', 'O2', 'P8', 'T8', 'FC6', 'F4', 'F8', 'AF4'],
      positions: getPositions(['AF3', 'F7', 'F3', 'FC5', 'T7', 'P7', 'O1', 'O2', 'P8', 'T8', 'FC6', 'F4', 'F8', 'AF4']),
    },
    description: '14-channel research-ready wireless EEG',
    setupUrl: 'https://www.emotiv.com/epoc-x/',
  },

  // -------------------------------------------------------------------------
  // Cerelog ESP-EEG
  // -------------------------------------------------------------------------
  'cerelog-esp-eeg': {
    id: 'cerelog-esp-eeg',
    name: 'Cerelog ESP-EEG',
    manufacturer: 'Cerelog',
    model: 'ESP-EEG WiFi',
    channelCount: 8,
    samplingRates: [250],
    defaultSamplingRate: 250,
    resolution: 24,
    adcChip: 'ADS1299',
    vref: 4.5,
    gain: 24,
    protocols: ['wifi-websocket'],
    defaultProtocol: 'wifi-websocket',
    brainflowBoardId: undefined, // Not in Brainflow, use bridge
    capabilities: {
      hasImpedanceMeasurement: false, // ADS1299 does NOT support impedance
      hasAccelerometer: false,
      hasGyroscope: false,
      hasBattery: false,
      hasAuxChannels: false,
      supportsMarkers: false,
      supportsBrainflow: false,
    },
    defaultMontage: {
      channelCount: 8,
      labels: ['Fp1', 'Fp2', 'C3', 'Cz', 'C4', 'P3', 'Pz', 'P4'],
      positions: getPositions(['Fp1', 'Fp2', 'C3', 'Cz', 'C4', 'P3', 'Pz', 'P4']),
    },
    protocolConfig: {
      wifiSSID: 'CERELOG_EEG',
      wifiPassword: 'cerelog123',
      deviceIP: '192.168.4.1',
      tcpPort: 1112,
      udpDiscoveryPort: 4445,
      packetSize: 37,
      startMarker: 0xABCD,
      endMarker: 0xDCBA,
    },
    description: '8-channel WiFi EEG with ADS1299 (requires WebSocket bridge)',
    setupUrl: 'https://github.com/your-org/cerelog-esp-eeg',
  },

  // -------------------------------------------------------------------------
  // PiEEG Devices (Raspberry Pi BCI)
  // -------------------------------------------------------------------------
  'pieeg-8': {
    id: 'pieeg-8',
    name: 'PiEEG',
    manufacturer: 'PiEEG',
    model: 'PiEEG 8-Channel',
    channelCount: 8,
    samplingRates: [250, 500, 1000, 2000, 4000, 8000, 16000],
    defaultSamplingRate: 250,
    resolution: 24,
    adcChip: 'ADS1299',
    vref: 4.5,
    gain: 24,
    protocols: ['lsl', 'wifi-websocket'],
    defaultProtocol: 'lsl',
    brainflowBoardId: 46, // PiEEG BrainFlow board ID
    capabilities: {
      hasImpedanceMeasurement: true,
      hasAccelerometer: false,
      hasGyroscope: false,
      hasBattery: false, // Powered by Pi battery
      hasAuxChannels: true, // 3 free aux pins
      supportsMarkers: true,
      supportsBrainflow: true,
    },
    defaultMontage: {
      channelCount: 8,
      labels: ['Fp1', 'Fp2', 'C3', 'Cz', 'C4', 'P3', 'Pz', 'P4'],
      positions: getPositions(['Fp1', 'Fp2', 'C3', 'Cz', 'C4', 'P3', 'Pz', 'P4']),
    },
    protocolConfig: {
      spiInterface: '/dev/spidev0.0',
      spiSpeed: 2000000,
      drdyPin: 17, // BCM pin for DRDY
      resetPin: 27, // BCM pin for reset
      programmableGain: [1, 2, 4, 6, 8, 12, 24],
      wsBridgePort: 8766, // pieeg_ws_bridge.py default port
      wsBridgeScript: 'scripts/pieeg_ws_bridge.py',
    },
    description: 'Low-cost 8-channel Raspberry Pi EEG shield with ADS1299. Supports EEG, EMG, ECG.',
    setupUrl: 'https://pieeg.com/pieeg/',
  },

  'pieeg-16': {
    id: 'pieeg-16',
    name: 'PiEEG-16',
    manufacturer: 'PiEEG',
    model: 'PiEEG 16-Channel',
    channelCount: 16,
    samplingRates: [250, 500, 1000, 2000, 4000, 8000],
    defaultSamplingRate: 250,
    resolution: 24,
    adcChip: 'ADS1299-16',
    vref: 4.5,
    gain: 24,
    protocols: ['lsl', 'wifi-websocket'],
    defaultProtocol: 'lsl',
    brainflowBoardId: 47, // PiEEG-16 BrainFlow board ID
    capabilities: {
      hasImpedanceMeasurement: true,
      hasAccelerometer: false,
      hasGyroscope: false,
      hasBattery: false,
      hasAuxChannels: true,
      supportsMarkers: true,
      supportsBrainflow: true,
    },
    defaultMontage: {
      channelCount: 16,
      labels: ['Fp1', 'Fp2', 'F7', 'F3', 'Fz', 'F4', 'F8', 'T7', 'C3', 'Cz', 'C4', 'T8', 'P3', 'Pz', 'P4', 'O1'],
      positions: getPositions(['Fp1', 'Fp2', 'F7', 'F3', 'Fz', 'F4', 'F8', 'T7', 'C3', 'Cz', 'C4', 'T8', 'P3', 'Pz', 'P4', 'O1']),
    },
    protocolConfig: {
      spiInterface: '/dev/spidev0.0',
      spiSpeed: 2000000,
      drdyPin: 17,
      resetPin: 27,
      programmableGain: [1, 2, 4, 6, 8, 12, 24],
      daisyChained: true,
    },
    description: 'Dual ADS1299 16-channel Raspberry Pi EEG shield. Extended coverage for research applications.',
    setupUrl: 'https://pieeg.com/pieeg-16/',
  },

  'pieeg-ironbci': {
    id: 'pieeg-ironbci',
    name: 'IronBCI',
    manufacturer: 'PiEEG',
    model: 'IronBCI Wearable',
    channelCount: 8,
    samplingRates: [250, 500],
    defaultSamplingRate: 250,
    resolution: 24,
    adcChip: 'ADS1299',
    vref: 4.5,
    gain: 24,
    protocols: ['ble', 'wifi-websocket'],
    defaultProtocol: 'ble',
    capabilities: {
      hasImpedanceMeasurement: true,
      hasAccelerometer: false,
      hasGyroscope: false,
      hasBattery: true,
      hasAuxChannels: false,
      supportsMarkers: false,
      supportsBrainflow: false, // Uses custom mobile SDK
    },
    defaultMontage: {
      channelCount: 8,
      labels: ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'P3', 'P4'],
      positions: getPositions(['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'P3', 'P4']),
    },
    description: 'Wearable 8-channel BLE/WiFi BCI from PiEEG. Mobile SDK available.',
    setupUrl: 'https://pieeg.com/ironbci/',
  },

  'pieeg-ironbci-32': {
    id: 'pieeg-ironbci-32',
    name: 'IronBCI-32',
    manufacturer: 'PiEEG',
    model: 'IronBCI 32-Channel',
    channelCount: 32,
    samplingRates: [250, 500],
    defaultSamplingRate: 250,
    resolution: 24,
    adcChip: 'ADS1299-16', // Quad daisy-chained
    vref: 4.5,
    gain: 24,
    protocols: ['wifi-websocket', 'lsl'],
    defaultProtocol: 'wifi-websocket',
    capabilities: {
      hasImpedanceMeasurement: true,
      hasAccelerometer: false,
      hasGyroscope: false,
      hasBattery: true,
      hasAuxChannels: true,
      supportsMarkers: true,
      supportsBrainflow: false,
    },
    defaultMontage: {
      channelCount: 32,
      labels: [
        'Fp1', 'Fp2', 'F7', 'F3', 'Fz', 'F4', 'F8', 'FC5',
        'FC1', 'FC2', 'FC6', 'T7', 'C3', 'Cz', 'C4', 'T8',
        'CP5', 'CP1', 'CP2', 'CP6', 'P7', 'P3', 'Pz', 'P4',
        'P8', 'PO7', 'PO3', 'POz', 'PO4', 'PO8', 'O1', 'O2'
      ],
      positions: getPositions([
        'Fp1', 'Fp2', 'F7', 'F3', 'Fz', 'F4', 'F8', 'Fz',
        'Fz', 'Fz', 'Fz', 'T7', 'C3', 'Cz', 'C4', 'T8',
        'Cz', 'Cz', 'Cz', 'Cz', 'P7', 'P3', 'Pz', 'P4',
        'P8', 'Pz', 'Pz', 'Pz', 'Pz', 'Pz', 'O1', 'O2'
      ]),
    },
    description: 'Open-source 32-channel EEG development kit. High-density research-grade acquisition.',
    setupUrl: 'https://pieeg.com/ironbci-32/',
  },

  'pieeg-jneeg': {
    id: 'pieeg-jneeg',
    name: 'JNEEG',
    manufacturer: 'PiEEG',
    model: 'JNEEG Jetson Nano',
    channelCount: 8,
    samplingRates: [250, 500, 1000, 2000],
    defaultSamplingRate: 250,
    resolution: 24,
    adcChip: 'ADS1299',
    vref: 4.5,
    gain: 24,
    protocols: ['lsl', 'wifi-websocket'],
    defaultProtocol: 'lsl',
    capabilities: {
      hasImpedanceMeasurement: true,
      hasAccelerometer: false,
      hasGyroscope: false,
      hasBattery: false,
      hasAuxChannels: true,
      supportsMarkers: true,
      supportsBrainflow: false,
    },
    defaultMontage: {
      channelCount: 8,
      labels: ['Fp1', 'Fp2', 'C3', 'Cz', 'C4', 'P3', 'Pz', 'P4'],
      positions: getPositions(['Fp1', 'Fp2', 'C3', 'Cz', 'C4', 'P3', 'Pz', 'P4']),
    },
    protocolConfig: {
      spiInterface: '/dev/spidev0.0',
      spiSpeed: 2000000,
      drdyPin: 17,
      resetPin: 27,
      gpuAcceleration: true,
    },
    description: 'Jetson Nano EEG shield for real-time deep learning inference. GPU-accelerated processing.',
    setupUrl: 'https://pieeg.com/jneeg/',
  },

  'pieeg-ardeeg': {
    id: 'pieeg-ardeeg',
    name: 'ardEEG',
    manufacturer: 'PiEEG',
    model: 'ardEEG Arduino Shield',
    channelCount: 8,
    samplingRates: [250, 500],
    defaultSamplingRate: 250,
    resolution: 24,
    adcChip: 'ADS1299',
    vref: 4.5,
    gain: 24,
    protocols: ['serial'],
    defaultProtocol: 'serial',
    defaultBaudRate: 115200,
    capabilities: {
      hasImpedanceMeasurement: true,
      hasAccelerometer: false,
      hasGyroscope: false,
      hasBattery: false,
      hasAuxChannels: false,
      supportsMarkers: false,
      supportsBrainflow: false,
    },
    defaultMontage: {
      channelCount: 8,
      labels: ['Fp1', 'Fp2', 'C3', 'Cz', 'C4', 'P3', 'Pz', 'P4'],
      positions: getPositions(['Fp1', 'Fp2', 'C3', 'Cz', 'C4', 'P3', 'Pz', 'P4']),
    },
    description: 'Arduino EEG shield with ADS1299. Beginner-friendly for BCI prototyping.',
    setupUrl: 'https://pieeg.com/ardeeg/',
  },

  'pieeg-microbci': {
    id: 'pieeg-microbci',
    name: 'MicroBCI',
    manufacturer: 'PiEEG',
    model: 'MicroBCI STM32',
    channelCount: 8,
    samplingRates: [250, 500],
    defaultSamplingRate: 250,
    resolution: 24,
    adcChip: 'ADS1299',
    vref: 4.5,
    gain: 24,
    protocols: ['ble', 'serial'],
    defaultProtocol: 'ble',
    capabilities: {
      hasImpedanceMeasurement: true,
      hasAccelerometer: false,
      hasGyroscope: false,
      hasBattery: true,
      hasAuxChannels: false,
      supportsMarkers: false,
      supportsBrainflow: false,
    },
    defaultMontage: {
      channelCount: 8,
      labels: ['Fp1', 'Fp2', 'C3', 'Cz', 'C4', 'P3', 'Pz', 'P4'],
      positions: getPositions(['Fp1', 'Fp2', 'C3', 'Cz', 'C4', 'P3', 'Pz', 'P4']),
    },
    description: 'STM32 NUCLEO-WB55 BLE EEG shield. Ultra-compact embedded BCI.',
    setupUrl: 'https://pieeg.com/microbci/',
  },

  // -------------------------------------------------------------------------
  // Brainflow Testing
  // -------------------------------------------------------------------------
  'synthetic': {
    id: 'synthetic',
    name: 'Synthetic Board (Testing)',
    manufacturer: 'Brainflow',
    channelCount: 8,
    samplingRates: [250, 500, 1000],
    defaultSamplingRate: 250,
    resolution: 24,
    protocols: ['lsl'],
    defaultProtocol: 'lsl',
    brainflowBoardId: BRAINFLOW_BOARD_IDS.SYNTHETIC,
    capabilities: {
      hasImpedanceMeasurement: false,
      hasAccelerometer: true,
      hasGyroscope: false,
      hasBattery: false,
      hasAuxChannels: false,
      supportsMarkers: true,
      supportsBrainflow: true,
    },
    defaultMontage: {
      channelCount: 8,
      labels: ['Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5', 'Ch6', 'Ch7', 'Ch8'],
      positions: getPositions(['Fp1', 'Fp2', 'C3', 'C4', 'P3', 'P4', 'O1', 'O2']),
    },
    description: 'Brainflow synthetic board for testing without hardware',
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get device profile by ID
 */
export function getDeviceProfile(deviceId: string): DeviceProfile | undefined {
  return DEVICE_PROFILES[deviceId];
}

/**
 * List all available device profiles
 */
export function listDeviceProfiles(): DeviceProfile[] {
  return Object.values(DEVICE_PROFILES);
}

/**
 * Get devices by manufacturer
 */
export function getDevicesByManufacturer(manufacturer: DeviceManufacturer): DeviceProfile[] {
  return Object.values(DEVICE_PROFILES).filter(d => d.manufacturer === manufacturer);
}

/**
 * Get devices that support Brainflow
 */
export function getBrainflowCompatibleDevices(): DeviceProfile[] {
  return Object.values(DEVICE_PROFILES).filter(d => d.capabilities.supportsBrainflow);
}

/**
 * Get Brainflow board ID for a device
 */
export function getBrainflowBoardId(deviceId: string, useBLE = false): number | undefined {
  const profile = DEVICE_PROFILES[deviceId];
  if (!profile) return undefined;
  return useBLE && profile.brainflowBoardIdBLE 
    ? profile.brainflowBoardIdBLE 
    : profile.brainflowBoardId;
}

/**
 * Calculate scale factor from raw ADC value to µV
 */
export function getScaleFactorUV(profile: DeviceProfile): number {
  if (profile.scaleFactorUV) return profile.scaleFactorUV;
  if (profile.vref && profile.gain && profile.resolution) {
    // Standard ADS1299 formula: (2 * VREF / GAIN) / 2^resolution * 1e6
    return (2 * profile.vref / profile.gain) / Math.pow(2, profile.resolution) * 1e6;
  }
  return 1; // Default: no scaling
}

/**
 * Get default channel labels for a device
 */
export function getDefaultChannelLabels(deviceId: string): string[] {
  const profile = DEVICE_PROFILES[deviceId];
  if (!profile) return [];
  return profile.defaultMontage?.labels || 
    Array.from({ length: profile.channelCount }, (_, i) => `Ch${i + 1}`);
}

/**
 * Check if device supports a specific protocol
 */
export function supportsProtocol(deviceId: string, protocol: DeviceProtocol): boolean {
  const profile = DEVICE_PROFILES[deviceId];
  return profile?.protocols.includes(protocol) ?? false;
}

/**
 * Electrode configuration types for Cerelog ESP-EEG integration
 * Supports electrode placement, signal quality monitoring, and Brainflow export
 * 
 * IMPORTANT: Cerelog ESP-EEG uses ADS1299 chip which does NOT support impedance measurement.
 * Signal quality is estimated from signal amplitude/noise characteristics.
 * The "impedance" values shown in the UI are pseudo-impedance for user familiarity.
 */

export type DeviceType = 'esp-eeg' | 'brainflow' | 'phantomlink';
export type ConnectionProtocol = 'websocket' | 'serial' | 'lsl' | 'tcp';
export type MontageName = '10-20' | '10-10' | 'custom';

/**
 * 3D position in normalized head coordinates
 * Origin at nasion, +X right, +Y anterior, +Z superior
 */
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Individual electrode information
 */
export interface ElectrodeInfo {
  id: string;
  channelIndex: number;
  label: string; // 'Fp1', 'Fz', 'Cz', etc.
  position: Position3D;
  impedance?: number; // kΩ
  isActive: boolean;
  quality?: 'good' | 'fair' | 'poor' | 'disconnected';
  montagePosition?: string; // Standard 10-20 position if applicable
}

/**
 * Electrode layout configuration
 */
export interface ElectrodeLayout {
  name: string;
  montage: MontageName;
  electrodes: ElectrodeInfo[];
  referenceElectrodes?: string[]; // IDs of reference electrodes
  groundElectrode?: string; // ID of ground electrode
}

/**
 * Complete electrode configuration
 */
export interface ElectrodeConfiguration {
  id: string;
  name: string;
  deviceType: DeviceType;
  channelCount: number;
  samplingRate: number; // Hz
  layout: ElectrodeLayout;
  createdAt: number;
  updatedAt: number;
  metadata?: {
    subject?: string;
    session?: string;
    notes?: string;
  };
}

/**
 * Data source configuration for device connection
 */
export interface DataSource {
  type: DeviceType;
  url: string;
  protocol: ConnectionProtocol;
  baudRate?: number; // For serial connections
  deviceId?: string; // For USB serial device identification
}

/**
 * Impedance/Signal quality measurement data
 * 
 * NOTE: Cerelog ESP-EEG (ADS1299) does NOT have true impedance measurement.
 * The "impedance" field contains a PSEUDO-IMPEDANCE estimated from signal amplitude.
 * This provides a familiar metric for users, though it's not physically accurate.
 * 
 * Quality is derived from signal characteristics:
 * - 'good': Normal EEG amplitude range (~5-100µV std)
 * - 'fair': Slightly elevated noise (~100-200µV std)
 * - 'poor': High noise/artifacts (~200-500µV std)
 * - 'disconnected': Flatline (<5µV) or saturated (>500µV)
 */
export interface ImpedanceData {
  channelId: number;
  electrodeId: string;
  impedance: number; // kΩ - PSEUDO-IMPEDANCE derived from signal amplitude
  timestamp: number;
  quality: 'good' | 'fair' | 'poor' | 'disconnected';
}

/**
 * Spatial features derived from electrode positions
 * Used for spatial-aware decoding
 */
export interface SpatialFeatures {
  roiAverages?: Record<string, number>; // Region-of-interest averages
  spatialGradients?: {
    anteriorPosterior: number[];
    leftRight: number[];
    superiorInferior: number[];
  };
  neighborhoodCorrelations?: number[][]; // Spatial correlation matrix
}

/**
 * Impedance quality thresholds (in kΩ)
 */
export const IMPEDANCE_THRESHOLDS = {
  GOOD: 5,
  FAIR: 10,
  POOR: 20,
} as const;

/**
 * Standard 10-20 electrode positions (normalized coordinates)
 * Based on international 10-20 system
 */
export const STANDARD_10_20_POSITIONS: Record<string, Position3D> = {
  // Frontal pole
  Fp1: { x: -0.309, y: 0.951, z: 0.0 },
  Fp2: { x: 0.309, y: 0.951, z: 0.0 },
  
  // Frontal
  F7: { x: -0.809, y: 0.588, z: 0.0 },
  F3: { x: -0.454, y: 0.707, z: 0.5 },
  Fz: { x: 0.0, y: 0.809, z: 0.588 },
  F4: { x: 0.454, y: 0.707, z: 0.5 },
  F8: { x: 0.809, y: 0.588, z: 0.0 },
  
  // Frontal-Temporal
  FT7: { x: -0.891, y: 0.309, z: -0.309 },
  FT8: { x: 0.891, y: 0.309, z: -0.309 },
  
  // Central
  C3: { x: -0.707, y: 0.0, z: 0.707 },
  Cz: { x: 0.0, y: 0.0, z: 1.0 },
  C4: { x: 0.707, y: 0.0, z: 0.707 },
  
  // Temporal
  T7: { x: -1.0, y: 0.0, z: 0.0 },
  T8: { x: 1.0, y: 0.0, z: 0.0 },
  
  // Parietal
  P7: { x: -0.809, y: -0.588, z: 0.0 },
  P3: { x: -0.454, y: -0.707, z: 0.5 },
  Pz: { x: 0.0, y: -0.809, z: 0.588 },
  P4: { x: 0.454, y: -0.707, z: 0.5 },
  P8: { x: 0.809, y: -0.588, z: 0.0 },
  
  // Occipital
  O1: { x: -0.309, y: -0.951, z: 0.0 },
  O2: { x: 0.309, y: -0.951, z: 0.0 },
};

/**
 * Get impedance quality based on threshold
 */
export function getImpedanceQuality(impedance: number): 'good' | 'fair' | 'poor' | 'disconnected' {
  if (impedance < 0 || impedance > 1000) return 'disconnected';
  if (impedance <= IMPEDANCE_THRESHOLDS.GOOD) return 'good';
  if (impedance <= IMPEDANCE_THRESHOLDS.FAIR) return 'fair';
  if (impedance <= IMPEDANCE_THRESHOLDS.POOR) return 'poor';
  return 'disconnected';
}

/**
 * Create a default electrode info object
 */
export function createDefaultElectrode(
  channelIndex: number,
  label?: string,
  position?: Position3D
): ElectrodeInfo {
  const defaultLabel = label || `Ch${channelIndex}`;
  const defaultPosition = position || { x: 0, y: 0, z: 0 };
  
  return {
    id: `electrode-${channelIndex}`,
    channelIndex,
    label: defaultLabel,
    position: defaultPosition,
    isActive: true,
    quality: 'disconnected',
  };
}

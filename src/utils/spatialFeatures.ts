/**
 * Spatial feature extraction utilities for electrode-aware decoding
 * Computes spatial features from electrode positions and neural activity
 */

import type { ElectrodeConfiguration, SpatialFeatures, ElectrodeInfo } from '../types/electrodes';

/**
 * Define regions of interest (ROI) based on electrode positions
 */
interface ROI {
  name: string;
  electrodes: string[]; // Electrode labels in this region
}

const STANDARD_ROIS: ROI[] = [
  { name: 'frontal', electrodes: ['Fp1', 'Fp2', 'F7', 'F3', 'Fz', 'F4', 'F8'] },
  { name: 'central', electrodes: ['C3', 'Cz', 'C4'] },
  { name: 'parietal', electrodes: ['P7', 'P3', 'Pz', 'P4', 'P8'] },
  { name: 'temporal', electrodes: ['T7', 'FT7', 'T8', 'FT8'] },
  { name: 'occipital', electrodes: ['O1', 'O2'] },
];

/**
 * Extract spatial features from spike data and electrode configuration
 */
export function extractSpatialFeatures(
  spikes: number[],
  electrodeConfig: ElectrodeConfiguration
): SpatialFeatures {
  const electrodes = electrodeConfig.layout.electrodes;
  
  // ROI averages
  const roiAverages: Record<string, number> = {};
  for (const roi of STANDARD_ROIS) {
    const roiElectrodes = electrodes.filter(e => roi.electrodes.includes(e.label) && e.isActive);
    if (roiElectrodes.length > 0) {
      const sum = roiElectrodes.reduce((acc, e) => {
        const spikeCount = spikes[e.channelIndex] || 0;
        return acc + spikeCount;
      }, 0);
      roiAverages[roi.name] = sum / roiElectrodes.length;
    }
  }

  // Spatial gradients
  const spatialGradients = computeSpatialGradients(spikes, electrodes);

  // Neighborhood correlations (simplified - pairwise distances)
  const neighborhoodCorrelations = computeNeighborhoodCorrelations(spikes, electrodes);

  return {
    roiAverages,
    spatialGradients,
    neighborhoodCorrelations,
  };
}

/**
 * Compute spatial gradients along principal axes
 */
function computeSpatialGradients(
  spikes: number[],
  electrodes: ElectrodeInfo[]
): {
  anteriorPosterior: number[];
  leftRight: number[];
  superiorInferior: number[];
} {
  const activeElectrodes = electrodes.filter(e => e.isActive);
  
  // Compute weighted average position
  const totalActivity = activeElectrodes.reduce((sum, e) => sum + (spikes[e.channelIndex] || 0), 0);
  
  if (totalActivity === 0) {
    return {
      anteriorPosterior: [],
      leftRight: [],
      superiorInferior: [],
    };
  }

  // Gradient along each axis (correlation between position and activity)
  const apGradient: number[] = [];
  const lrGradient: number[] = [];
  const siGradient: number[] = [];

  for (const electrode of activeElectrodes) {
    const activity = spikes[electrode.channelIndex] || 0;
    apGradient.push(activity * electrode.position.y); // Anterior-posterior
    lrGradient.push(activity * electrode.position.x); // Left-right
    siGradient.push(activity * electrode.position.z); // Superior-inferior
  }

  return {
    anteriorPosterior: apGradient,
    leftRight: lrGradient,
    superiorInferior: siGradient,
  };
}

/**
 * Compute correlation between spatially neighboring electrodes
 */
function computeNeighborhoodCorrelations(
  spikes: number[],
  electrodes: ElectrodeInfo[]
): number[][] {
  const activeElectrodes = electrodes.filter(e => e.isActive);
  const n = activeElectrodes.length;
  
  // Initialize correlation matrix
  const correlations: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));

  // Compute pairwise distances and activity correlations
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (i === j) {
        correlations[i][j] = 1.0;
      } else {
        const e1 = activeElectrodes[i];
        const e2 = activeElectrodes[j];
        
        // Euclidean distance
        const dx = e1.position.x - e2.position.x;
        const dy = e1.position.y - e2.position.y;
        const dz = e1.position.z - e2.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        // Activity correlation (simplified - just normalized product)
        const a1 = spikes[e1.channelIndex] || 0;
        const a2 = spikes[e2.channelIndex] || 0;
        
        // Distance-weighted correlation
        const correlation = distance > 0 ? (a1 * a2) / (distance + 1) : 0;
        
        correlations[i][j] = correlation;
        correlations[j][i] = correlation;
      }
    }
  }

  return correlations;
}

/**
 * Create a channel mask based on active electrodes
 */
export function createChannelMask(
  electrodeConfig: ElectrodeConfiguration
): boolean[] {
  const mask: boolean[] = new Array(electrodeConfig.channelCount).fill(false);
  
  for (const electrode of electrodeConfig.layout.electrodes) {
    if (electrode.channelIndex < mask.length) {
      mask[electrode.channelIndex] = electrode.isActive;
    }
  }
  
  return mask;
}

/**
 * Apply channel mask to spike data (zero out inactive channels)
 */
export function applyChannelMask(
  spikes: number[],
  mask: boolean[]
): number[] {
  return spikes.map((spike, i) => (mask[i] ? spike : 0));
}

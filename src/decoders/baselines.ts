// Baseline JavaScript decoders for testing

import type { Decoder } from '../types/decoders';

/**
 * Passthrough Decoder
 * Simply returns the actual cursor position from kinematics
 * This should result in perfect tracking of the Bio-Link cursor
 */
export const passthroughDecoder: Decoder = {
  id: 'passthrough',
  name: 'Passthrough (Perfect)',
  type: 'javascript',
  description: 'Returns actual cursor position. Perfect tracking baseline.',
  code: `
    // Extract kinematics data
    const { x, y, vx, vy } = input.kinematics;
    
    // Return current position
    return { x, y, vx, vy };
  `,
};

/**
 * Delayed Decoder
 * Returns position from 100ms ago to simulate lag
 * Should trigger desync detection
 */
export const delayedDecoder: Decoder = {
  id: 'delayed',
  name: 'Delayed (100ms)',
  type: 'javascript',
  description: 'Returns 100ms old position. Tests desync detection.',
  code: `
    // Get history (if available)
    const history = input.history || [];
    
    if (history.length >= 4) {
      // 4 packets ago = 100ms at 40Hz
      const old = history[history.length - 4];
      return { x: old.x, y: old.y };
    }
    
    // Fallback to current position
    const { x, y } = input.kinematics;
    return { x, y };
  `,
};

/**
 * Velocity Predictor
 * Predicts next position using current velocity
 */
export const velocityPredictorDecoder: Decoder = {
  id: 'velocity-predictor',
  name: 'Velocity Predictor',
  type: 'javascript',
  description: 'Predicts position using velocity. Simple linear model.',
  code: `
    const { x, y, vx, vy } = input.kinematics;
    const dt = 0.025; // 25ms at 40Hz
    
    // Linear prediction: x_next = x + vx * dt
    const predictedX = x + vx * dt;
    const predictedY = y + vy * dt;
    
    return { 
      x: predictedX, 
      y: predictedY,
      vx, 
      vy 
    };
  `,
};

/**
 * Spike-based Simple Decoder
 * Uses spike counts to modulate velocity (naive approach)
 */
export const spikeBasedDecoder: Decoder = {
  id: 'spike-simple',
  name: 'Spike-Based Simple',
  type: 'javascript',
  description: 'Naive decoder using spike rate to scale velocity.',
  code: `
    const { x, y, vx, vy } = input.kinematics;
    const spikes = input.spikes;
    
    // Calculate total spike rate
    const totalSpikes = spikes.reduce((sum, s) => sum + s, 0);
    const avgSpikeRate = totalSpikes / spikes.length;
    
    // Scale velocity by normalized spike rate (very naive)
    const scale = Math.min(avgSpikeRate / 10, 2);
    
    return {
      x: x + vx * scale * 0.025,
      y: y + vy * scale * 0.025,
      vx: vx * scale,
      vy: vy * scale,
    };
  `,
};

// Export all baseline decoders
export const baselineDecoders: Decoder[] = [
  passthroughDecoder,
  delayedDecoder,
  velocityPredictorDecoder,
  spikeBasedDecoder,
];

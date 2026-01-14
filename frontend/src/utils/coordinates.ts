// Coordinate transformation utilities

import { VISUALIZATION } from './constants';

/**
 * Normalize position from dataset coordinates to viewport coordinates (-100 to +100)
 * MC_Maze dataset uses arbitrary position units that need to be scaled
 */
export function normalizePosition(
  x: number,
  y: number,
  metadata?: { min_x?: number; max_x?: number; min_y?: number; max_y?: number }
): { x: number; y: number } {
  // Default bounds for MC_Maze dataset (approximate)
  const minX = metadata?.min_x ?? -200;
  const maxX = metadata?.max_x ?? 200;
  const minY = metadata?.min_y ?? -200;
  const maxY = metadata?.max_y ?? 200;

  // Normalize to [-1, 1]
  const normalizedX = (x - minX) / (maxX - minX) * 2 - 1;
  const normalizedY = (y - minY) / (maxY - minY) * 2 - 1;

  // Scale to viewport coordinates
  return {
    x: normalizedX * VISUALIZATION.COORDINATE_SCALE,
    y: normalizedY * VISUALIZATION.COORDINATE_SCALE,
  };
}

/**
 * Convert velocity to normalized units
 */
export function normalizeVelocity(
  vx: number,
  vy: number,
  scale: number = 1
): { vx: number; vy: number } {
  return {
    vx: vx * scale,
    vy: vy * scale,
  };
}

/**
 * Calculate Euclidean distance between two points
 */
export function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * Calculate the area of the "Trinity Triangle"
 * between Phantom (intention), Bio-Link (ground truth), and Loop-Back (decoder)
 */
export function calculateTrinityArea(
  phantom: { x: number; y: number },
  bioLink: { x: number; y: number },
  loopBack: { x: number; y: number }
): number {
  // Using the cross product formula for triangle area
  return Math.abs(
    (phantom.x * (bioLink.y - loopBack.y) +
      bioLink.x * (loopBack.y - phantom.y) +
      loopBack.x * (phantom.y - bioLink.y)) / 2
  );
}

/**
 * Linear interpolation for smooth transitions
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Convert 2D coordinates to Three.js 3D coordinates
 * (z-axis typically set to 0 for 2D visualization in 3D space)
 */
export function to3D(
  x: number,
  y: number,
  z: number = 0
): [number, number, number] {
  return [x, z, -y]; // Three.js uses Y-up, we map Y to Z for top-down view
}

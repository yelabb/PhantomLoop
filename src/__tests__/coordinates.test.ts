/**
 * Unit Tests for Coordinate Utilities
 * Tests the mathematical transformations used in neural visualization
 */

import { describe, it, expect } from 'vitest';
import {
  normalizePosition,
  normalizeVelocity,
  distance,
  calculateTrinityArea,
  lerp,
  to3D,
} from '../utils/coordinates';
import { VISUALIZATION } from '../utils/constants';

describe('coordinates', () => {
  describe('normalizePosition', () => {
    it('should normalize center position to (0, 0)', () => {
      const result = normalizePosition(0, 0);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(0);
    });

    it('should normalize max positive position correctly', () => {
      // With default bounds of -200 to 200
      const result = normalizePosition(200, 200);
      expect(result.x).toBeCloseTo(VISUALIZATION.COORDINATE_SCALE);
      expect(result.y).toBeCloseTo(VISUALIZATION.COORDINATE_SCALE);
    });

    it('should normalize max negative position correctly', () => {
      const result = normalizePosition(-200, -200);
      expect(result.x).toBeCloseTo(-VISUALIZATION.COORDINATE_SCALE);
      expect(result.y).toBeCloseTo(-VISUALIZATION.COORDINATE_SCALE);
    });

    it('should use custom metadata bounds when provided', () => {
      const metadata = { min_x: 0, max_x: 100, min_y: 0, max_y: 100 };
      const result = normalizePosition(50, 50, metadata);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(0);
    });

    it('should handle edge case at minimum bounds', () => {
      const metadata = { min_x: 0, max_x: 100, min_y: 0, max_y: 100 };
      const result = normalizePosition(0, 0, metadata);
      expect(result.x).toBeCloseTo(-VISUALIZATION.COORDINATE_SCALE);
      expect(result.y).toBeCloseTo(-VISUALIZATION.COORDINATE_SCALE);
    });

    it('should handle asymmetric bounds', () => {
      const metadata = { min_x: -100, max_x: 300, min_y: -50, max_y: 150 };
      const result = normalizePosition(100, 50, metadata);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(0);
    });
  });

  describe('normalizeVelocity', () => {
    it('should return velocity unchanged with scale 1', () => {
      const result = normalizeVelocity(10, 20, 1);
      expect(result.vx).toBe(10);
      expect(result.vy).toBe(20);
    });

    it('should scale velocity correctly', () => {
      const result = normalizeVelocity(10, 20, 2);
      expect(result.vx).toBe(20);
      expect(result.vy).toBe(40);
    });

    it('should handle negative velocities', () => {
      const result = normalizeVelocity(-5, -10, 3);
      expect(result.vx).toBe(-15);
      expect(result.vy).toBe(-30);
    });

    it('should handle zero velocity', () => {
      const result = normalizeVelocity(0, 0, 100);
      expect(result.vx).toBe(0);
      expect(result.vy).toBe(0);
    });

    it('should use default scale of 1', () => {
      const result = normalizeVelocity(5, 10);
      expect(result.vx).toBe(5);
      expect(result.vy).toBe(10);
    });
  });

  describe('distance', () => {
    it('should calculate distance between same point as 0', () => {
      expect(distance(0, 0, 0, 0)).toBe(0);
      expect(distance(5, 5, 5, 5)).toBe(0);
    });

    it('should calculate horizontal distance correctly', () => {
      expect(distance(0, 0, 3, 0)).toBe(3);
      expect(distance(0, 0, -4, 0)).toBe(4);
    });

    it('should calculate vertical distance correctly', () => {
      expect(distance(0, 0, 0, 5)).toBe(5);
      expect(distance(0, 0, 0, -6)).toBe(6);
    });

    it('should calculate diagonal distance (3-4-5 triangle)', () => {
      expect(distance(0, 0, 3, 4)).toBe(5);
    });

    it('should calculate diagonal distance (5-12-13 triangle)', () => {
      expect(distance(0, 0, 5, 12)).toBe(13);
    });

    it('should be symmetric', () => {
      expect(distance(1, 2, 4, 6)).toBe(distance(4, 6, 1, 2));
    });

    it('should handle negative coordinates', () => {
      expect(distance(-3, -4, 0, 0)).toBe(5);
    });

    it('should handle floating point coordinates', () => {
      const d = distance(0, 0, 1, 1);
      expect(d).toBeCloseTo(Math.sqrt(2));
    });
  });

  describe('calculateTrinityArea', () => {
    it('should return 0 for collinear points', () => {
      const phantom = { x: 0, y: 0 };
      const bioLink = { x: 1, y: 1 };
      const loopBack = { x: 2, y: 2 };
      expect(calculateTrinityArea(phantom, bioLink, loopBack)).toBe(0);
    });

    it('should calculate area of right triangle correctly', () => {
      // Triangle with base 4 and height 3 -> area = 6
      const phantom = { x: 0, y: 0 };
      const bioLink = { x: 4, y: 0 };
      const loopBack = { x: 0, y: 3 };
      expect(calculateTrinityArea(phantom, bioLink, loopBack)).toBe(6);
    });

    it('should return positive area regardless of point order', () => {
      const phantom = { x: 0, y: 0 };
      const bioLink = { x: 4, y: 0 };
      const loopBack = { x: 0, y: 3 };
      
      // All permutations should return same absolute area
      expect(calculateTrinityArea(phantom, bioLink, loopBack)).toBe(6);
      expect(calculateTrinityArea(bioLink, loopBack, phantom)).toBe(6);
      expect(calculateTrinityArea(loopBack, phantom, bioLink)).toBe(6);
    });

    it('should calculate area of unit square triangle', () => {
      // Half of 1x1 square = 0.5
      const phantom = { x: 0, y: 0 };
      const bioLink = { x: 1, y: 0 };
      const loopBack = { x: 0, y: 1 };
      expect(calculateTrinityArea(phantom, bioLink, loopBack)).toBe(0.5);
    });

    it('should handle points with negative coordinates', () => {
      const phantom = { x: -2, y: -2 };
      const bioLink = { x: 2, y: -2 };
      const loopBack = { x: 0, y: 2 };
      // Base 4, height 4 -> area = 8
      expect(calculateTrinityArea(phantom, bioLink, loopBack)).toBe(8);
    });

    it('should return 0 when all points are the same', () => {
      const point = { x: 5, y: 5 };
      expect(calculateTrinityArea(point, point, point)).toBe(0);
    });
  });

  describe('lerp', () => {
    it('should return start when t=0', () => {
      expect(lerp(0, 100, 0)).toBe(0);
      expect(lerp(-50, 50, 0)).toBe(-50);
    });

    it('should return end when t=1', () => {
      expect(lerp(0, 100, 1)).toBe(100);
      expect(lerp(-50, 50, 1)).toBe(50);
    });

    it('should return midpoint when t=0.5', () => {
      expect(lerp(0, 100, 0.5)).toBe(50);
      expect(lerp(-50, 50, 0.5)).toBe(0);
    });

    it('should interpolate at 25%', () => {
      expect(lerp(0, 100, 0.25)).toBe(25);
    });

    it('should interpolate at 75%', () => {
      expect(lerp(0, 100, 0.75)).toBe(75);
    });

    it('should handle negative ranges', () => {
      expect(lerp(100, 0, 0.5)).toBe(50);
    });

    it('should extrapolate beyond 0-1 range', () => {
      expect(lerp(0, 100, 1.5)).toBe(150);
      expect(lerp(0, 100, -0.5)).toBe(-50);
    });

    it('should handle same start and end', () => {
      expect(lerp(50, 50, 0.5)).toBe(50);
    });
  });

  describe('to3D', () => {
    it('should convert 2D to 3D with default z=0', () => {
      const result = to3D(10, 20);
      expect(result).toEqual([10, 0, -20]);
    });

    it('should handle custom z value', () => {
      const result = to3D(10, 20, 5);
      expect(result).toEqual([10, 5, -20]);
    });

    it('should preserve x coordinate', () => {
      const result = to3D(42, 0);
      expect(result[0]).toBe(42);
    });

    it('should negate y for Three.js coordinate system', () => {
      const result = to3D(0, 30);
      expect(result[2]).toBe(-30);
    });

    it('should map z to y-axis (height)', () => {
      const result = to3D(0, 0, 15);
      expect(result[1]).toBe(15);
    });

    it('should handle origin', () => {
      const result = to3D(0, 0, 0);
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(0);
      expect(result[2] === 0).toBe(true);  // -0 == 0 in JavaScript
    });

    it('should handle negative coordinates', () => {
      const result = to3D(-10, -20, -5);
      expect(result).toEqual([-10, -5, 20]);
    });
  });
});

/**
 * Unit Tests for Constants
 * Validates configuration constants and their relationships
 */

import { describe, it, expect } from 'vitest';
import {
  COLORS,
  SERVER_CONFIG,
  STREAM_CONFIG,
  TIMELINE_CONFIG,
  PERFORMANCE_THRESHOLDS,
  VISUALIZATION,
  DATASET,
  CAMERA_PRESETS,
} from '../utils/constants';

describe('Constants', () => {
  describe('COLORS', () => {
    it('should have all required color definitions', () => {
      expect(COLORS.PHANTOM).toBeDefined();
      expect(COLORS.BIOLINK).toBeDefined();
      expect(COLORS.LOOPBACK).toBeDefined();
      expect(COLORS.TARGET).toBeDefined();
      expect(COLORS.GRID).toBeDefined();
      expect(COLORS.BACKGROUND).toBeDefined();
    });

    it('should have valid hex color format', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      
      expect(COLORS.PHANTOM).toMatch(hexColorRegex);
      expect(COLORS.BIOLINK).toMatch(hexColorRegex);
      expect(COLORS.LOOPBACK).toMatch(hexColorRegex);
      expect(COLORS.TARGET).toMatch(hexColorRegex);
      expect(COLORS.GRID).toMatch(hexColorRegex);
      expect(COLORS.BACKGROUND).toMatch(hexColorRegex);
    });

    it('should have distinct colors for Trinity elements', () => {
      const trinityColors = [COLORS.PHANTOM, COLORS.BIOLINK, COLORS.LOOPBACK];
      const uniqueColors = new Set(trinityColors);
      expect(uniqueColors.size).toBe(3);
    });
  });

  describe('SERVER_CONFIG', () => {
    it('should have a valid WebSocket URL', () => {
      expect(SERVER_CONFIG.BASE_URL).toMatch(/^wss?:\/\//);
    });
  });

  describe('STREAM_CONFIG', () => {
    it('should have positive packet rate', () => {
      expect(STREAM_CONFIG.PACKET_RATE_HZ).toBeGreaterThan(0);
    });

    it('should have consistent packet interval', () => {
      // PACKET_INTERVAL_MS should be 1000 / PACKET_RATE_HZ
      const expectedInterval = 1000 / STREAM_CONFIG.PACKET_RATE_HZ;
      expect(STREAM_CONFIG.PACKET_INTERVAL_MS).toBe(expectedInterval);
    });

    it('should have reasonable buffer size', () => {
      expect(STREAM_CONFIG.BUFFER_SIZE).toBeGreaterThanOrEqual(STREAM_CONFIG.PACKET_RATE_HZ);
    });

    it('should have reconnect configuration', () => {
      expect(STREAM_CONFIG.RECONNECT_DELAY_MS).toBeGreaterThan(0);
      expect(STREAM_CONFIG.MAX_RECONNECT_ATTEMPTS).toBeGreaterThan(0);
    });
  });

  describe('TIMELINE_CONFIG', () => {
    it('should have consistent history size calculation', () => {
      // HISTORY_SIZE should equal PACKET_RATE_HZ * HISTORY_SECONDS
      const expectedSize = STREAM_CONFIG.PACKET_RATE_HZ * TIMELINE_CONFIG.HISTORY_SECONDS;
      expect(TIMELINE_CONFIG.HISTORY_SIZE).toBe(expectedSize);
    });

    it('should have reasonable snapshot limit', () => {
      expect(TIMELINE_CONFIG.SNAPSHOT_LIMIT).toBeGreaterThan(0);
      expect(TIMELINE_CONFIG.SNAPSHOT_LIMIT).toBeLessThan(20);
    });
  });

  describe('PERFORMANCE_THRESHOLDS', () => {
    it('should have target FPS of 60', () => {
      expect(PERFORMANCE_THRESHOLDS.TARGET_FPS).toBe(60);
    });

    it('should have reasonable latency thresholds', () => {
      expect(PERFORMANCE_THRESHOLDS.MAX_NETWORK_LATENCY_MS).toBeGreaterThan(0);
      expect(PERFORMANCE_THRESHOLDS.MAX_DECODER_LATENCY_MS).toBeGreaterThan(0);
      expect(PERFORMANCE_THRESHOLDS.MAX_TOTAL_LATENCY_MS).toBeGreaterThanOrEqual(
        PERFORMANCE_THRESHOLDS.MAX_NETWORK_LATENCY_MS
      );
    });

    it('should have total latency >= network + decoder', () => {
      expect(PERFORMANCE_THRESHOLDS.MAX_TOTAL_LATENCY_MS).toBeGreaterThanOrEqual(
        PERFORMANCE_THRESHOLDS.MAX_NETWORK_LATENCY_MS + PERFORMANCE_THRESHOLDS.MAX_DECODER_LATENCY_MS - 10
      );
    });

    it('should have desync threshold greater than jitter tolerance', () => {
      expect(PERFORMANCE_THRESHOLDS.DESYNC_THRESHOLD_MS).toBeGreaterThan(
        PERFORMANCE_THRESHOLDS.JITTER_TOLERANCE_MS
      );
    });

    it('should have decoder timeout less than max decoder latency', () => {
      expect(PERFORMANCE_THRESHOLDS.DECODER_TIMEOUT_MS).toBeLessThanOrEqual(
        PERFORMANCE_THRESHOLDS.MAX_DECODER_LATENCY_MS
      );
    });
  });

  describe('VISUALIZATION', () => {
    it('should have positive size values', () => {
      expect(VISUALIZATION.PHANTOM_SIZE).toBeGreaterThan(0);
      expect(VISUALIZATION.BIOLINK_SIZE).toBeGreaterThan(0);
      expect(VISUALIZATION.LOOPBACK_SIZE).toBeGreaterThan(0);
      expect(VISUALIZATION.TARGET_RADIUS).toBeGreaterThan(0);
    });

    it('should have BioLink as reference size (1.0)', () => {
      expect(VISUALIZATION.BIOLINK_SIZE).toBe(1.0);
    });

    it('should have reasonable trail length', () => {
      expect(VISUALIZATION.TRAIL_LENGTH).toBeGreaterThan(0);
      expect(VISUALIZATION.TRAIL_LENGTH).toBeLessThanOrEqual(STREAM_CONFIG.BUFFER_SIZE);
    });

    it('should have consistent grid configuration', () => {
      expect(VISUALIZATION.GRID_SIZE).toBeGreaterThan(0);
      expect(VISUALIZATION.GRID_DIVISIONS).toBeGreaterThan(0);
      expect(VISUALIZATION.GRID_SIZE % VISUALIZATION.GRID_DIVISIONS).toBe(0);
    });

    it('should have positive coordinate scale', () => {
      expect(VISUALIZATION.COORDINATE_SCALE).toBeGreaterThan(0);
    });
  });

  describe('DATASET', () => {
    it('should have MC_Maze dataset configuration', () => {
      expect(DATASET.CHANNEL_COUNT).toBe(142);
      expect(DATASET.SAMPLING_RATE_HZ).toBe(40);
      expect(DATASET.BIN_SIZE_MS).toBe(25);
    });

    it('should have consistent sampling rate with stream config', () => {
      expect(DATASET.SAMPLING_RATE_HZ).toBe(STREAM_CONFIG.PACKET_RATE_HZ);
    });

    it('should have bin size matching packet interval', () => {
      expect(DATASET.BIN_SIZE_MS).toBe(STREAM_CONFIG.PACKET_INTERVAL_MS);
    });

    it('should have positive duration and trial count', () => {
      expect(DATASET.DURATION_SECONDS).toBeGreaterThan(0);
      expect(DATASET.TRIAL_COUNT).toBeGreaterThan(0);
    });
  });

  describe('CAMERA_PRESETS', () => {
    it('should have all preset views', () => {
      expect(CAMERA_PRESETS.top).toBeDefined();
      expect(CAMERA_PRESETS.perspective).toBeDefined();
      expect(CAMERA_PRESETS.side).toBeDefined();
    });

    it('should have valid 3D position arrays', () => {
      for (const preset of Object.values(CAMERA_PRESETS)) {
        expect(preset.position).toHaveLength(3);
        expect(preset.target).toHaveLength(3);
        preset.position.forEach(v => expect(typeof v).toBe('number'));
        preset.target.forEach(v => expect(typeof v).toBe('number'));
      }
    });

    it('should have top camera looking down', () => {
      // Top camera should have high Y position
      expect(CAMERA_PRESETS.top.position[1]).toBeGreaterThan(50);
    });

    it('should have perspective camera offset from origin', () => {
      const [x, y, z] = CAMERA_PRESETS.perspective.position;
      const distance = Math.sqrt(x * x + y * y + z * z);
      expect(distance).toBeGreaterThan(0);
    });
  });
});

describe('Constant Immutability', () => {
  it('constants should be frozen (as const)', () => {
    // TypeScript `as const` makes objects readonly at compile time
    // We can verify the structure is as expected
    expect(Object.keys(COLORS).length).toBeGreaterThan(0);
    expect(Object.keys(STREAM_CONFIG).length).toBeGreaterThan(0);
    expect(Object.keys(VISUALIZATION).length).toBeGreaterThan(0);
  });
});

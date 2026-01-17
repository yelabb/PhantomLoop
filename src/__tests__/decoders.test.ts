/**
 * Unit Tests for Baseline Decoders
 * Tests the neural decoder algorithms and their mathematical correctness
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  passthroughDecoder,
  delayedDecoder,
  velocityPredictorDecoder,
  spikeBasedDecoder,
  baselineDecoders,
} from '../decoders/baselines';
import type { DecoderInput } from '../types/decoders';

// Helper to create a decoder function from code string
function createDecoderFn(code: string): (input: DecoderInput) => { x: number; y: number; vx?: number; vy?: number } {
  return new Function('input', code) as (input: DecoderInput) => { x: number; y: number; vx?: number; vy?: number };
}

// Mock decoder input
function createMockInput(overrides?: Partial<DecoderInput> & { history?: Array<{ x: number; y: number }> }): DecoderInput & { history?: Array<{ x: number; y: number }> } {
  return {
    kinematics: {
      x: 50,
      y: 30,
      vx: 10,
      vy: -5,
    },
    spikes: new Array(20).fill(0).map(() => Math.floor(Math.random() * 5)),
    ...overrides,
  };
}

describe('Baseline Decoders', () => {
  describe('Decoder Registry', () => {
    it('should have all baseline decoders registered', () => {
      expect(baselineDecoders).toHaveLength(4);
    });

    it('should have unique decoder IDs', () => {
      const ids = baselineDecoders.map(d => d.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have all required decoder properties', () => {
      for (const decoder of baselineDecoders) {
        expect(decoder.id).toBeDefined();
        expect(decoder.name).toBeDefined();
        expect(decoder.type).toBe('javascript');
        expect(decoder.description).toBeDefined();
        expect(decoder.code).toBeDefined();
      }
    });
  });

  describe('Passthrough Decoder', () => {
    it('should have correct metadata', () => {
      expect(passthroughDecoder.id).toBe('passthrough');
      expect(passthroughDecoder.name).toContain('Passthrough');
      expect(passthroughDecoder.type).toBe('javascript');
    });

    it('should return exact input position', () => {
      const fn = createDecoderFn(passthroughDecoder.code!);
      const input = createMockInput({
        kinematics: { x: 42, y: 73, vx: 5, vy: -3 },
      });

      const result = fn(input);
      expect(result.x).toBe(42);
      expect(result.y).toBe(73);
    });

    it('should return velocity values', () => {
      const fn = createDecoderFn(passthroughDecoder.code!);
      const input = createMockInput({
        kinematics: { x: 0, y: 0, vx: 15, vy: -8 },
      });

      const result = fn(input);
      expect(result.vx).toBe(15);
      expect(result.vy).toBe(-8);
    });

    it('should handle zero position', () => {
      const fn = createDecoderFn(passthroughDecoder.code!);
      const input = createMockInput({
        kinematics: { x: 0, y: 0, vx: 0, vy: 0 },
      });

      const result = fn(input);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const fn = createDecoderFn(passthroughDecoder.code!);
      const input = createMockInput({
        kinematics: { x: -100, y: -50, vx: -5, vy: -10 },
      });

      const result = fn(input);
      expect(result.x).toBe(-100);
      expect(result.y).toBe(-50);
    });
  });

  describe('Delayed Decoder', () => {
    it('should have correct metadata', () => {
      expect(delayedDecoder.id).toBe('delayed');
      expect(delayedDecoder.name).toContain('Delayed');
    });

    it('should return current position when no history', () => {
      const fn = createDecoderFn(delayedDecoder.code!);
      const input = createMockInput({
        kinematics: { x: 50, y: 60, vx: 0, vy: 0 },
      });

      const result = fn(input);
      expect(result.x).toBe(50);
      expect(result.y).toBe(60);
    });

    it('should return current position with insufficient history', () => {
      const fn = createDecoderFn(delayedDecoder.code!);
      const input = createMockInput({
        kinematics: { x: 50, y: 60, vx: 0, vy: 0 },
        history: [
          { x: 10, y: 10 },
          { x: 20, y: 20 },
        ],
      });

      const result = fn(input);
      expect(result.x).toBe(50);
      expect(result.y).toBe(60);
    });

    it('should return delayed position with sufficient history', () => {
      const fn = createDecoderFn(delayedDecoder.code!);
      const history = [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 30, y: 30 },
        { x: 40, y: 40 },
        { x: 50, y: 50 },
      ];
      const input = createMockInput({
        kinematics: { x: 60, y: 60, vx: 0, vy: 0 },
        history,
      });

      const result = fn(input);
      // Should return position from 4 packets ago (index 1 from the end - 4 = last - 4)
      expect(result.x).toBe(20);
      expect(result.y).toBe(20);
    });
  });

  describe('Velocity Predictor Decoder', () => {
    it('should have correct metadata', () => {
      expect(velocityPredictorDecoder.id).toBe('velocity-predictor');
      expect(velocityPredictorDecoder.name).toContain('Velocity');
    });

    it('should predict next position using velocity', () => {
      const fn = createDecoderFn(velocityPredictorDecoder.code!);
      const input = createMockInput({
        kinematics: { x: 100, y: 100, vx: 40, vy: 20 },
      });

      const result = fn(input);
      // dt = 0.025 (25ms)
      // predictedX = 100 + 40 * 0.025 = 101
      // predictedY = 100 + 20 * 0.025 = 100.5
      expect(result.x).toBeCloseTo(101);
      expect(result.y).toBeCloseTo(100.5);
    });

    it('should return same position with zero velocity', () => {
      const fn = createDecoderFn(velocityPredictorDecoder.code!);
      const input = createMockInput({
        kinematics: { x: 50, y: 50, vx: 0, vy: 0 },
      });

      const result = fn(input);
      expect(result.x).toBe(50);
      expect(result.y).toBe(50);
    });

    it('should handle negative velocity', () => {
      const fn = createDecoderFn(velocityPredictorDecoder.code!);
      const input = createMockInput({
        kinematics: { x: 100, y: 100, vx: -80, vy: -40 },
      });

      const result = fn(input);
      // predictedX = 100 + (-80) * 0.025 = 98
      // predictedY = 100 + (-40) * 0.025 = 99
      expect(result.x).toBeCloseTo(98);
      expect(result.y).toBeCloseTo(99);
    });

    it('should preserve velocity in output', () => {
      const fn = createDecoderFn(velocityPredictorDecoder.code!);
      const input = createMockInput({
        kinematics: { x: 0, y: 0, vx: 25, vy: -15 },
      });

      const result = fn(input);
      expect(result.vx).toBe(25);
      expect(result.vy).toBe(-15);
    });
  });

  describe('Spike-Based Decoder', () => {
    it('should have correct metadata', () => {
      expect(spikeBasedDecoder.id).toBe('spike-simple');
      expect(spikeBasedDecoder.name).toContain('Spike');
    });

    it('should scale movement based on spike rate', () => {
      const fn = createDecoderFn(spikeBasedDecoder.code!);
      
      // High spike rate
      const highSpikes = new Array(20).fill(10);
      const inputHigh = createMockInput({
        kinematics: { x: 0, y: 0, vx: 100, vy: 100 },
        spikes: highSpikes,
      });

      const resultHigh = fn(inputHigh);
      
      // Low spike rate
      const lowSpikes = new Array(20).fill(1);
      const inputLow = createMockInput({
        kinematics: { x: 0, y: 0, vx: 100, vy: 100 },
        spikes: lowSpikes,
      });

      const resultLow = fn(inputLow);

      // Higher spike rate should result in larger movement
      expect(Math.abs(resultHigh.x!)).toBeGreaterThan(Math.abs(resultLow.x!));
    });

    it('should handle zero spikes', () => {
      const fn = createDecoderFn(spikeBasedDecoder.code!);
      const input = createMockInput({
        kinematics: { x: 50, y: 50, vx: 10, vy: 10 },
        spikes: new Array(20).fill(0),
      });

      const result = fn(input);
      // With zero spikes, scale = 0, so position should remain same
      expect(result.x).toBe(50);
      expect(result.y).toBe(50);
    });

    it('should cap scale at maximum value', () => {
      const fn = createDecoderFn(spikeBasedDecoder.code!);
      
      // Very high spike rate (should be capped at scale = 2)
      const extremeSpikes = new Array(20).fill(100);
      const input = createMockInput({
        kinematics: { x: 0, y: 0, vx: 100, vy: 100 },
        spikes: extremeSpikes,
      });

      const result = fn(input);
      // Scale is capped at 2, dt = 0.025
      // x = 0 + 100 * 2 * 0.025 = 5
      expect(result.x).toBeCloseTo(5);
      expect(result.y).toBeCloseTo(5);
    });

    it('should return scaled velocity', () => {
      const fn = createDecoderFn(spikeBasedDecoder.code!);
      const input = createMockInput({
        kinematics: { x: 0, y: 0, vx: 10, vy: 20 },
        spikes: new Array(20).fill(5), // avg = 5, scale = 0.5
      });

      const result = fn(input);
      expect(result.vx).toBeCloseTo(5);
      expect(result.vy).toBeCloseTo(10);
    });
  });
});

describe('Decoder Type Validation', () => {
  it('all decoders should be type javascript', () => {
    for (const decoder of baselineDecoders) {
      expect(decoder.type).toBe('javascript');
    }
  });

  it('all decoder codes should be valid JavaScript', () => {
    for (const decoder of baselineDecoders) {
      expect(() => {
        new Function('input', decoder.code!);
      }).not.toThrow();
    }
  });

  it('all decoders should return x and y properties', () => {
    const input = createMockInput();
    
    for (const decoder of baselineDecoders) {
      const fn = createDecoderFn(decoder.code!);
      const result = fn(input);
      
      expect(typeof result.x).toBe('number');
      expect(typeof result.y).toBe('number');
      expect(isNaN(result.x)).toBe(false);
      expect(isNaN(result.y)).toBe(false);
    }
  });
});

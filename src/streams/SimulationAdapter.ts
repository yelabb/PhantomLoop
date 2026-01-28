/**
 * Simulation Stream Adapter
 * 
 * Generates synthetic neural data for testing and demos.
 * Supports configurable channel count, sample rate, and signal patterns.
 */

import type {
  StreamSource,
  StreamConfig,
  StreamSample,
  StreamConnectionState,
  GroundTruth,
  ChannelQuality,
} from '../types/stream';

export type SimulationPattern = 
  | 'eeg-alpha'      // 8-12 Hz alpha oscillations
  | 'eeg-mixed'      // Alpha + beta + noise
  | 'spike-poisson'  // Poisson spike counts
  | 'cursor-task'    // Center-out reaching task simulation
  | 'noise';         // Random noise only

export interface SimulationAdapterOptions {
  channelCount?: number;
  samplingRate?: number;
  pattern?: SimulationPattern;
  noiseLevel?: number; // 0-1
  signalAmplitude?: number; // µV for EEG, spikes/bin for spike data
}

export class SimulationAdapter implements StreamSource {
  readonly config: StreamConfig;

  private _state: StreamConnectionState = 'disconnected';
  private _lastError: string | null = null;
  private sampleCallbacks: ((sample: StreamSample, groundTruth?: GroundTruth) => void)[] = [];
  private stateCallbacks: ((state: StreamConnectionState) => void)[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private sampleCount: number = 0;
  
  // Simulation parameters
  private readonly pattern: SimulationPattern;
  private readonly noiseLevel: number;
  private readonly signalAmplitude: number;
  
  // Cursor task state
  private cursorX: number = 0;
  private cursorY: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;
  private targetId: number = 0;
  private trialId: number = 0;

  constructor(options?: SimulationAdapterOptions) {
    const channelCount = options?.channelCount ?? 8;
    const samplingRate = options?.samplingRate ?? 250;
    this.pattern = options?.pattern ?? 'eeg-alpha';
    this.noiseLevel = options?.noiseLevel ?? 0.3;
    this.signalAmplitude = options?.signalAmplitude ?? 50;

    const isSpike = this.pattern === 'spike-poisson' || this.pattern === 'cursor-task';

    this.config = {
      id: 'simulation',
      name: `Simulated ${channelCount}ch @ ${samplingRate}Hz`,
      channelCount,
      samplingRate,
      dataType: isSpike ? 'binned' : 'continuous',
      unit: isSpike ? 'spikes' : 'µV',
      hasGroundTruth: this.pattern === 'cursor-task',
      sourceInfo: {
        deviceType: 'simulation',
        pattern: this.pattern,
        noiseLevel: this.noiseLevel,
      },
    };
  }

  get state(): StreamConnectionState {
    return this._state;
  }

  get lastError(): string | null {
    return this._lastError;
  }

  private setState(state: StreamConnectionState, error?: string) {
    this._state = state;
    this._lastError = error ?? null;
    this.stateCallbacks.forEach(cb => cb(state));
  }

  async connect(): Promise<void> {
    if (this.intervalId) {
      this.disconnect();
    }

    this.setState('connecting');
    this.startTime = performance.now();
    this.sampleCount = 0;
    this.resetCursorTask();

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const intervalMs = 1000 / this.config.samplingRate;

    this.intervalId = setInterval(() => {
      const sample = this.generateSample();
      const groundTruth = this.pattern === 'cursor-task' ? this.generateGroundTruth() : undefined;
      
      this.sampleCallbacks.forEach(cb => cb(sample, groundTruth));
      this.sampleCount++;
    }, intervalMs);

    this.setState('connected');
    console.log(`[SimulationAdapter] Started: ${this.config.name}`);
  }

  disconnect(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.setState('disconnected');
    console.log('[SimulationAdapter] Stopped');
  }

  onSample(callback: (sample: StreamSample, groundTruth?: GroundTruth) => void): () => void {
    this.sampleCallbacks.push(callback);
    return () => {
      const index = this.sampleCallbacks.indexOf(callback);
      if (index > -1) {
        this.sampleCallbacks.splice(index, 1);
      }
    };
  }

  onStateChange(callback: (state: StreamConnectionState) => void): () => void {
    this.stateCallbacks.push(callback);
    return () => {
      const index = this.stateCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateCallbacks.splice(index, 1);
      }
    };
  }

  private generateSample(): StreamSample {
    const timestamp = performance.now() - this.startTime;
    const channels = this.generateChannels(timestamp);
    const quality = this.generateQuality();

    return {
      timestamp,
      channels,
      metadata: {
        unit: this.config.unit,
        quality,
        sequenceNumber: this.sampleCount,
      },
    };
  }

  private generateChannels(timestamp: number): number[] {
    const t = timestamp / 1000; // Convert to seconds
    const channels: number[] = [];

    for (let ch = 0; ch < this.config.channelCount; ch++) {
      let value: number;

      switch (this.pattern) {
        case 'eeg-alpha':
          value = this.generateAlpha(t, ch);
          break;
        case 'eeg-mixed':
          value = this.generateMixedEEG(t, ch);
          break;
        case 'spike-poisson':
          value = this.generatePoissonSpikes(ch);
          break;
        case 'cursor-task':
          value = this.generateTaskSpikes(ch);
          break;
        case 'noise':
        default:
          value = this.generateNoise();
      }

      channels.push(value);
    }

    return channels;
  }

  private generateAlpha(t: number, channel: number): number {
    // 10 Hz alpha with slight channel variation
    const freq = 10 + (channel * 0.2);
    const alpha = Math.sin(2 * Math.PI * freq * t) * this.signalAmplitude;
    const noise = this.gaussianNoise() * this.signalAmplitude * this.noiseLevel;
    return alpha + noise;
  }

  private generateMixedEEG(t: number, channel: number): number {
    // Alpha (8-12 Hz) + Beta (13-30 Hz) + noise
    const alphaFreq = 10 + (channel * 0.3);
    const betaFreq = 20 + (channel * 0.5);
    
    const alpha = Math.sin(2 * Math.PI * alphaFreq * t) * this.signalAmplitude * 0.6;
    const beta = Math.sin(2 * Math.PI * betaFreq * t) * this.signalAmplitude * 0.3;
    const noise = this.gaussianNoise() * this.signalAmplitude * this.noiseLevel;
    
    return alpha + beta + noise;
  }

  private generatePoissonSpikes(_channel: number): number {
    // Poisson-distributed spike counts (channel unused - uniform distribution)
    void _channel; // Explicitly acknowledge unused parameter
    const lambda = this.signalAmplitude * (0.5 + Math.random() * 0.5);
    return this.poissonRandom(lambda);
  }

  private generateTaskSpikes(channel: number): number {
    // Spike counts modulated by cursor velocity
    const vx = (this.targetX - this.cursorX) * 0.1;
    const vy = (this.targetY - this.cursorY) * 0.1;
    const speed = Math.sqrt(vx * vx + vy * vy);
    
    // Different channels encode different velocity components
    let modulation: number;
    if (channel % 4 === 0) {
      modulation = vx; // X velocity
    } else if (channel % 4 === 1) {
      modulation = vy; // Y velocity
    } else if (channel % 4 === 2) {
      modulation = -vx; // -X velocity
    } else {
      modulation = speed; // Speed
    }
    
    const lambda = Math.max(0.5, this.signalAmplitude * (1 + modulation / 100));
    return this.poissonRandom(lambda);
  }

  private generateNoise(): number {
    return this.gaussianNoise() * this.signalAmplitude;
  }

  private gaussianNoise(): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  private poissonRandom(lambda: number): number {
    // Knuth algorithm for Poisson random variable
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;

    do {
      k++;
      p *= Math.random();
    } while (p > L);

    return k - 1;
  }

  private generateQuality(): ChannelQuality[] {
    // Simulate realistic quality distribution
    return Array.from({ length: this.config.channelCount }, () => {
      const rand = Math.random();
      if (rand < 0.7) return 'good';
      if (rand < 0.9) return 'fair';
      if (rand < 0.98) return 'poor';
      return 'disconnected';
    });
  }

  private generateGroundTruth(): GroundTruth {
    // Update cursor position (simple pursuit dynamics)
    const dx = this.targetX - this.cursorX;
    const dy = this.targetY - this.cursorY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 5) {
      // Reached target, pick new one
      this.pickNewTarget();
    }

    // Move cursor toward target
    const speed = 2;
    const vx = distance > 0 ? (dx / distance) * speed : 0;
    const vy = distance > 0 ? (dy / distance) * speed : 0;

    this.cursorX += vx;
    this.cursorY += vy;

    return {
      position: { x: this.cursorX, y: this.cursorY },
      velocity: { x: vx, y: vy },
      target: {
        id: this.targetId,
        x: this.targetX,
        y: this.targetY,
        active: true,
      },
      trial: {
        id: this.trialId,
        timeMs: this.sampleCount * (1000 / this.config.samplingRate),
      },
    };
  }

  private resetCursorTask(): void {
    this.cursorX = 0;
    this.cursorY = 0;
    this.trialId = 0;
    this.pickNewTarget();
  }

  private pickNewTarget(): void {
    // 8-target center-out arrangement
    this.targetId = Math.floor(Math.random() * 8);
    const angle = (this.targetId / 8) * 2 * Math.PI;
    const radius = 80;
    this.targetX = Math.cos(angle) * radius;
    this.targetY = Math.sin(angle) * radius;
    this.trialId++;
  }
}

/**
 * Factory function for adapter registry
 */
export function createSimulationAdapter(options?: SimulationAdapterOptions): StreamSource {
  return new SimulationAdapter(options);
}

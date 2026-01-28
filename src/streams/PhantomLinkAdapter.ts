/**
 * PhantomLink Stream Adapter
 * 
 * Wraps the existing WebSocket/MessagePack connection to conform to
 * the stream-agnostic StreamSource interface.
 */

import msgpack from 'msgpack-lite';
import type {
  StreamSource,
  StreamConfig,
  StreamSample,
  StreamConnectionState,
  GroundTruth,
} from '../types/stream';
import type { StreamPacket, MetadataMessage } from '../types/packets';

export class PhantomLinkAdapter implements StreamSource {
  readonly config: StreamConfig = {
    id: 'phantomlink',
    name: 'PhantomLink MC_Maze',
    channelCount: 142,
    samplingRate: 40,
    dataType: 'binned',
    unit: 'spikes',
    hasGroundTruth: true,
    sourceInfo: {
      deviceType: 'phantomlink',
      protocol: 'websocket-msgpack',
    },
  };

  private _state: StreamConnectionState = 'disconnected';
  private _lastError: string | null = null;
  private ws: WebSocket | null = null;
  private sampleCallbacks: ((sample: StreamSample, groundTruth?: GroundTruth) => void)[] = [];
  private stateCallbacks: ((state: StreamConnectionState) => void)[] = [];
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private url: string = '';

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

  async connect(url?: string): Promise<void> {
    if (this.ws) {
      this.disconnect();
    }

    this.url = url ?? 'wss://phantomlink.fly.dev';
    this.setState('connecting');

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          console.log('[PhantomLinkAdapter] Connected to', this.url);
          this.setState('connected');
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(event);
        };

        this.ws.onerror = (event) => {
          console.error('[PhantomLinkAdapter] WebSocket error:', event);
          this.setState('error', 'WebSocket error');
          reject(new Error('WebSocket error'));
        };

        this.ws.onclose = (event) => {
          console.log('[PhantomLinkAdapter] Connection closed:', event.code);
          if (this._state !== 'disconnected') {
            this.setState('reconnecting');
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        this.setState('error', error instanceof Error ? error.message : 'Connection failed');
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
    console.log('[PhantomLinkAdapter] Disconnected');
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

  private handleMessage(event: MessageEvent): void {
    try {
      const decoded = msgpack.decode(new Uint8Array(event.data));

      if (decoded.type === 'data') {
        const packet = decoded as StreamPacket;
        
        // Convert to StreamSample
        const sample: StreamSample = {
          timestamp: packet.data.timestamp * 1000, // Convert to ms
          channels: packet.data.spikes.spike_counts,
          metadata: {
            unit: 'spikes',
            sequenceNumber: packet.data.sequence_number,
          },
        };

        // Extract ground truth
        const groundTruth: GroundTruth = {
          position: {
            x: packet.data.kinematics.x,
            y: packet.data.kinematics.y,
          },
          velocity: {
            x: packet.data.kinematics.vx,
            y: packet.data.kinematics.vy,
          },
          target: {
            id: packet.data.intention.target_id,
            x: packet.data.intention.target_x,
            y: packet.data.intention.target_y,
            active: true,
          },
          trial: {
            id: packet.data.trial_id,
            timeMs: packet.data.trial_time_ms,
          },
        };

        // Notify all subscribers
        this.sampleCallbacks.forEach(cb => cb(sample, groundTruth));

      } else if (decoded.type === 'metadata') {
        const metadata = decoded as MetadataMessage;
        console.log('[PhantomLinkAdapter] Metadata:', metadata.data);
        
        // Update config with actual channel count if different
        if (metadata.data.channel_count !== this.config.channelCount) {
          console.log(`[PhantomLinkAdapter] Updating channel count: ${metadata.data.channel_count}`);
          (this.config as { channelCount: number }).channelCount = metadata.data.channel_count;
        }
      }
    } catch (error) {
      console.error('[PhantomLinkAdapter] Message decode error:', error);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (this._state === 'reconnecting') {
        console.log('[PhantomLinkAdapter] Attempting reconnect...');
        this.connect(this.url).catch(() => {
          // Will trigger another reconnect via onclose
        });
      }
    }, 3000);
  }
}

/**
 * Factory function for adapter registry
 */
export function createPhantomLinkAdapter(): StreamSource {
  return new PhantomLinkAdapter();
}

// PhantomLink data packet types based on the MessagePack binary stream

export interface SpikeData {
  channel_ids: number[];
  spike_counts: number[];
  bin_size_ms: number;
}

export interface Kinematics {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Intention {
  target_id: number;
  target_x: number;
  target_y: number;
  distance_to_target: number;
}

export interface StreamPacket {
  type: 'data';
  data: {
    timestamp: number;
    sequence_number: number;
    spikes: SpikeData;
    kinematics: Kinematics;
    intention: Intention;
    trial_id: number;
    trial_time_ms: number;
  };
}

export interface MetadataMessage {
  type: 'metadata';
  data: {
    total_samples: number;
    channel_count: number;
    sampling_rate_hz: number;
    bin_size_ms: number;
    duration_seconds: number;
    trial_count: number;
  };
}

export type WebSocketMessage = StreamPacket | MetadataMessage;

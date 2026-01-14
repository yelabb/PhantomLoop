// PhantomLoop Constants

// Color constants for the Trinity visualization
export const COLORS = {
  PHANTOM: '#FFD700',    // Yellow - The Intention
  BIOLINK: '#00FF00',    // Green - Ground Truth
  LOOPBACK: '#0080FF',   // Blue - Decoder Output
  TARGET: '#FF00FF',     // Magenta - Target marker
  GRID: '#404040',       // Dark gray - Grid floor
  BACKGROUND: '#0a0a0a', // Near black
} as const;

// PhantomLink server configuration - ONE SOURCE OF TRUTH
export const SERVER_CONFIG = {
  BASE_URL: 'wss://phantomlink.fly.dev',
} as const;

// Stream configuration
export const STREAM_CONFIG = {
  PACKET_RATE_HZ: 40,
  PACKET_INTERVAL_MS: 25,
  BUFFER_SIZE: 40, // 1 second of data at 40Hz
  RECONNECT_DELAY_MS: 3000,
  MAX_RECONNECT_ATTEMPTS: 5,
} as const;

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  TARGET_FPS: 60,
  MAX_NETWORK_LATENCY_MS: 25,
  MAX_DECODER_LATENCY_MS: 25,
  MAX_TOTAL_LATENCY_MS: 50,
  DESYNC_THRESHOLD_MS: 50,
  DECODER_TIMEOUT_MS: 10,
  JITTER_TOLERANCE_MS: 3,
} as const;

// Visualization settings
export const VISUALIZATION = {
  PHANTOM_SIZE: 0.8,
  BIOLINK_SIZE: 1.0,
  LOOPBACK_SIZE: 0.9,
  TARGET_RADIUS: 2.0,
  TRAIL_LENGTH: 40,
  GRID_SIZE: 200,
  GRID_DIVISIONS: 20,
  COORDINATE_SCALE: 100, // Scale factor for normalization
} as const;

// Dataset metadata (MC_Maze)
export const DATASET = {
  CHANNEL_COUNT: 142,
  SAMPLING_RATE_HZ: 40,
  BIN_SIZE_MS: 25,
  DURATION_SECONDS: 294,
  TRIAL_COUNT: 100,
} as const;

// Camera presets
export const CAMERA_PRESETS = {
  top: {
    position: [0, 100, 0] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  },
  perspective: {
    position: [50, 50, 50] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  },
  side: {
    position: [100, 20, 0] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  },
} as const;

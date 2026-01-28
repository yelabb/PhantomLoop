> **🚧 Work In Progress: Active Engineering Sprint**
>
> This project is currently under active development. Core features are functional but APIs and data structures are subject to rapid iteration. Not yet ready for stable deployment.



<img width="300" alt="logo" src="https://github.com/user-attachments/assets/87525c02-0301-4421-850f-06f96584b9df" />

# PHANTOM LOOP

**Real-Time BCI Decoder Visualization Platform**

[![PhantomLink Core](https://img.shields.io/badge/Powered_by-PhantomLink_Core-009688.svg)](https://github.com/yelabb/PhantomLink)
[![React 19](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

---

## 🔗 Part of the Phantom Stack

PhantomLoop is one component of the **Phantom Stack**, an integrated ecosystem for real-time brain-computer interface (BCI) research and development:

| Repository | Description | Language |
|------------|-------------|----------|
| **[PhantomX](https://github.com/yelabb/PhantomX)** | Experimental ML research platform for neural decoding algorithms and model development | Python |
| **[PhantomCore](https://github.com/yelabb/PhantomCore)** | High-performance C++ signal processing library for neural decoding (Kalman filters, spike detection, SIMD optimizations) | C++ |
| **[PhantomZip](https://github.com/yelabb/PhantomZip)** | Ultra-low latency neural data compression codec optimized for embedded systems and real-time streaming | Rust |
| **[PhantomLink](https://github.com/yelabb/PhantomLink)** | Python backend server for neural data streaming, dataset management, and WebSocket communication | Python |
| **[PhantomLoop](https://github.com/yelabb/PhantomLoop)** ← *You are here* | Real-time web-based visualization dashboard for BCI decoder testing and validation | TypeScript/React |


---

> A research-grade dashboard for visualizing and validating BCI decoder performance in real-time.

## 📡 Cerelog ESP-EEG Integration (Experimental)

This branch adds support for the **Cerelog ESP-EEG** device - a low-cost 8-channel EEG system based on the ADS1299 chip.

### Hardware Specs
| Spec | Value |
|------|-------|
| Chip | Texas Instruments ADS1299 (24-bit ADC) |
| Channels | 8 EEG channels |
| Sample Rate | 250 SPS |
| WiFi AP | SSID: `CERELOG_EEG` / Password: `cerelog123` |
| Device IP | `192.168.4.1` |
| Protocol | TCP on port 1112 (binary packets) |

### Quick Start (ESP-EEG)

```bash
# 1. Connect to ESP-EEG WiFi network
#    SSID: CERELOG_EEG, Password: cerelog123

# 2. Run the WebSocket bridge (browsers can't connect to TCP directly)
pip install websockets
python scripts/cerelog_ws_bridge.py

# 3. In PhantomLoop, connect to ws://localhost:8765
```

### Features
- **Electrode Placement Screen** - Interactive 10-20 montage configuration
- **Signal Quality Monitoring** - Real-time quality estimation (no impedance on ADS1299)
- **Spatial Feature Extraction** - ROI averages, spatial gradients, neighborhood correlations
- **Brainflow Export** - JSON/CSV/Python code generation for Brainflow integration
- **Demo Mode** - Test without hardware using realistic simulated EEG

See [CERELOG_INTEGRATION.md](CERELOG_INTEGRATION.md) for full documentation.

---

## 🔌 Stream-Agnostic Architecture

PhantomLoop now supports **any multichannel time-series source** through a unified adapter pattern. This allows seamless switching between neural data sources:

### Supported Stream Sources

| Source | Channels | Sample Rate | Description |
|--------|----------|-------------|-------------|
| **PhantomLink MC_Maze** | 142 | 40 Hz | Spike counts from primate motor cortex |
| **Cerelog ESP-EEG** | 8 | 250 Hz | EEG via ADS1299 (requires WebSocket bridge) |
| **Simulated EEG** | 8 | 250 Hz | Synthetic alpha/beta oscillations |
| **Simulated Spikes** | 142 | 40 Hz | Synthetic cursor-task data with ground truth |

### Adding Custom Stream Sources

Implement the `StreamSource` interface to add your own data source:

```typescript
import type { StreamSource, StreamConfig, StreamSample } from './types/stream';

class MyCustomAdapter implements StreamSource {
  readonly id = 'my-source';
  readonly name = 'My Custom Source';
  
  async connect(url: string, config?: StreamConfig): Promise<void> {
    // Connect to your data source
  }
  
  disconnect(): void {
    // Clean up connection
  }
  
  onSample(callback: (sample: StreamSample) => void): () => void {
    // Subscribe to incoming samples, return unsubscribe function
  }
}
```

### Dynamic Decoder Models

The decoder factory creates TensorFlow.js models with **dynamic input shapes** based on the active stream's channel count:

```typescript
import { createDynamicLinearDecoder, createDynamicMLPDecoder } from './decoders/dynamicModels';

// Works with any channel count!
const decoder8ch = createDynamicLinearDecoder(8);   // For EEG
const decoder142ch = createDynamicMLPDecoder(142);  // For spikes
```

---

PhantomLoop streams neural data from PhantomLink (MC_Maze dataset, 142 channels @ 40Hz) and visualizes **ground truth cursor movements** alongside **your decoder's predictions**. Built for BCI researchers who need to rapidly prototype, test, and compare decoding algorithms.

<img width="2524" height="1924" alt="image" src="https://github.com/user-attachments/assets/b07558b9-381d-457e-941c-0be0ad97a398" />

---

## 🏗 Architecture

PhantomLoop is a single-page React application with modular state management:

### Core Components
1. **Stream Adapters** - Unified interface for any multichannel data source
2. **WebSocket Client** - Binary MessagePack protocol (40Hz streaming)
3. **State Management** - Zustand with 5 specialized slices
4. **Decoder Engine** - Supports JavaScript and TensorFlow.js models (dynamic input shapes)
5. **Visualization Suite** - 2D arena, neural activity, performance metrics

### State Slices (Zustand)
- **connectionSlice**: WebSocket lifecycle, session management
- **streamSlice**: Packet buffering with throttled updates (20Hz UI refresh)
- **decoderSlice**: Decoder registry, execution, loading states
- **metricsSlice**: Accuracy tracking, latency monitoring, error statistics
- **unifiedStreamSlice**: Stream source selection, adapter state, N-channel buffer

### Data Flow
1. **Stream Adapter** connects to data source (PhantomLink, ESP-EEG, or Simulation)
2. Adapter normalizes data into `StreamSample` format
3. `useStream` hook buffers samples and updates store
4. `useDecoder` hook executes active decoder (JS or TFJS with dynamic input shape)
5. Store updates with **ground truth** + **decoder output**
6. Components render synchronized visualizations

### Stream Adapter Pattern
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  PhantomLink    │     │   ESP-EEG       │     │  Simulation     │
│  (142ch/40Hz)   │     │   (8ch/250Hz)   │     │  (configurable) │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    StreamSource API     │
                    │  connect() / onSample() │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Unified Stream Store  │
                    │   (unifiedStreamSlice)  │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Dynamic Decoders      │
                    │   (any channel count)   │
                    └─────────────────────────┘
```

### Decoder Execution
- **JavaScript**: Direct execution in main thread (<1ms)
- **TensorFlow.js**: Web Worker execution (5-10ms)
- **Dynamic Models**: Input shape adapts to stream channel count
- **Timeout protection**: 10ms limit per inference
- **Error handling**: Falls back to passthrough on failure

---

## 🎯 What You See

The dashboard provides **4 synchronized visualization panels**:

### 1. Center-Out Arena (2D Top-Down)
Real-time cursor tracking in a center-out reaching task (8 targets):
- **🟢 Ground Truth Cursor** (Green): Actual cursor position from dataset kinematics
- **🔵 Decoder Output** (Blue): Your algorithm's predicted position  
- **🟣 Active Target** (Purple): Current reach target with hit detection
- **Error line**: Dashed line showing instantaneous error magnitude
- **Error bar**: Color-coded from green (accurate) to red (poor)

### 2. Accuracy Gauge
Circular gauge showing real-time decoder accuracy (0-100%). Updates every frame.

### 3. Neural Activity Panels
- **Neural Waterfall**: Scrolling heatmap of all 142 channels over time
- **Neuron Activity Grid**: Individual channel firing patterns with channel numbers

### 4. Quick Stats
Real-time metrics:
- Mean error (in coordinate units)
- Samples processed
- Sample exclusion ratio (filters out initialization frames)

**Goal:** Achieve >90% accuracy with <15mm mean error between ground truth and decoder output.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🚀 Deployment

### Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yelabb/PhantomLoop)

1. Fork this repository
2. Connect to Vercel: `vercel --prod`
3. Or use the button above for one-click deploy

### Deploy to Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/yelabb/PhantomLoop)

1. Push to GitHub
2. Connect to Netlify
3. Build command: `npm run build`
4. Publish directory: `dist`

### Deploy to Cloudflare Pages

```bash
npm run build
npx wrangler pages deploy dist
```

## 🏗 Tech Stack

- **React 19** + TypeScript + Vite 7
- **Framer Motion** for smooth animations and drag-drop
- **Zustand** state management with slice pattern
- **Tailwind CSS** for styling
- **TensorFlow.js** (WebGPU/WebGL backends)
- **Monaco Editor** (VS Code editor for custom decoders)
- **MessagePack** binary protocol
- **Web Workers** for decoder execution

## ⚡ Real-Time Performance

- **40Hz data streaming** from PhantomLink backend
- **60 FPS rendering** with optimized React rendering
- **<50ms latency budget** (network + decoder + render)
- **Desync detection** when latency exceeds threshold
- **Web Worker decoders** for non-blocking computation
- **Draggable/resizable panels** with localStorage persistence

## 🎮 Usage

### 1. Connect to PhantomLink

Production: `wss://phantomlink.fly.dev`  
Local: `ws://localhost:8000`

### 2. Create a Session

Click **"New Session"** or use API:

```bash
curl -X POST https://phantomlink.fly.dev/api/sessions/create
```

### 3. Select a Decoder

Choose from built-in decoders:

**JavaScript Baselines:**
- **Passthrough**: Perfect tracking baseline (copies ground truth)
- **Delayed**: 100ms lag test for desync detection
- **Velocity Predictor**: Linear prediction using velocity
- **Spike-Based Simple**: Naive spike-rate modulated decoder

**TensorFlow.js Models:**
- **Linear (OLE)**: Optimal Linear Estimator (142→2)
- **MLP**: Multi-layer perceptron (142→128→64→2)
- **LSTM**: Temporal decoder with 10-step history
- **BiGRU Attention**: Bidirectional GRU with max pooling
- **Kalman-Neural Hybrid**: MLP + Kalman fusion (α=0.6)

### 4. Monitor Performance

Watch the dashboard panels:
- **Accuracy Gauge**: Current decoder accuracy (0-100%)
- **Center-Out Arena**: Live cursor tracking with error visualization
- **Quick Stats**: Mean error, samples processed, exclusion ratio
- **Neural Waterfall**: Real-time spike activity (142 channels)
- **Neuron Activity Grid**: Individual channel firing patterns
- **Connection Status**: Latency, FPS, desync alerts

## 🛠 Configuration

### Environment Variables

Create `.env.local`:

```bash
VITE_PHANTOMLINK_URL=wss://phantomlink.fly.dev
```

### Constants

Edit [src/utils/constants.ts](src/utils/constants.ts):

```typescript
// Color scheme (legacy PHANTOM color unused)
export const COLORS = {
  BIOLINK: '#00FF00',    // Green - Ground Truth
  LOOPBACK: '#0080FF',   // Blue - Decoder Output
  TARGET: '#FF00FF',     // Magenta - Active Target
};

// Performance monitoring
export const PERFORMANCE_THRESHOLDS = {
  TARGET_FPS: 60,
  MAX_TOTAL_LATENCY_MS: 50,
  DESYNC_THRESHOLD_MS: 50,
  DECODER_TIMEOUT_MS: 10,
};

// Dataset information
export const DATASET = {
  CHANNEL_COUNT: 142,
  SAMPLING_RATE_HZ: 40,
  BIN_SIZE_MS: 25,
  DURATION_SECONDS: 294,
  TRIAL_COUNT: 100,
};
```

## 📁 Project Structure

```
src/
├── components/           # React components
│   ├── visualization/   # Arena, gauges, charts
│   ├── SessionManager.tsx
│   ├── DecoderSelector.tsx
│   ├── MetricsPanel.tsx
│   └── CodeEditor.tsx   # Monaco editor
├── hooks/               # Custom React hooks
│   ├── useMessagePack.ts
│   ├── useDecoder.ts
│   ├── useWebSocket.ts
│   ├── useESPEEG.ts     # Cerelog ESP-EEG device hook
│   └── usePerformance.ts
├── store/               # Zustand state slices
│   ├── connectionSlice.ts
│   ├── streamSlice.ts
│   ├── decoderSlice.ts
│   └── metricsSlice.ts
├── decoders/            # BCI decoder implementations
│   ├── baselines.ts     # JS decoders
│   ├── tfjsDecoders.ts  # TFJS model definitions
│   ├── tfjsModels.ts    # Model architectures
│   └── executeDecoder.ts
├── types/               # TypeScript definitions
│   ├── electrodes.ts    # Electrode configuration types
│   └── ...
├── utils/               # Constants, helpers
│   ├── spatialFeatures.ts # Spatial feature extraction
│   ├── brainflowExport.ts # Brainflow export utilities
│   └── ...
scripts/
└── cerelog_ws_bridge.py # WebSocket-TCP bridge for ESP-EEG
```

## 🧠 Adding Custom Decoders

### JavaScript Decoder

Add to [src/decoders/baselines.ts](src/decoders/baselines.ts):

```typescript
export const myDecoder: Decoder = {
  id: 'my-decoder',
  name: 'My Custom Decoder',
  type: 'javascript',
  description: 'Custom decoder description',
  code: `
    // Available inputs:
    // - input.kinematics: { x, y, vx, vy }
    // - input.spikes: number[] (142 channels)
    // - input.intention: { target_id, target_x, target_y }
    // - input.timestamp: number
    
    const { x, y, vx, vy } = input.kinematics;
    const spikes = input.spikes;
    
    // Your algorithm here
    const predictedX = x + vx * 0.025;
    const predictedY = y + vy * 0.025;
    
    // Must return { x, y } at minimum
    return { x: predictedX, y: predictedY, vx, vy };
  `
};

// Then add to index.ts:
import { myDecoder } from './baselines';
export const allDecoders = [...baselineDecoders, myDecoder, ...tfjsDecoders];
```

### TensorFlow.js Decoder

PhantomLoop generates TFJS models **programmatically** (no file uploads needed):

Add to [src/decoders/tfjsDecoders.ts](src/decoders/tfjsDecoders.ts):

```typescript
export const myTfjsDecoder: Decoder = {
  id: 'tfjs-custom',
  name: 'Custom TFJS Model',
  type: 'tfjs',
  tfjsModelType: 'mlp', // or 'linear', 'lstm', 'attention', etc.
  description: 'My custom neural decoder',
  architecture: 'Dense(142 → 64 → 2)',
  params: 9218,
};
```

Model architecture is defined in [src/decoders/tfjsModels.ts](src/decoders/tfjsModels.ts).
Models are trained in-browser with random weights (for demonstration).

For production decoders, export pre-trained models:
```bash
tensorflowjs_converter --input_format=keras model.h5 public/models/my-model/
```

Then modify `tfjsInference.ts` to load external models.

## 🔧 Development

### Key Files

- [src/App.tsx](src/App.tsx) - Main application
- [src/components/ResearchDashboard.tsx](src/components/ResearchDashboard.tsx) - Dashboard layout
- [src/components/visualization/CenterOutArena.tsx](src/components/visualization/CenterOutArena.tsx) - 2D visualization
- [src/store/index.ts](src/store/index.ts) - Zustand store (slice pattern)
- [src/hooks/useMessagePack.ts](src/hooks/useMessagePack.ts) - Binary protocol
- [src/hooks/useDecoder.ts](src/hooks/useDecoder.ts) - Decoder execution
- [src/decoders/index.ts](src/decoders/index.ts) - Decoder registry
- [src/utils/constants.ts](src/utils/constants.ts) - Configuration

### State Management

```typescript
// Access store anywhere
const { 
  currentPacket,
  activeDecoder,
  decoderOutput,
  isConnected 
} = useStore();
```

## ⚙️ Performance Optimization

### TensorFlow.js Backend Selection

PhantomLoop auto-detects the best available backend:
1. **WebGPU** (fastest, Chrome/Edge only)
2. **WebGL** (good, widely supported)
3. **CPU** (fallback)

Check console on startup:
```
[PhantomLoop] TensorFlow.js initialized with WebGPU backend
```

### Latency Budget Breakdown

Total latency = Network + Decoder + Render (Target: <50ms)

- **Network**: 10-30ms (depends on connection to PhantomLink)
- **Decoder**: <10ms (JavaScript: <1ms, TFJS: 5-10ms)  
- **Render**: ~16ms (60 FPS)

Exceeding 50ms triggers desync alert.

### UI Optimization

- Packets arrive at 40Hz, UI updates throttled to 20Hz
- Prevents React re-render thrashing
- Decoders execute on every packet
- Panels use `localStorage` for position persistence

## 🐛 Troubleshooting

### "Cannot connect to server"

- ✓ PhantomLink backend running at wss://phantomlink.fly.dev
- ✓ Valid session code created via `/api/sessions/create`
- ✓ Network/firewall allows WebSocket connections
- Check browser console for connection errors

### High Latency

- Use production server (wss://phantomlink.fly.dev) for lower RTT
- Simplify decoder logic to reduce computation time
- Check browser performance (60 FPS target)
- Close other tabs/applications

### Decoder Not Loading

- Check browser console for errors
- Verify TensorFlow.js backend initialized (WebGPU/WebGL)
- For TFJS models, wait for initialization (can take 5-10s)
- Check Web Worker errors in DevTools

### Low Accuracy

- Passthrough decoder should achieve ~100% accuracy
- Custom decoders may need proper normalization
- Check coordinate ranges (-100 to 100)
- Exclude samples where ground truth is (0, 0)

### Desync Detected

- Normal when total latency exceeds 50ms
- Can occur during:
  - Network congestion
  - Heavy decoder computation
  - Browser performance issues
  - TFJS model initialization

## 📚 Resources

### Documentation
- [PhantomLink Backend](https://github.com/yelabb/PhantomLink) - Neural data streaming server
- [Cerelog ESP-EEG Integration](CERELOG_INTEGRATION.md) - ESP-EEG device setup and protocol
- [Code Editor Guide](docs/CODE_EDITOR.md) - Monaco editor usage
- [PhantomLink Beginner's Guide](../PhantomLink/docs/BEGINNERS_GUIDE.md) - BCI introduction

### Datasets & Tools
- [Neural Latents Benchmark](https://neurallatents.github.io/) - MC_Maze dataset
- [DANDI Archive #000140](https://dandiarchive.org/dandiset/000140) - Dataset download

### Technologies
- [React Documentation](https://react.dev/) - React 19
- [TensorFlow.js](https://www.tensorflow.org/js) - ML framework
- [Zustand](https://zustand-demo.pmnd.rs/) - State management
- [Framer Motion](https://www.framer.com/motion/) - Animations
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor

## 📄 License

MIT License

---

## 🙏 Acknowledgments

This project was developed with assistance from AI coding assistants and workflows:
- Claude Opus 4.5 (Anthropic)
- Claude Sonnet 4.5 (Anthropic)
- Grok code fast 1 (xAi)
- Gemini 3.0 Pro (Google)


All code was tested and validated by the author.

---

**Built for the BCI research community** 🧠⚡

*"Visualize. Decode. Validate. Iterate."*






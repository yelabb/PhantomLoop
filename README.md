<img width="300" alt="logo" src="https://github.com/user-attachments/assets/87525c02-0301-4421-850f-06f96584b9df" />


# PHANTOM LOOP

**The Neural Gauntlet: Closed-Loop Validation Infrastructure**

[![PhantomLink Core](https://img.shields.io/badge/Powered_by-PhantomLink_Core-009688.svg)](https://github.com/yelabb/PhantomLink)
[![WebGL](https://img.shields.io/badge/WebGL-R3F-black.svg)](https://docs.pmnd.rs/react-three-fiber)

> Phantom Loop is not just a visualizer. It is a **hostile environment** for BCI decoders.

It replays high-fidelity neural recordings (MC_Maze dataset) to simulate a live cortex, injecting network latency, signal drift, and noise. Your goal: **connect your decoder, close the loop, and maintain synchronization with the intention signal.**

<img width="2524" height="1924" alt="image" src="https://github.com/user-attachments/assets/b07558b9-381d-457e-941c-0be0ad97a398" />



---

## 🏗 Architecture

Phantom Loop consists of two decoupled components:

### 1. PhantomLink Core (The Engine)
Python/FastAPI backend handling 40Hz streaming, session isolation, and drift simulation.

### 2. The Arena (The Dashboard)
WebGL/R3F frontend visualizing the **"Trinity"** of neural control.

---

## 🎯 The Visualization

The dashboard renders two distinct cursors to visualize the **Cognitive Manifold** in real-time:

| Cursor | Color | Description |
|--------|-------|-------------|
| **🟡 The Phantom (Intention)** | Yellow | The target state. The pure intent extracted from the dataset. |
| **🟢 The Bio-Link (Ground Truth)** | Green | The actual biological arm movement recorded during the session. The **Gold Standard**. |
| **🔵 The Loop-Back (Decoder)** | Blue | Your algorithm's prediction, streamed back to the server. |

**The Goal:** Collapse the triangle. **Minimize the area between Phantom, Bio, and Loop.**

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

## 🏗 Tech Stack

- **React 19** + TypeScript + Vite
- **React Three Fiber** + Drei + Three.js
- **Zustand** state management
- **Tailwind CSS** styling
- **TensorFlow.js** (WebGPU/WebGL)
- **MessagePack** binary protocol

## 📊 The Trinity Visualization

Three cursors representing the cognitive manifold:

- **🟡 Phantom (Yellow)**: The intention target from neural signals
- **🟢 Bio-Link (Green)**: Actual arm movement (ground truth)
- **🔵 Loop-Back (Blue)**: Your decoder's prediction

**Goal:** Minimize the triangle area between all three cursors.

## ⚡ Real-Time Performance

- **40Hz streaming** from PhantomLink backend
- **60 FPS rendering** with smooth interpolation  
- **<50ms latency budget** (network + decoder + render)
- **Desync detection** when latency exceeds threshold

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
- **Passthrough**: Perfect tracking baseline
- **Delayed**: 100ms lag test
- **Velocity Predictor**: Linear model
- **Spike-Based**: Naive spike decoder

### 4. Monitor Performance

Watch the Metrics Panel:
- FPS (target: 60)
- Network Latency (max: 25ms)
- Decoder Latency (max: 25ms)
- Total Latency (max: 50ms)

## 🛠 Configuration

### Environment Variables

Create `.env.local`:

```bash
VITE_PHANTOMLINK_URL=wss://phantomlink.fly.dev
```

### Constants

Edit `src/utils/constants.ts`:

```typescript
export const COLORS = {
  PHANTOM: '#FFD700',
  BIOLINK: '#00FF00',
  LOOPBACK: '#0080FF',
};

export const PERFORMANCE_THRESHOLDS = {
  MAX_TOTAL_LATENCY_MS: 50,
};
```

## 📁 Project Structure

```
src/
├── components/      # React components
├── hooks/           # Custom hooks
├── store/           # Zustand state
├── decoders/        # BCI decoders
├── types/           # TypeScript types
└── utils/           # Utilities
```

## 🧠 Adding Custom Decoders

### JavaScript Decoder

```typescript
// src/decoders/myDecoders.ts
export const myDecoder: Decoder = {
  id: 'my-decoder',
  name: 'My Custom Decoder',
  type: 'javascript',
  code: `
    const { x, y, vx, vy } = input.kinematics;
    const spikes = input.spikes;
    
    // Your algorithm here
    
    return { x, y, vx, vy };
  `
};
```

### TensorFlow.js Decoder

1. Export model:

```bash
tensorflowjs_converter --input_format=keras model.h5 public/models/my-model/
```

2. Register decoder:

```typescript
const tfjsDecoder: Decoder = {
  id: 'tfjs-model',
  name: 'My TFJS Decoder',
  type: 'tfjs',
  modelUrl: '/models/my-model/model.json'
};
```

## 🔧 Development

### Key Files

- `src/App.tsx` - Main application
- `src/components/Arena.tsx` - 3D visualization
- `src/store/index.ts` - Global state
- `src/hooks/useDecoder.ts` - Decoder execution
- `src/utils/constants.ts` - Configuration

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

### TensorFlow.js Backend

Auto-selects best backend:
1. WebGPU (fastest)
2. WebGL (good)
3. CPU (fallback)

Check console:
```
[PhantomLoop] TensorFlow.js initialized with WebGPU backend
```

### Reduce Latency

- Use production server (lower RTT)
- Keep decoders simple (<10ms)
- Disable trails if needed

## 🐛 Troubleshooting

### "Cannot connect to server"

- ✓ PhantomLink backend running
- ✓ Valid session code
- ✓ Network/firewall settings

### High Latency

- Switch to production server
- Simplify decoder logic
- Reduce visualization settings

### Desync Detected

Normal when:
- Network congestion
- Heavy decoder computation
- Browser performance issues

## 📚 Resources

- [PhantomLink Backend](https://github.com/yelabb/PhantomLink)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [TensorFlow.js](https://www.tensorflow.org/js)
- [Neural Latents Benchmark](https://dandiarchive.org/dandiset/000140)

## 📄 License

MIT License

---

**Built for the BCI community** 🧠⚡

*"Close the loop. Collapse the triangle. Master the gauntlet."*






<img width="300" alt="logo" src="https://github.com/user-attachments/assets/87525c02-0301-4421-850f-06f96584b9df" />


# PHANTOM LOOP

**The Neural Gauntlet: Closed-Loop Validation Infrastructure**

[![PhantomLink Core](https://img.shields.io/badge/Powered_by-PhantomLink_Core-009688.svg)](https://github.com/yelabb/PhantomLink)
[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-phantomlink.fly.dev-blue.svg)](https://phantomlink.fly.dev)
[![WebGL](https://img.shields.io/badge/WebGL-R3F-black.svg)](https://docs.pmnd.rs/react-three-fiber)

> Phantom Loop is not just a visualizer. It is a **hostile environment** for BCI decoders.

It replays high-fidelity neural recordings (MC_Maze dataset) to simulate a live cortex, injecting network latency, signal drift, and noise. Your goal: **connect your decoder, close the loop, and maintain synchronization with the intention signal.**

<img width="600"  alt="screenshot" src="https://github.com/user-attachments/assets/adbde82e-53e0-4b61-b572-c149f4ff8a01" />

---

## 🏗 Architecture

Phantom Loop consists of two decoupled components:

### 1. PhantomLink Core (The Engine)
Python/FastAPI backend handling 40Hz streaming, session isolation, and drift simulation.

### 2. The Arena (The Dashboard)
WebGL/R3F frontend visualizing the **"Trinity"** of neural control.

---

## 🎯 The Trinity Visualization

The dashboard renders three distinct cursors to visualize the **Cognitive Manifold** in real-time:

| Cursor | Color | Description |
|--------|-------|-------------|
| **🟡 The Phantom (Intention)** | Yellow | The target state. The pure intent extracted from the dataset. |
| **🟢 The Bio-Link (Ground Truth)** | Green | The actual biological arm movement recorded during the session. The **Gold Standard**. |
| **🔵 The Loop-Back (Decoder)** | Blue | Your algorithm's prediction, streamed back to the server. |

**The Goal:** Collapse the triangle. **Minimize the area between Phantom, Bio, and Loop.**

---

## 🚀 Quick Start

### 1. Start the Core (Backend)

Phantom Loop relies on **PhantomLink Core v0.2.0** for neural data streaming.

```bash
# Clone and setup
git clone https://github.com/yelabb/PhantomLink.git
cd PhantomLink
pip install -r requirements.txt

# Launch the Neural Engine
python main.py
```

**Server runs on `localhost:8000`**

**Production:** Already deployed at **`phantomlink.fly.dev`** for immediate use.

### 2. Launch the Arena (Frontend)

```bash
cd PhantomLoop/frontend
npm install
npm run dev
```

**Dashboard accessible at `localhost:3000`**

---

## 🔌 Decoder Integration (The Challenge)

**Do not visualize static files. Connect your decoder to the live stream.**

We use **MessagePack over WebSocket** for microsecond-level serialization efficiency.

### Connection Protocol

1. **Receive:** 142 channels of Spike Counts (40Hz)
2. **Process:** Your inference model (Kalman, RNN, Transformer)
3. **Send:** Predicted Velocity (vx, vy)

### Python Client Example

```python
import websockets
import msgpack
import asyncio

async def run_decoder():
    # Connect to the binary stream
    uri = "ws://phantomlink.fly.dev/stream/binary/gauntlet-session-01"
    
    async with websockets.connect(uri) as websocket:
        while True:
            # 1. Receive Spikes (Zero-Copy decode)
            data = await websocket.recv()
            packet = msgpack.unpackb(data)
            spikes = packet['data']['spikes']['spike_counts']
            
            # 2. INFERENCE (Your Logic Here)
            # v_x, v_y = my_model.predict(spikes)
            
            # 3. Close the Loop
            response = msgpack.packb({'vx': 0.5, 'vy': -0.2})
            await websocket.send(response)

asyncio.run(run_decoder())
```

### JavaScript Client Example

```javascript
import msgpack from 'msgpack-lite';

const socket = new WebSocket('ws://phantomlink.fly.dev/stream/binary/gauntlet-session-01');
socket.binaryType = 'arraybuffer';

socket.onmessage = async (event) => {
  // 1. Receive Spikes
  const packet = msgpack.decode(new Uint8Array(event.data));
  const spikes = packet.data.spikes.spike_counts;
  
  // 2. INFERENCE
  const { vx, vy } = await myModel.predict(spikes);
  
  // 3. Close the Loop
  const response = msgpack.encode({ vx, vy });
  socket.send(response);
};
```

---

## 📡 Core API Reference

The engine exposes a **REST API** for session management and a **WebSocket interface** for the data stream.

### Session Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sessions/create` | Spawns a new isolated brain session. Returns `session_code`. |
| `GET` | `/api/sessions` | Lists active sessions and their health status. |
| `GET` | `/metadata` | Returns dataset specs (142 channels, 40Hz). |
| `POST` | `/api/control/{code}/pause` | Freezes the neural playback. |

### Data Streaming (WebSocket)

#### Binary Stream (Recommended)

```
ws://phantomlink.fly.dev/stream/binary/{session_code}
```

- Delivers **SpikeData**, **Kinematics**, and **Intention** packed in MsgPack
- **Payload:** ~6KB/packet
- **Frequency:** 40Hz (25ms interval)

#### JSON Stream (Debug only)

```
ws://phantomlink.fly.dev/stream/{session_code}
```

Standard JSON output. **High CPU overhead. Do not use for benchmarking.**

---

## ⚠️ Performance Constraints

Phantom Loop is a **Hard Real-Time environment.**

| Parameter | Value | Impact |
|-----------|-------|--------|
| **Heartbeat** | 25ms | Data is pushed every 25ms |
| **Jitter Tolerance** | ±3ms | Acceptable timing variance |
| **Latency Penalty** | Network RTT + Inference Time > 50ms | Visualization flags a **"Desync"** event (Red Glitch) |

**Rules:**
- Your decoder must process and respond within the **25ms window**
- Network round-trip time should be < 25ms
- Total loop latency (receive → process → send) must not exceed **50ms**

---

## 🧬 Dataset

Powered by the **Neural Latents Benchmark (MC_Maze)**.

| Property | Value |
|----------|-------|
| **Subject** | Non-human primate |
| **Brain Area** | Primary Motor Cortex (M1) & Premotor Dorsal (PMd) |
| **Channels** | 142 neural units |
| **Task** | Delayed center-out reaching |
| **Duration** | 294 seconds |
| **Trials** | 100 reaching movements |
| **Frequency** | 40Hz (25ms bins) |

**Data Components:**
- **Spike Counts:** 142-channel neural activity (int32 array)
- **Kinematics:** Cursor position (x, y) and velocity (vx, vy)
- **Intention:** Target position and trial metadata

---

## 🎮 Usage Scenarios

### 1. Decoder Development
Test your BCI algorithm against a **standardized neural dataset** with consistent replay conditions.

### 2. Real-Time Benchmarking
Validate inference latency and throughput under **production-like conditions** with network overhead.

### 3. Closed-Loop Training
Use the **Loop-Back** mechanism to train adaptive decoders that learn from their own predictions.

### 4. Robustness Testing
Enable **noise injection** and **signal drift** in PhantomLink Core to stress-test your decoder.

---

## 🛠 Advanced Configuration

### Noise Injection (via PhantomLink Core)

```python
from phantomlink.playback_engine import PlaybackEngine, NoiseInjectionMiddleware

middleware = NoiseInjectionMiddleware(
    noise_std=0.5,              # Gaussian noise level
    drift_amplitude=0.3,         # Non-stationary drift (30%)
    drift_period_seconds=60.0,   # Drift cycle period
    enable_noise=True,
    enable_drift=True
)

engine = PlaybackEngine(data_path, noise_middleware=middleware)
```

**Stress Levels:**
- **Light**: `noise_std=0.2, drift_amplitude=0.1`
- **Moderate**: `noise_std=0.5, drift_amplitude=0.3`
- **Intense**: `noise_std=1.0, drift_amplitude=0.5`
- **Extreme**: `noise_std=2.0, drift_amplitude=0.8`

### Intent Filtering

Filter by specific target positions or trial IDs for calibration:

```bash
curl -X POST https://phantomlink.fly.dev/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{
    "custom_code": "calibration-target-1",
    "target_id": 1
  }'
```

---

## 📊 Performance Metrics

Monitor system health and decoder performance:

```bash
curl https://phantomlink.fly.dev/metrics
```

**Key Metrics:**
- **network_latency_ms**: Generation → transmission latency
- **timing_error_ms**: Deviation from 40Hz target
- **dropped_packets**: Failed transmissions
- **memory_usage_mb**: Session memory footprint

See [PhantomLink Metrics Guide](https://github.com/yelabb/PhantomLink/blob/main/docs/METRICS_GUIDE.md) for details.

---

## 🧪 Testing Your Decoder

### Validation Checklist

- [ ] Can connect to WebSocket stream
- [ ] Can decode MessagePack packets
- [ ] Can extract 142-channel spike counts
- [ ] Inference latency < 25ms
- [ ] Can encode and send velocity predictions
- [ ] Maintains synchronization for > 60 seconds
- [ ] Handles network disconnections gracefully

### Example Test Script

```python
import asyncio
import time
import msgpack
import websockets

async def test_decoder():
    uri = "ws://phantomlink.fly.dev/stream/binary/test-session"
    latencies = []
    
    async with websockets.connect(uri) as ws:
        for i in range(100):
            t0 = time.perf_counter()
            
            # Receive
            data = await ws.recv()
            packet = msgpack.unpackb(data)
            
            # Process (dummy inference)
            vx, vy = 0.5, -0.2
            
            # Send
            await ws.send(msgpack.packb({'vx': vx, 'vy': vy}))
            
            latency = (time.perf_counter() - t0) * 1000
            latencies.append(latency)
            
    avg_latency = sum(latencies) / len(latencies)
    print(f"Average Loop Latency: {avg_latency:.2f}ms")
    print(f"✅ PASS" if avg_latency < 50 else "❌ FAIL")

asyncio.run(test_decoder())
```

---

## 🚧 Roadmap

- [ ] Multi-user collaborative sessions
- [ ] Decoder leaderboard with latency rankings
- [ ] Support for additional datasets (Human ECoG, Stentrode)
- [ ] Unity3D integration for VR visualization
- [ ] Adaptive difficulty scaling

---

## 🤝 Contributing

Phantom Loop is an **open-source initiative** to standardize BCI decoder validation.

**Ways to Contribute:**
- Submit decoder implementations
- Report latency benchmarks
- Improve visualization features
- Add new datasets

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📚 Resources

- **PhantomLink Core Repository:** [github.com/yelabb/PhantomLink](https://github.com/yelabb/PhantomLink)
- **Live Instance:** [phantomlink.fly.dev](https://phantomlink.fly.dev)
- **Beginner's Guide:** [PhantomLink BCI Guide](https://github.com/yelabb/PhantomLink/blob/main/docs/BEGINNERS_GUIDE.md)
- **Binary Streaming Guide:** [Binary Protocol Docs](https://github.com/yelabb/PhantomLink/blob/main/docs/BINARY_STREAMING_GUIDE.md)
- **Neural Latents Benchmark:** [DANDI:000140](https://dandiarchive.org/dandiset/000140)

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

---

## 💬 Support

- **Issues:** [GitHub Issues](https://github.com/yelabb/PhantomLoop/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yelabb/PhantomLoop/discussions)
- **Contact:** phantom.loop@neural.dev

---

**Built with ❤️ for the BCI community**

*"Close the loop. Collapse the triangle. Master the gauntlet."*



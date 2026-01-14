# PhantomLoop Implementation TODO

**Project:** The Neural Gauntlet Arena - WebGL BCI Decoder Visualization  
**Stack:** Vite + React + TypeScript + React Three Fiber + TensorFlow.js  
**Target:** <50ms end-to-end latency (network + decode + render)

---

## Phase 1: Foundation Setup

### 1.1 Project Initialization
- [ ] Run `npm create vite@latest frontend -- --template react-ts`
- [ ] Install core dependencies:
  - [ ] `@react-three/fiber @react-three/drei three`
  - [ ] `msgpack-lite zustand recharts`
  - [ ] `@tensorflow/tfjs @tensorflow/tfjs-backend-webgl @tensorflow/tfjs-backend-webgpu`
- [ ] Configure Tailwind CSS (`npm install -D tailwindcss postcss autoprefixer`)
- [ ] Create folder structure:
  ```
  src/
  ├── components/
  ├── hooks/
  ├── store/
  ├── decoders/
  ├── types/
  ├── utils/
  └── styles/
  ```

### 1.2 TypeScript Type Definitions
- [ ] Create `types/packets.ts`:
  - [ ] `StreamPacket` interface
  - [ ] `SpikeData` interface
  - [ ] `Kinematics` interface
  - [ ] `TargetIntention` interface
  - [ ] `MetadataMessage` interface
- [ ] Create `types/decoders.ts`:
  - [ ] `Decoder` interface (id, name, type, code/modelUrl, avgLatency)
  - [ ] `DecoderType` enum ('javascript' | 'tfjs' | 'onnx')
  - [ ] `DecoderOutput` interface (x, y, confidence?)
- [ ] Create `types/state.ts`:
  - [ ] `AppState` interface
  - [ ] `ConnectionStatus` type
  - [ ] `VisualizationSettings` interface

### 1.3 Constants & Configuration
- [ ] Create `utils/constants.ts`:
  - [ ] Color constants (Phantom: #FFD700, Bio-Link: #00FF00, Loop-Back: #0080FF)
  - [ ] PhantomLink URL: `wss://phantomlink.fly.dev/stream/binary/`
  - [ ] Performance thresholds (latency: 50ms, jitter: 3ms)
  - [ ] Decoder execution timeout (10ms)

---

## Phase 2: State Management

### 2.1 Zustand Store Setup
- [ ] Create `store/index.ts` with combined store
- [ ] Create `store/slices/connectionSlice.ts`:
  - [ ] `websocket: WebSocket | null`
  - [ ] `sessionCode: string`
  - [ ] `isConnected: boolean`
  - [ ] `connectionStatus: ConnectionStatus`
  - [ ] Actions: `connectWebSocket()`, `disconnectWebSocket()`
- [ ] Create `store/slices/streamSlice.ts`:
  - [ ] `currentPacket: StreamPacket | null`
  - [ ] `packetBuffer: StreamPacket[]` (max 40)
  - [ ] `metadata: MetadataMessage | null`
  - [ ] Actions: `receivePacket()`, `updateBuffer()`
- [ ] Create `store/slices/decoderSlice.ts`:
  - [ ] `activeDecoder: Decoder | null`
  - [ ] `decoderOutput: { x: number, y: number } | null`
  - [ ] `decoderLatency: number`
  - [ ] Actions: `setActiveDecoder()`, `updateDecoderOutput()`
- [ ] Create `store/slices/visualSlice.ts`:
  - [ ] `showPhantom: boolean`
  - [ ] `showBioLink: boolean`
  - [ ] `showLoopBack: boolean`
  - [ ] `showTrajectories: boolean`
  - [ ] `showTargets: boolean`
  - [ ] `cameraMode: 'top' | 'perspective' | 'side'`
- [ ] Create `store/slices/metricsSlice.ts`:
  - [ ] `fps: number`
  - [ ] `latency: number`
  - [ ] `droppedFrames: number`
  - [ ] `totalPacketsReceived: number`

---

## Phase 3: WebSocket Integration

### 3.1 WebSocket Connection Hook
- [ ] Create `hooks/useWebSocket.ts`:
  - [ ] Connect to `wss://phantomlink.fly.dev/stream/binary/{session}`
  - [ ] Set `binaryType = 'arraybuffer'`
  - [ ] Handle `onopen`, `onmessage`, `onerror`, `onclose`
  - [ ] Implement reconnection logic (exponential backoff: 1s, 2s, 4s)
  - [ ] Update connection status in store

### 3.2 MessagePack Decoder Hook
- [ ] Create `hooks/useMessagePack.ts`:
  - [ ] Import `msgpack-lite`
  - [ ] Decode `arraybuffer` → JSON
  - [ ] Handle metadata message (type: 'metadata')
  - [ ] Handle data message (type: 'data')
  - [ ] Error handling for malformed packets
  - [ ] Update store with decoded data

### 3.3 Packet Buffer Management
- [ ] Create `hooks/usePacketBuffer.ts`:
  - [ ] Maintain ring buffer (max 40 packets = 1 second)
  - [ ] FIFO logic (push new, shift old)
  - [ ] Expose buffer for decoder context windows
  - [ ] Track sequence numbers for gap detection

---

## Phase 4: 3D Visualization (React Three Fiber)

### 4.1 Main Arena Component
- [ ] Create `components/Arena.tsx`:
  - [ ] Setup `<Canvas>` with WebGL renderer
  - [ ] Configure camera (orthographic, top-down view)
  - [ ] Add ambient + directional lighting
  - [ ] Render child components (cursors, trails, targets, grid)

### 4.2 Cursor Components
- [ ] Create `components/Cursor.tsx` (base component):
  - [ ] Props: `position: [x, y, z]`, `color: string`, `size: number`
  - [ ] `useRef<THREE.Mesh>()` for mesh reference
  - [ ] `useFrame()` with `.lerp()` interpolation (smoothing factor: 0.3)
  - [ ] Sphere geometry with emissive material
- [ ] Create `components/PhantomCursor.tsx`:
  - [ ] Extends `Cursor` with yellow color (#FFD700)
  - [ ] Reads `intention.target_x/y` from store
  - [ ] Size: 0.8 units
- [ ] Create `components/BioLinkCursor.tsx`:
  - [ ] Extends `Cursor` with green color (#00FF00)
  - [ ] Reads `kinematics.x/y` from store
  - [ ] Size: 1.0 units
- [ ] Create `components/LoopBackCursor.tsx`:
  - [ ] Extends `Cursor` with blue color (#0080FF)
  - [ ] Reads `decoderOutput.x/y` from store
  - [ ] Size: 0.9 units

### 4.3 Trajectory Trails
- [ ] Create `components/TrajectoryLine.tsx`:
  - [ ] Props: `points: Vector3[]`, `color: string`
  - [ ] Use drei's `<Line>` component
  - [ ] Opacity gradient: 1.0 → 0.2 (front to back)
  - [ ] Line width: 0.1 units
  - [ ] Store last 40 positions per cursor

### 4.4 Environment Elements
- [ ] Create `components/TargetMarker.tsx`:
  - [ ] Circle geometry at `intention.target_x/y`
  - [ ] Semi-transparent white (#FFFFFF, alpha: 0.3)
  - [ ] Radius: 2.0 units
- [ ] Create `components/GridFloor.tsx`:
  - [ ] Grid helper (200×200 units, 20 divisions)
  - [ ] Axis indicators (X: red, Y: green)
  - [ ] Dark gray color (#404040)

### 4.5 Camera Controls
- [ ] Create `components/CameraController.tsx`:
  - [ ] Use drei's `<OrbitControls>`
  - [ ] Implement preset views:
    - [ ] Top-down: `[0, 50, 0]` looking at `[0, 0, 0]`
    - [ ] Perspective: `[30, 30, 30]` looking at `[0, 0, 0]`
    - [ ] Side: `[50, 0, 0]` looking at `[0, 0, 0]`
  - [ ] Toggle via buttons in Dashboard

---

## Phase 5: Coordinate System

### 5.1 Coordinate Transformation Utilities
- [ ] Create `utils/coordinates.ts`:
  - [ ] `normalizePosition(x, y, metadata)` → viewport coords (-100 to +100)
  - [ ] `denormalizePosition(x, y, metadata)` → dataset coords
  - [ ] Handle dynamic scaling based on metadata min/max
  - [ ] Maintain aspect ratio

---

## Phase 6: Tier 1 - Baseline Decoders (JavaScript)

### 6.1 JavaScript Decoder Registry
- [ ] Create `decoders/baselines.ts`:
  - [ ] **Passthrough Decoder**:
    ```typescript
    (spikes, kinematics, history) => ({ x: kinematics.x, y: kinematics.y })
    ```
  - [ ] **Random Decoder** (chaos mode):
    ```typescript
    (spikes, kinematics, history) => ({
      x: kinematics.x + (Math.random() - 0.5) * 20,
      y: kinematics.y + (Math.random() - 0.5) * 20
    })
    ```
  - [ ] **Velocity Persistence**:
    ```typescript
    (spikes, kinematics, history) => ({
      x: kinematics.x + kinematics.vx * 0.025,
      y: kinematics.y + kinematics.vy * 0.025
    })
    ```
  - [ ] **Spike Rate Heuristic** (simple linear mapping)
  - [ ] **Delayed Decoder** (adds 100ms lag to test desync)

### 6.2 Decoder Execution Wrapper
- [ ] Create `decoders/executeDecoder.ts`:
  - [ ] Compile JS decoder with `new Function()`
  - [ ] Wrap in try-catch for error handling
  - [ ] Measure execution time with `performance.now()`
  - [ ] Return `{ x, y, latency }`

---

## Phase 7: Tier 2 - TensorFlow.js Decoders

### 7.1 Model Training Scripts
- [ ] Create `scripts/train_lstm.py`:
  - [ ] Load MC_Maze dataset via PhantomLink's `DataLoader`
  - [ ] Extract spikes: `[11746, 142]`
  - [ ] Extract kinematics: `[11746, 4]` (vx, vy, x, y)
  - [ ] Create windowed dataset: `[batch, 10, 142]` → `[batch, 2]` (vx, vy)
  - [ ] Build Keras LSTM model:
    ```python
    LSTM(128) → Dense(64, relu) → Dense(2)
    ```
  - [ ] Train with 80/20 split, 50 epochs, MSE loss
  - [ ] Save model: `lstm_decoder/`
- [ ] Create `scripts/train_transformer.py`:
  - [ ] Multi-head attention (4 heads, 20 timesteps)
  - [ ] Positional encoding for temporal context
  - [ ] Train similar to LSTM
- [ ] Create `scripts/train_kalman_rnn.py`:
  - [ ] RNN predicts Kalman observation
  - [ ] Hybrid architecture (neural + classical filtering)

### 7.2 Model Export to TensorFlow.js
- [ ] Create `scripts/export_tfjs.sh`:
  - [ ] Install `tensorflowjs`: `pip install tensorflowjs`
  - [ ] Convert models:
    ```bash
    tensorflowjs_converter --input_format=tf_saved_model \
      lstm_decoder/ \
      frontend/public/models/lstm-decoder/
    ```
  - [ ] Repeat for transformer and kalman-rnn
  - [ ] Create `metadata.json` for each model (architecture, params, expected latency)

### 7.3 TensorFlow.js Loader
- [ ] Create `decoders/tfjsDecoders.ts`:
  - [ ] **LSTM Decoder Loader**:
    ```typescript
    const model = await tf.loadLayersModel('/models/lstm-decoder/model.json');
    ```
  - [ ] **Transformer Decoder Loader**
  - [ ] **Kalman-RNN Decoder Loader**
  - [ ] Cache loaded models in memory
  - [ ] Handle model loading errors

### 7.4 TFJS Inference Function
- [ ] Create `decoders/runTFJSDecoder.ts`:
  - [ ] Accept `model`, `spikes`, `kinematics`, `history`
  - [ ] Prepare input tensor (e.g., `tf.tensor3d([spikeWindow])`)
  - [ ] Run inference: `model.predict(input)`
  - [ ] Extract output: `await prediction.data()`
  - [ ] Wrap in `tf.tidy()` for memory management
  - [ ] Integrate velocity → position (if output is vx/vy)
  - [ ] Return `{ x, y, latency }`

---

## Phase 8: Decoder Integration Hook

### 8.1 Unified Decoder Hook
- [ ] Create `hooks/useDecoder.ts`:
  - [ ] Listen to `currentPacket` from store
  - [ ] Check `activeDecoder.type`:
    - [ ] If `'javascript'`: Execute sync function
    - [ ] If `'tfjs'`: Execute async TFJS inference
  - [ ] Measure execution time (`performance.now()`)
  - [ ] Update store with `decoderOutput` and `decoderLatency`
  - [ ] Handle errors (timeout, invalid output)
  - [ ] Enforce 10ms execution timeout

### 8.2 GPU Backend Management
- [ ] Initialize TensorFlow.js backends in `main.tsx`:
  - [ ] Try WebGPU: `await tf.setBackend('webgpu')`
  - [ ] Fallback to WebGL: `await tf.setBackend('webgl')`
  - [ ] Fallback to CPU: `await tf.setBackend('cpu')`
  - [ ] Log active backend to console

### 8.3 Decoder Selector Component
- [ ] Create `components/DecoderSelector.tsx`:
  - [ ] Dropdown with all registered decoders
  - [ ] Display: name, type, avgLatency, architecture
  - [ ] Show GPU usage indicator (if TFJS)
  - [ ] Call `setActiveDecoder()` on selection
  - [ ] Highlight current decoder

---

## Phase 9: Performance Monitoring

### 9.1 Performance Tracking Hook
- [ ] Create `hooks/usePerformance.ts`:
  - [ ] **FPS Tracking**:
    - [ ] Use `requestAnimationFrame` callback
    - [ ] Calculate frames per second
    - [ ] Update store every 1 second
  - [ ] **WebSocket Latency**:
    - [ ] Echo packet timestamp
    - [ ] Calculate `Date.now() - packet.timestamp`
  - [ ] **Decoder Latency**:
    - [ ] Track execution time per decoder call
  - [ ] **Dropped Frames**:
    - [ ] Detect gaps in `sequence_number`
    - [ ] Increment counter in store

### 9.2 Metrics Panel Component
- [ ] Create `components/MetricsPanel.tsx`:
  - [ ] Display real-time metrics:
    - [ ] FPS (green if >55, yellow if 45-55, red if <45)
    - [ ] Network latency (ms)
    - [ ] Decoder latency (ms)
    - [ ] Total latency (sum, **red if >50ms**)
    - [ ] Packets received / Total packets
    - [ ] Dropped frames count
  - [ ] Use Recharts for line graphs:
    - [ ] Latency over time (last 60 seconds)
    - [ ] FPS over time
  - [ ] Bar chart comparing decoder latencies

### 9.3 Desync Alert Component
- [ ] Create `components/DesyncAlert.tsx`:
  - [ ] Monitor `totalLatency` from store
  - [ ] Trigger when `totalLatency > 50ms`:
    - [ ] Red screen flash (full-screen overlay, 100ms duration)
    - [ ] Optional audio alert (beep sound)
    - [ ] Log event to metrics
  - [ ] Display warning message: "DESYNC DETECTED"

---

## Phase 10: Dashboard & UI Controls

### 10.1 Main Dashboard Overlay
- [ ] Create `components/Dashboard.tsx`:
  - [ ] Position as 2D overlay on 3D scene (absolute positioning)
  - [ ] Display:
    - [ ] Session code
    - [ ] Connection status badge (green/yellow/red dot)
    - [ ] Active decoder name
    - [ ] Current trial ID (if available)
  - [ ] Semi-transparent background

### 10.2 Connection Status Indicator
- [ ] Create `components/ConnectionStatus.tsx`:
  - [ ] Green dot: Connected
  - [ ] Yellow dot: Connecting/Reconnecting
  - [ ] Red dot: Disconnected
  - [ ] Show WebSocket URL on hover

### 10.3 Visualization Controls
- [ ] Create `components/VisualizationControls.tsx`:
  - [ ] Checkboxes for:
    - [ ] Show Phantom cursor
    - [ ] Show Bio-Link cursor
    - [ ] Show Loop-Back cursor
    - [ ] Show trajectory trails
    - [ ] Show target markers
    - [ ] Show grid
  - [ ] Update `visualSlice` on toggle

### 10.4 Session Manager
- [ ] Create `components/SessionManager.tsx`:
  - [ ] Button: "Create New Session"
  - [ ] Call `POST /api/sessions/create` to PhantomLink
  - [ ] Extract session code from response
  - [ ] Connect WebSocket with new session code
  - [ ] Display active session list (optional)

---

## Phase 11: Testing & Validation

### 11.1 Integration Testing
- [ ] Connect to live PhantomLink backend (`wss://phantomlink.fly.dev`)
- [ ] Create session and verify WebSocket connection
- [ ] Confirm MessagePack decoding (no errors in console)
- [ ] Verify 40Hz packet rate (±3ms jitter tolerance)
- [ ] Test all three cursors render correctly:
  - [ ] Phantom at intention target
  - [ ] Bio-Link at kinematic position
  - [ ] Loop-Back at decoder output
- [ ] Validate smooth interpolation (60fps rendering)

### 11.2 Decoder Testing
- [ ] Test all Tier 1 decoders (JS baselines):
  - [ ] Passthrough: perfect tracking
  - [ ] Random: chaotic movement
  - [ ] Delayed: triggers desync alert
- [ ] Test TFJS decoders:
  - [ ] LSTM loads without errors
  - [ ] Inference completes <5ms
  - [ ] Output is valid (not NaN)
  - [ ] GPU backend activates (check console)
- [ ] Switch decoders live (no frame drops)

### 11.3 Performance Validation
- [ ] Run for 5+ minutes continuously
- [ ] Monitor GPU memory usage (<500MB)
- [ ] Check for memory leaks (Chrome DevTools)
- [ ] Verify desync alert triggers at 50ms threshold
- [ ] Test reconnection on manual disconnect
- [ ] Confirm no dropped packets under normal conditions

### 11.4 Edge Cases
- [ ] Test with malformed packets (simulate corruption)
- [ ] Test with high latency network (throttle in DevTools)
- [ ] Test with slow GPU (disable WebGPU/WebGL, force CPU)
- [ ] Test with missing metadata fields
- [ ] Test session expiration handling

---

## Phase 12: Deployment

### 12.1 Production Build
- [ ] Run `npm run build` with Vite
- [ ] Verify bundle size (<2MB excluding models)
- [ ] Test production build locally (`npm run preview`)
- [ ] Optimize TFJS models (quantization if needed)

### 12.2 Model Preparation
- [ ] Place trained models in `frontend/public/models/`:
  - [ ] `lstm-decoder/model.json` + shards
  - [ ] `transformer-decoder/model.json` + shards
  - [ ] `kalman-rnn/model.json` + shards
- [ ] Total size: ~10MB
- [ ] Add preload tags in `index.html`:
  ```html
  <link rel="preload" href="/models/lstm-decoder/model.json" as="fetch" crossorigin>
  ```

### 12.3 Deploy to Vercel/Netlify
- [ ] Create Vercel/Netlify account
- [ ] Connect GitHub repository
- [ ] Set environment variables:
  - [ ] `VITE_PHANTOMLINK_URL=wss://phantomlink.fly.dev`
- [ ] Configure build settings:
  - [ ] Build command: `npm run build`
  - [ ] Publish directory: `frontend/dist`
- [ ] Deploy and test live URL

### 12.4 CORS Configuration
- [ ] Verify PhantomLink allows WebSocket connections from deployed domain
- [ ] Add origin to CORS whitelist if needed
- [ ] Test cross-origin WebSocket connection

---

## Phase 13: Documentation

### 13.1 README.md
- [ ] Update `PhantomLoop/README.md`:
  - [ ] Project overview
  - [ ] Architecture diagram (Trinity system)
  - [ ] Installation instructions
  - [ ] Usage guide (how to connect to PhantomLink)
  - [ ] Screenshots of Arena visualization
  - [ ] Performance benchmarks

### 13.2 Decoder Guide
- [ ] Create `docs/DECODER_GUIDE.md`:
  - [ ] How decoders work (3-tier architecture)
  - [ ] How to add custom JS decoders
  - [ ] How to train TFJS models
  - [ ] Export process (TensorFlow → TensorFlow.js)
  - [ ] Performance optimization tips
  - [ ] Example: "Building Your Own Decoder"

### 13.3 Performance Benchmarks
- [ ] Document typical metrics:
  - [ ] Network latency: ~20ms
  - [ ] LSTM decoder: ~3ms
  - [ ] Transformer decoder: ~6ms
  - [ ] Rendering: ~16ms (60fps)
  - [ ] Total: ~40ms (within budget ✅)

---

## Further Considerations

### Decoder Training Data
- [ ] **Decision:** Use 80/20 train/validation split on MC_Maze dataset
- [ ] Display validation loss in decoder metadata
- [ ] Show generalization quality in DecoderSelector

### GPU Memory Management
- [ ] **Decision:** Use `tf.tidy()` wrappers in all TFJS inference
- [ ] Monitor tensor pool in MetricsPanel
- [ ] Set up tensor disposal in cleanup functions

### Model Versioning
- [ ] **Initial:** Store models in `public/models/` (~10MB)
- [ ] **Future:** Add optional `VITE_MODEL_API_URL` for dynamic loading
- [ ] Enable A/B testing of new architectures without redeployment

---

## Success Criteria

- [ ] All three cursors (Phantom, Bio-Link, Loop-Back) render correctly
- [ ] 40Hz packet rate maintained (±3ms jitter)
- [ ] Total latency <50ms (network + decode + render)
- [ ] TFJS decoders execute <5ms per inference
- [ ] No memory leaks after 5+ minutes
- [ ] Desync alert triggers correctly
- [ ] Smooth 60fps rendering
- [ ] Decoder switching works without frame drops
- [ ] Reconnection logic handles disconnects gracefully
- [ ] Documentation complete with examples

---

**Estimated Timeline:** 12-15 days (phases can be parallelized)  
**Total Bundle Size:** ~2MB (code) + ~10MB (models)  
**Performance Target:** <50ms end-to-end latency ✅
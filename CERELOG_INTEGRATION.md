# Universal EEG Device Integration

This branch adds **universal EEG hardware support** to PhantomLoop, including electrode placement and signal quality monitoring for multiple EEG devices, with Brainflow integration.

## 🎯 Supported Devices

| Manufacturer | Device | Channels | Sample Rate | Brainflow ID | Protocol |
|--------------|--------|----------|-------------|--------------|----------|
| **OpenBCI** | Cyton | 8 | 250 Hz | 0 | Serial/WiFi |
| **OpenBCI** | Cyton + Daisy | 16 | 125 Hz | 2 | Serial/WiFi |
| **OpenBCI** | Ganglion | 4 | 200 Hz | 1 | BLE |
| **NeuroSky** | MindWave | 1 | 512 Hz | 18 | Bluetooth |
| **Muse** | Muse 2 | 4 | 256 Hz | 22 | BLE |
| **Muse** | Muse S | 4 | 256 Hz | 21 | BLE |
| **Emotiv** | Insight | 5 | 128 Hz | 25 | BLE |
| **Emotiv** | EPOC X | 14 | 128/256 Hz | 26 | BLE |
| **Cerelog** | ESP-EEG | 8 | 250 Hz | N/A* | WiFi (TCP) |
| **Brainflow** | Synthetic | 8 | 250 Hz | -1 | Virtual |

*Cerelog ESP-EEG requires a WebSocket bridge (included).

## ⚠️ Browser Connectivity

**Browsers cannot open raw TCP, Serial, or Bluetooth connections directly.**

For hardware devices, you need a **WebSocket bridge** that runs locally and proxies the device data to the browser. This project includes:

1. **cerelog_ws_bridge.py** - For Cerelog ESP-EEG (TCP → WebSocket)
2. Community bridges for other devices (see Bridge Setup section)

### Bridge Architecture
```
EEG Device (TCP/Serial/BLE)
    ↓
WebSocket Bridge (Python/Node.js)
    ↓ (ws://localhost:876x)
PhantomLoop (Browser)
```

## What's New

### 🌐 Universal Device Profiles (`src/devices/`)
- **Comprehensive device registry** with specs for 10+ EEG devices
- **Brainflow board IDs** for all supported devices
- **Auto-configuration** based on device selection
- **Default montages** with standard 10-20 electrode positions

### 🔌 Universal EEG Adapter (`src/streams/UniversalEEGAdapter.ts`)
- **Single adapter** that works with all device profiles
- **Automatic protocol detection** and parsing
- **Signal quality estimation** from amplitude characteristics
- **Reconnection handling** with exponential backoff

### 🎯 Electrode Placement Screen
- **Interactive electrode configuration UI** with support for 1-16+ channel setups
- **Standard 10-20/10-10 montage** with predefined positions
- **Device-specific defaults** (Muse positions, Emotiv layout, etc.)
- **Real-time signal quality monitoring** with color-coded indicators

### 📤 Enhanced Brainflow Export
- **Auto-detect board ID** from device type
- **Device-aware Python code generation**
- **Complete channel mapping** with positions
- **Ready-to-run scripts** for any Brainflow-compatible device

## Quick Start

### 1. Select Your Device

```typescript
import { createAdapterForDevice } from './streams';

// Create adapter for your device
const adapter = createAdapterForDevice('openbci-cyton');
// or: 'muse-2', 'emotiv-insight', 'neurosky-mindwave', etc.

// Connect to WebSocket bridge
await adapter.connect('ws://localhost:8766');
```

### 2. Bridge Setup by Device

#### OpenBCI Cyton/Ganglion
```bash
# Install brainflow
pip install brainflow

# Use brainflow-websocket-bridge (community)
# https://github.com/brainflow-dev/brainflow-websocket-bridge
python bridge.py --board-id 0 --serial-port COM3
```

#### Muse 2/S
```bash
# Install muselsl
pip install muselsl

# Stream via LSL, then use LSL-to-WebSocket bridge
muselsl stream
```

#### Emotiv Insight/EPOC
```bash
# Use Emotiv's Cortex API with WebSocket bridge
# https://emotiv.gitbook.io/cortex-api/
```

#### Cerelog ESP-EEG
```bash
# Connect to ESP-EEG WiFi (SSID: CERELOG_EEG, Password: cerelog123)

# Run the included bridge
cd scripts
pip install websockets
python cerelog_ws_bridge.py

# Connect in PhantomLoop to ws://localhost:8765
```

### 3. Access Electrode Placement

1. **WelcomeScreen** → Click "Configure Electrodes" 
2. **Select your device** from the dropdown
3. **Configure electrodes** and monitor signal quality
4. **Proceed to Dashboard** when ready

## Architecture

### New Files
```
src/
├── devices/
│   ├── index.ts                   # Device exports
│   └── deviceProfiles.ts          # Universal device registry
├── streams/
│   └── UniversalEEGAdapter.ts     # Universal EEG stream adapter
├── types/
│   └── electrodes.ts              # Updated for multi-device support
└── utils/
    └── brainflowExport.ts         # Enhanced with device profiles
```

### Device Profile Structure
```typescript
interface DeviceProfile {
  id: string;                    // 'openbci-cyton', 'muse-2', etc.
  name: string;                  // Human-readable name
  manufacturer: string;          // 'OpenBCI', 'Muse', etc.
  channelCount: number;          // Number of EEG channels
  samplingRates: number[];       // Supported sample rates
  resolution: number;            // ADC resolution in bits
  brainflowBoardId?: number;     // Brainflow board ID
  protocols: string[];           // Supported protocols
  capabilities: {
    hasImpedanceMeasurement: boolean;
    hasAccelerometer: boolean;
    supportsBrainflow: boolean;
    // ...
  };
  defaultMontage?: {
    labels: string[];            // ['Fp1', 'Fp2', ...]
    positions: Position3D[];     // 3D positions
  };
}
```

## Brainflow Board IDs Reference

```typescript
import { BRAINFLOW_BOARD_IDS } from './devices';

// OpenBCI
BRAINFLOW_BOARD_IDS.CYTON           // 0
BRAINFLOW_BOARD_IDS.GANGLION        // 1
BRAINFLOW_BOARD_IDS.CYTON_DAISY     // 2

// NeuroSky
BRAINFLOW_BOARD_IDS.MINDWAVE        // 18

// Muse
BRAINFLOW_BOARD_IDS.MUSE_2          // 22
BRAINFLOW_BOARD_IDS.MUSE_S          // 21

// Emotiv
BRAINFLOW_BOARD_IDS.INSIGHT         // 25
BRAINFLOW_BOARD_IDS.EPOC            // 26

// Testing
BRAINFLOW_BOARD_IDS.SYNTHETIC       // -1
```

## Usage Examples

### List All Supported Devices
```typescript
import { listDeviceProfiles, getSupportedDevices } from './streams';

// Get all device profiles
const devices = getSupportedDevices();
console.log(devices);
// [{ id: 'openbci-cyton', name: 'OpenBCI Cyton', channelCount: 8, ... }, ...]
```

### Create Device-Specific Adapter
```typescript
import { createUniversalEEGAdapter } from './streams';

const adapter = createUniversalEEGAdapter({
  deviceId: 'muse-2',
  bridgeUrl: 'ws://localhost:8767',
  channelLabels: ['TP9', 'AF7', 'AF8', 'TP10'], // Optional override
});

adapter.onSample((sample) => {
  console.log('EEG data:', sample.channels);
});

await adapter.connect();
```

### Export to Brainflow Python
```typescript
import { 
  downloadBrainflowPythonCode,
  getBoardIdFromDeviceType 
} from './utils/brainflowExport';

// Auto-detects board ID from device type
downloadBrainflowPythonCode(electrodeConfig);

// Or specify explicitly
const boardId = getBoardIdFromDeviceType('openbci-cyton'); // Returns 0
```

### Monitor Signal Quality
```typescript
const adapter = createAdapterForDevice('openbci-cyton');
await adapter.connect();

// Get channel statistics
const stats = adapter.getChannelStats();
stats.forEach((ch, i) => {
  console.log(`Ch${i}: quality=${ch.quality}, std=${ch.std.toFixed(1)}µV`);
});
```

## Device-Specific Notes

### OpenBCI
- **Impedance check**: Supported on Cyton/Ganglion
- **Accelerometer**: Built-in 3-axis accelerometer
- **Markers**: Supports event markers via aux channels

### Muse
- **Positions**: Non-standard (TP9, AF7, AF8, TP10)
- **Aux sensors**: PPG, gyroscope, accelerometer
- **No impedance**: Quality estimated from signal

### Emotiv
- **Subscription**: Requires Emotiv account for raw data
- **Impedance**: Supported on all models
- **Motion**: Gyroscope + accelerometer

### Cerelog ESP-EEG
- **ADS1299**: No impedance measurement (signal-based quality only)
- **WiFi AP**: Device creates its own network
- **Binary protocol**: Requires WebSocket bridge

## Signal Quality Estimation

For devices without impedance measurement (Muse, Cerelog), quality is estimated:

| Quality | Std Dev (µV) | Pseudo-Impedance | Description |
|---------|--------------|------------------|-------------|
| Good | 5-100 | <5 kΩ | Normal EEG range |
| Fair | 100-200 | 5-15 kΩ | Slightly elevated noise |
| Poor | 200-500 | 15-50 kΩ | High noise/artifacts |
| Disconnected | <5 or >500 | >50 kΩ | No signal or saturated |

## Spatial Features (Electrode-Aware Decoding)

When electrode configuration is available, decoders receive spatial features:

```typescript
// In your decoder
return (input) => {
  const { spikes, spatialFeatures, channelMask } = input;
  
  // ROI averages by brain region
  if (spatialFeatures?.roiAverages) {
    const motorActivity = spatialFeatures.roiAverages.central;
    const visualActivity = spatialFeatures.roiAverages.occipital;
  }
  
  // Only use active channels
  const activeData = channelMask 
    ? spikes.filter((_, i) => channelMask[i])
    : spikes;
  
  return { x: 0, y: 0 };
};
```

## Testing Without Hardware

```typescript
// Use simulation adapter
import { createSimulationAdapter } from './streams';

const simAdapter = createSimulationAdapter({
  pattern: 'eeg-alpha',  // Generates alpha oscillations
  channelCount: 8,
  samplingRate: 250,
});

await simAdapter.connect();
```

Or use Brainflow's synthetic board:
```python
from brainflow import BoardShim, BrainFlowInputParams

board = BoardShim(-1, BrainFlowInputParams())  # -1 = Synthetic
board.prepare_session()
board.start_stream()
```

## FAQ

**Q: Can I add support for a new device?**  
A: Yes! Add a new entry to `DEVICE_PROFILES` in `src/devices/deviceProfiles.ts`.

**Q: Do I need a bridge for all devices?**  
A: Yes, browsers can't access hardware directly. Each device type needs a bridge.

**Q: Can I use multiple devices simultaneously?**  
A: Yes, create multiple adapter instances with different bridge URLs.

**Q: What if my device isn't listed?**  
A: Use 'brainflow-generic' device type and configure manually, or add a new profile.

## License

Same as PhantomLoop main project.

# Cerelog ESP-EEG Integration

This branch adds electrode placement and signal quality monitoring for the Cerelog ESP-EEG device, preparing PhantomLoop bridge to Brainflow.

## ⚠️ Important Protocol Information

**The Cerelog ESP-EEG uses TCP sockets, NOT WebSocket.**

Browsers cannot open raw TCP connections, so you need either:
1. **WebSocket Bridge** (Python script included) - for browser access
2. **Direct Python/LSL access** - for Python-based workflows

### Hardware Details
- **Chip**: Texas Instruments ADS1299 (24-bit ADC)
- **Channels**: 8 EEG channels
- **Sample Rate**: 250 SPS
- **WiFi AP**: SSID `CERELOG_EEG`, Password `cerelog123`
- **Device IP**: `192.168.4.1`
- **TCP Data Port**: `1112` (binary stream)
- **UDP Discovery Port**: `4445`

### ⚡ No Impedance Measurement!
The ADS1299 chip does NOT support impedance measurement. Signal quality is **estimated from signal amplitude characteristics**:
- **Good**: Normal EEG amplitude (~5-100µV std)
- **Fair**: Elevated noise (~100-200µV std)
- **Poor**: High noise (~200-500µV std)
- **Disconnected**: Flatline (<5µV) or saturated (>500µV)

## What's New

### 🎯 Electrode Placement Screen
- **Interactive electrode configuration UI** with support for 8, 16, 32-channel setups
- **Standard 10-20 montage** with predefined positions for common EEG electrodes
- **Real-time signal quality monitoring** with color-coded quality indicators
- **Visual electrode layout** showing spatial positions and signal quality

### 📡 ESP-EEG Device Support
- **TCP binary protocol** parsing (via WebSocket bridge)
- **Live signal quality estimation** from EEG amplitude
- **Connection status monitoring** with auto-reconnect functionality
- **Protocol info display** showing device specs

### 🧠 Electrode-Aware Decoding
- **Spatial feature extraction** - ROI averages, spatial gradients, neighborhood correlations
- **Channel masking** - decoders can access active/inactive channel information
- **Enhanced decoder input** with electrode configuration and spatial features
- Backward compatible with existing decoders (electrode features are optional)

### 📤 Brainflow Export Utilities
- **JSON export** - Full electrode configuration in Brainflow-compatible format
- **CSV export** - Spreadsheet-friendly electrode data with positions
- **Python code generation** - Ready-to-use Brainflow integration script
- **Import/export workflow** - Save validated configurations for future sessions

## Quick Start

### 1. Access Electrode Placement

The ElectrodePlacementScreen is **fully integrated** into the app navigation:

**User Flow:**
1. **WelcomeScreen** - Click "Configure Electrodes (ESP-EEG)" button
2. **ElectrodePlacementScreen** - Set up electrodes and monitor signal quality
3. **ResearchDashboard** - Click "Proceed to Dashboard →" when ready

### 2. Connect to ESP-EEG (Via Bridge)

```bash
# Step 1: Connect to ESP-EEG WiFi
# SSID: CERELOG_EEG
# Password: cerelog123

# Step 2: Install the bridge dependency
pip install websockets

# Step 3: Run the WebSocket bridge
cd scripts
python cerelog_ws_bridge.py

# Step 4: In PhantomLoop, connect to:
# ws://localhost:8765
```

### 3. Configure Electrodes
- Select channel count (8/16/32)
- Choose montage type (10-20/10-10/custom)
- Apply configuration
- Monitor signal quality in real-time

### 4. Export to Brainflow
```typescript
import { 
  downloadConfiguration, 
  downloadBrainflowPythonCode 
} from './utils/brainflowExport';

// Export JSON config
downloadConfiguration(electrodeConfig, 'json');

// Export Python integration code
downloadBrainflowPythonCode(electrodeConfig, 38); // 38 = Synthetic board
```

## Architecture

### New Files
```
src/
├── types/
│   └── electrodes.ts              # Electrode type definitions
├── store/slices/
│   └── electrodeSlice.ts          # Electrode state management
├── hooks/
│   └── useESPEEG.ts               # ESP-EEG connection (via WS bridge)
├── utils/
│   ├── spatialFeatures.ts         # Spatial feature extraction
│   └── brainflowExport.ts         # Brainflow export utilities
├── components/
│   └── ElectrodePlacementScreen.tsx
└── scripts/
    └── cerelog_ws_bridge.py       # WebSocket-to-TCP bridge
```

### Updated Files
- `src/store/index.ts` - Added ElectrodeSlice
- `src/types/decoders.ts` - Added electrode metadata to DecoderInput
- `src/hooks/useDecoder.ts` - Extracts spatial features if config available
- `src/components/visualization/index.ts` - Exported ElectrodePlacementPanel

## Data Flow

```
Cerelog ESP-EEG Device
    ↓ (TCP binary, port 1112)
cerelog_ws_bridge.py
    ↓ (WebSocket JSON)
useESPEEG Hook
    ↓ (signal quality estimation)
electrodeSlice (Zustand)
    ↓
ElectrodePlacementScreen (UI)
    ↓ (validation complete)
Brainflow Export
```

## ESP-EEG Binary Protocol

The Cerelog ESP-EEG streams binary packets on TCP port 1112.

### Packet Structure (37 bytes)

| Byte  | Field          | Description                                |
|-------|----------------|--------------------------------------------|
| 0-1   | Start Marker   | 0xABCD (big-endian)                        |
| 2     | Length         | 31 (fixed)                                 |
| 3-6   | Timestamp      | uint32, ms since connection (big-endian)   |
| 7-9   | ADS1299 Status | 3 status bytes                             |
| 10-33 | Channel Data   | 8 ch × 3 bytes (24-bit signed, big-endian) |
| 34    | Checksum       | (sum of bytes 2-33) & 0xFF                 |
| 35-36 | End Marker     | 0xDCBA (big-endian)                        |

### Converting Raw Values to Microvolts

```python
# ADS1299 voltage conversion
VREF = 4.50  # Reference voltage
GAIN = 24   # Gain setting

def to_microvolts(raw_24bit):
    # Sign extend 24-bit to 32-bit
    if raw_24bit & 0x800000:
        raw_24bit = raw_24bit - 0x1000000
    
    scale = (2 * VREF / GAIN) / (2**24)
    return raw_24bit * scale * 1e6
```

### WebSocket Bridge Protocol

The `cerelog_ws_bridge.py` script now acts as a pass-through proxy, forwarding raw binary packets from the TCP stream directly to the WebSocket client.

This means the browser receives the raw 37-byte packets:

```typescript
// Browser receives ArrayBuffer
const packet = new Uint8Array(event.data);

// [0-1]   0xABCD
// [2]     0x1F (31)
// ...
// [35-36] 0xDCBA
```

Parsing happens effectively on the client side in `src/hooks/useESPEEG.ts`.

### Device Discovery (UDP)

```python
# Send to 255.255.255.255:4445
b"CERELOG_FIND_ME"

# Device responds with
b"CERELOG_HERE"
```
```

## Spatial Features

When electrode configuration is available, decoders receive:

### ROI Averages
```typescript
{
  frontal: 12.3,    // Average activity in frontal region
  central: 8.7,
  parietal: 15.2,
  temporal: 6.4,
  occipital: 3.1
}
```

### Spatial Gradients
```typescript
{
  anteriorPosterior: [...],  // Activity gradient front→back
  leftRight: [...],           // Activity gradient left→right
  superiorInferior: [...]     // Activity gradient top→bottom
}
```

### Channel Mask
```typescript
[true, true, false, true, ...]  // Active/inactive per channel
```

## Usage in Custom Decoders

```javascript
// JavaScript decoder with electrode awareness
return (input) => {
  const { spikes, spatialFeatures, channelMask } = input;
  
  // Use ROI averages
  if (spatialFeatures?.roiAverages) {
    const motorActivity = spatialFeatures.roiAverages.central || 0;
    // Use motor cortex activity for movement prediction
  }
  
  // Apply channel mask
  const activeSpikes = channelMask 
    ? spikes.map((s, i) => channelMask[i] ? s : 0)
    : spikes;
  
  // Your decoding logic here
  return { x: 0, y: 0 };
};
```

## Testing

To test without physical hardware:

```typescript
// Simulate impedance data
const simulateImpedance = () => {
  const mockData = Array.from({ length: 8 }, (_, i) => ({
    channelId: i,
    electrodeId: `electrode-${i}`,
    impedance: Math.random() * 15, // 0-15 kΩ
    timestamp: Date.now(),
    quality: 'good' as const
  }));
  
  store.getState().batchUpdateImpedances(mockData);
};
```

## Questions & Answers

**Q: Can I use this with OpenBCI?**  
A: Yes! The export utilities generate Brainflow-compatible configs. Change the board_id when exporting.

**Q: Do I need to reconfigure electrodes every session?**  
A: No. Configurations are saved to localStorage and can be exported/imported as JSON.

**Q: What if my montage isn't 10-20?**  
A: Select "custom" montage and manually position electrodes (UI enhancement coming soon).

**Q: Can I use this with the existing PhantomLink workflow?**  
A: Yes! Electrode features are completely optional. Existing decoders work unchanged.

## License

Same as PhantomLoop main project.

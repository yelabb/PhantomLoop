# Cerelog ESP-EEG Integration

This branch adds electrode placement and impedance monitoring functionality for the Cerelog ESP-EEG device, preparing PhantomLoop for the transition to Brainflow.

## What's New

### 🎯 Electrode Placement Screen
- **Interactive electrode configuration UI** with support for 8, 16, 32, and 64-channel setups
- **Standard 10-20 montage** with predefined positions for common EEG electrodes
- **Real-time impedance monitoring** with color-coded quality indicators
- **Visual electrode layout** showing spatial positions and connection quality

### 📡 ESP-EEG Device Support
- **WebSocket connection** to Cerelog ESP-EEG devices (default: `ws://192.168.4.1:81`)
- **Live impedance streaming** with automatic quality assessment
- **Connection status monitoring** with auto-reconnect functionality
- **Dual data source support** - can switch between PhantomLink and ESP-EEG

### 🧠 Electrode-Aware Decoding
- **Spatial feature extraction** - ROI averages, spatial gradients, neighborhood correlations
- **Channel masking** - decoders can access active/inactive channel information
- **Enhanced decoder input** with electrode configuration and spatial features
- Backward compatible with existing decoders (electrode features are optional)

### 📤 Brainflow Export Utilities
- **JSON export** - Full electrode configuration in Brainflow-compatible format
- **CSV export** - Spreadsheet-friendly electrode data with positions and impedances
- **Python code generation** - Ready-to-use Brainflow integration script
- **Import/export workflow** - Save validated configurations for future sessions

## Quick Start

### 1. Access Electrode Placement

The ElectrodePlacementScreen is now **fully integrated** into the app navigation:

**User Flow:**
1. **WelcomeScreen** - Click "Configure Electrodes (ESP-EEG)" button
2. **ElectrodePlacementScreen** - Set up electrodes and monitor impedance
3. **ResearchDashboard** - Click "Proceed to Dashboard →" when ready

**Navigation Path:**
```
WelcomeScreen → ElectrodePlacementScreen → ResearchDashboard
     ↓                    ↓                          ↓
   Start         Configure Electrodes          View Decoders
```

You can navigate back at any time using the "← Back" button.

### 2. Connect to ESP-EEG
1. Power on your Cerelog ESP-EEG device
2. Connect to the ESP32 WiFi AP (usually `ESP-EEG-XXXX`)
3. Open PhantomLoop and navigate to Electrode Placement
4. Enter WebSocket URL (default: `ws://192.168.4.1:81`)
5. Click "Connect to ESP-EEG"
6. Monitor impedances in real-time

### 3. Configure Electrodes
- Select channel count (8/16/32/64)
- Choose montage type (10-20/10-10/custom)
- Apply configuration
- Verify impedance quality (target: <5 kΩ for "good")

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
│   └── useESPEEG.ts               # ESP-EEG WebSocket connection
├── utils/
│   ├── spatialFeatures.ts         # Spatial feature extraction
│   └── brainflowExport.ts         # Brainflow export utilities
└── components/
    ├── ElectrodePlacementScreen.tsx
    └── visualization/
        └── ElectrodePlacementPanel.tsx
```

### Updated Files
- `src/store/index.ts` - Added ElectrodeSlice
- `src/types/decoders.ts` - Added electrode metadata to DecoderInput
- `src/hooks/useDecoder.ts` - Extracts spatial features if config available
- `src/components/visualization/index.ts` - Exported ElectrodePlacementPanel

## Data Flow

```
ESP-EEG Device
    ↓ (WebSocket)
useESPEEG Hook
    ↓
electrodeSlice (Zustand)
    ↓
ElectrodePlacementScreen (UI)
    ↓ (validation complete)
Brainflow Export
    ↓
PhantomLink / Brainflow Fork
```

## Impedance Quality Thresholds

- **Good**: < 5 kΩ (green)
- **Fair**: 5-10 kΩ (yellow)
- **Poor**: 10-20 kΩ (orange)
- **Disconnected**: > 20 kΩ or no signal (red)

## Next Steps

### Before Brainflow Fork
1. ✅ Electrode placement UI *(completed)*
2. ✅ ESP-EEG connection *(completed)*
3. ✅ Impedance monitoring *(completed)*
4. ✅ Brainflow export *(completed)*
5. ⏳ Test with physical ESP-EEG device
6. ⏳ Validate impedance readings
7. ⏳ Fine-tune spatial features

### After Brainflow Fork
1. Replace PhantomLink WebSocket with Brainflow streaming
2. Implement live EEG data parsing
3. Add artifact detection/rejection
4. Enhance spatial decoders with validated electrode positions
5. Support multiple board types (OpenBCI, Muse, etc.)

## ESP-EEG Message Protocol

The `useESPEEG` hook expects messages in this format:

### Impedance Message
```json
{
  "type": "impedance",
  "timestamp": 1234567890,
  "payload": {
    "channels": [
      { "channel": 0, "impedance": 4.2 },
      { "channel": 1, "impedance": 5.8 },
      ...
    ]
  }
}
```

### Data Message (for future streaming)
```json
{
  "type": "data",
  "timestamp": 1234567890,
  "payload": {
    "samples": [[...], [...], ...],
    "sampleRate": 250
  }
}
```

### Status Message
```json
{
  "type": "status",
  "timestamp": 1234567890,
  "payload": {
    "connected": true,
    "battery": 85,
    "error": null
  }
}
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

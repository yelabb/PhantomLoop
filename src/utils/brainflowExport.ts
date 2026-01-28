/**
 * Brainflow Export Utilities
 * 
 * Convert electrode configurations to Brainflow-compatible formats.
 * Supports all major EEG hardware through device profiles.
 */

import type { ElectrodeConfiguration, ElectrodeInfo, DeviceType } from '../types/electrodes';
import { 
  BRAINFLOW_BOARD_IDS, 
  getDeviceProfile, 
  getBrainflowBoardId
} from '../devices/deviceProfiles';

// Re-export board IDs for convenience
export { BRAINFLOW_BOARD_IDS };

/**
 * Brainflow board configuration
 */
export interface BrainflowBoardConfig {
  board_id: number;
  serial_port?: string;
  mac_address?: string;
  ip_address?: string;
  ip_port?: number;
  file?: string;
  timeout?: number;
  serial_number?: string;
  other_info?: string;
}

/**
 * Brainflow channel metadata
 */
export interface BrainflowChannelMetadata {
  channel_index: number;
  channel_name: string;
  channel_type: 'EEG' | 'EMG' | 'ECG' | 'EOG' | 'AUX' | 'ACCEL' | 'GYRO' | 'OTHER';
  units: string;
  position?: {
    x: number;
    y: number;
    z: number;
  };
  impedance?: number;
  is_active: boolean;
}

/**
 * Complete Brainflow export format
 */
export interface BrainflowExportData {
  board_config: BrainflowBoardConfig;
  channels: BrainflowChannelMetadata[];
  montage: string;
  sampling_rate: number;
  created_at: string;
  device_info?: {
    device_id: string;
    device_name: string;
    manufacturer: string;
  };
  metadata: {
    source: string;
    version: string;
    notes?: string;
  };
}

/**
 * Get Brainflow board ID from device type
 */
export function getBoardIdFromDeviceType(deviceType: DeviceType): number {
  const deviceId = deviceType === 'brainflow-generic' ? 'synthetic' : deviceType;
  return getBrainflowBoardId(deviceId) ?? BRAINFLOW_BOARD_IDS.SYNTHETIC;
}

/**
 * Convert PhantomLoop electrode configuration to Brainflow format
 */
export function exportToBrainflow(
  electrodeConfig: ElectrodeConfiguration,
  boardId?: number,
  deviceConfig?: Partial<BrainflowBoardConfig>
): BrainflowExportData {
  // Auto-detect board ID from device type if not provided
  const resolvedBoardId = boardId ?? getBoardIdFromDeviceType(electrodeConfig.deviceType);
  const deviceProfile = getDeviceProfile(electrodeConfig.deviceType);
  
  const channels: BrainflowChannelMetadata[] = electrodeConfig.layout.electrodes.map(
    (electrode) => ({
      channel_index: electrode.channelIndex,
      channel_name: electrode.label,
      channel_type: 'EEG',
      units: 'µV',
      position: {
        x: electrode.position.x,
        y: electrode.position.y,
        z: electrode.position.z,
      },
      impedance: electrode.impedance,
      is_active: electrode.isActive,
    })
  );

  const boardConfig: BrainflowBoardConfig = {
    board_id: resolvedBoardId,
    timeout: 15,
    ...deviceConfig,
  };

  return {
    board_config: boardConfig,
    channels,
    montage: electrodeConfig.layout.montage,
    sampling_rate: electrodeConfig.samplingRate,
    created_at: new Date(electrodeConfig.createdAt).toISOString(),
    device_info: deviceProfile ? {
      device_id: deviceProfile.id,
      device_name: deviceProfile.name,
      manufacturer: deviceProfile.manufacturer,
    } : undefined,
    metadata: {
      source: 'PhantomLoop Electrode Placement',
      version: '1.0.0',
      notes: electrodeConfig.metadata?.notes,
    },
  };
}

/**
 * Export to JSON file (downloadable)
 */
export function exportToJSON(
  electrodeConfig: ElectrodeConfiguration,
  boardId?: number,
  deviceConfig?: Partial<BrainflowBoardConfig>
): string {
  const exportData = exportToBrainflow(electrodeConfig, boardId, deviceConfig);
  return JSON.stringify(exportData, null, 2);
}

/**
 * Export to CSV format (for spreadsheet analysis)
 */
export function exportToCSV(electrodeConfig: ElectrodeConfiguration): string {
  const headers = [
    'Channel',
    'Label',
    'Position_X',
    'Position_Y',
    'Position_Z',
    'Impedance_kOhm',
    'Quality',
    'Active',
    'Montage_Position',
  ];

  const rows = electrodeConfig.layout.electrodes.map((electrode) => [
    electrode.channelIndex.toString(),
    electrode.label,
    electrode.position.x.toFixed(4),
    electrode.position.y.toFixed(4),
    electrode.position.z.toFixed(4),
    electrode.impedance?.toFixed(2) || 'N/A',
    electrode.quality || 'unknown',
    electrode.isActive ? 'Yes' : 'No',
    electrode.montagePosition || 'custom',
  ]);

  const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  return csv;
}

/**
 * Trigger browser download of configuration file
 */
export function downloadConfiguration(
  electrodeConfig: ElectrodeConfiguration,
  format: 'json' | 'csv' = 'json',
  boardId?: number
) {
  let content: string;
  let filename: string;
  let mimeType: string;

  if (format === 'json') {
    content = exportToJSON(electrodeConfig, boardId);
    filename = `electrode-config-${electrodeConfig.name.replace(/\s+/g, '-')}.json`;
    mimeType = 'application/json';
  } else {
    content = exportToCSV(electrodeConfig);
    filename = `electrode-config-${electrodeConfig.name.replace(/\s+/g, '-')}.csv`;
    mimeType = 'text/csv';
  }

  // Create blob and trigger download
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import electrode configuration from Brainflow JSON
 */
export function importFromBrainflow(
  brainflowData: BrainflowExportData
): ElectrodeConfiguration {
  const electrodes: ElectrodeInfo[] = brainflowData.channels.map((channel) => ({
    id: `electrode-${channel.channel_index}`,
    channelIndex: channel.channel_index,
    label: channel.channel_name,
    position: channel.position || { x: 0, y: 0, z: 0 },
    impedance: channel.impedance,
    isActive: channel.is_active,
    quality: undefined, // Will be updated on connection
  }));

  // Determine device type from imported data
  const deviceType = brainflowData.device_info?.device_id as DeviceType ?? 'brainflow-generic';

  const config: ElectrodeConfiguration = {
    id: `imported-${Date.now()}`,
    name: brainflowData.device_info?.device_name 
      ? `Imported: ${brainflowData.device_info.device_name}`
      : `Imported from Brainflow`,
    deviceType,
    channelCount: electrodes.length,
    samplingRate: brainflowData.sampling_rate,
    layout: {
      name: `${brainflowData.montage} ${electrodes.length}-channel`,
      montage: brainflowData.montage as '10-20' | '10-10' | 'custom' | 'muse' | 'emotiv',
      electrodes,
    },
    createdAt: new Date(brainflowData.created_at).getTime(),
    updatedAt: Date.now(),
    metadata: {
      notes: brainflowData.metadata.notes,
    },
  };

  return config;
}

/**
 * Generate Python code snippet for Brainflow integration
 */
export function generateBrainflowPythonCode(
  electrodeConfig: ElectrodeConfiguration,
  boardId?: number
): string {
  const resolvedBoardId = boardId ?? getBoardIdFromDeviceType(electrodeConfig.deviceType);
  const exportData = exportToBrainflow(electrodeConfig, resolvedBoardId);
  const deviceProfile = getDeviceProfile(electrodeConfig.deviceType);
  
  // Get board ID constant name for cleaner code
  const boardIdName = Object.entries(BRAINFLOW_BOARD_IDS)
    .find(([, id]) => id === resolvedBoardId)?.[0] ?? 'SYNTHETIC';

  return `# Brainflow Integration - Generated from PhantomLoop
# Electrode configuration: ${electrodeConfig.name}
# Device: ${deviceProfile?.name ?? electrodeConfig.deviceType}
# Manufacturer: ${deviceProfile?.manufacturer ?? 'Unknown'}

from brainflow import BoardShim, BrainFlowInputParams, BoardIds
import numpy as np
import json

# ============================================================================
# BOARD CONFIGURATION
# ============================================================================

# Board ID: ${resolvedBoardId} (${boardIdName})
# See: https://brainflow.readthedocs.io/en/stable/SupportedBoards.html
BOARD_ID = ${resolvedBoardId}

params = BrainFlowInputParams()
${exportData.board_config.serial_port ? `params.serial_port = "${exportData.board_config.serial_port}"  # Serial port` : '# params.serial_port = "COM3"  # Uncomment for serial connection'}
${exportData.board_config.mac_address ? `params.mac_address = "${exportData.board_config.mac_address}"  # Bluetooth MAC` : '# params.mac_address = ""  # Uncomment for Bluetooth devices'}
${exportData.board_config.ip_address ? `params.ip_address = "${exportData.board_config.ip_address}"  # Device IP` : '# params.ip_address = ""  # Uncomment for WiFi devices'}
${exportData.board_config.ip_port ? `params.ip_port = ${exportData.board_config.ip_port}  # Device port` : '# params.ip_port = 0  # Uncomment for WiFi devices'}

# Initialize board
board = BoardShim(BOARD_ID, params)
board.prepare_session()

# ============================================================================
# CHANNEL CONFIGURATION
# ============================================================================

# Channel mapping (from PhantomLoop electrode configuration)
CHANNEL_MAPPING = {
${exportData.channels
  .map((ch) => `    ${ch.channel_index}: "${ch.channel_name}",  # ${ch.position ? `(${ch.position.x.toFixed(2)}, ${ch.position.y.toFixed(2)}, ${ch.position.z.toFixed(2)})` : 'No position'}`)
  .join('\n')}
}

# Active channels
ACTIVE_CHANNELS = [${exportData.channels.filter((ch) => ch.is_active).map((ch) => ch.channel_index).join(', ')}]

# Sampling rate: ${exportData.sampling_rate} Hz
SAMPLING_RATE = ${exportData.sampling_rate}

# Montage: ${exportData.montage}
MONTAGE = "${exportData.montage}"

# ============================================================================
# DATA ACQUISITION
# ============================================================================

def get_eeg_channels():
    """Get EEG channel indices from Brainflow."""
    return BoardShim.get_eeg_channels(BOARD_ID)

def start_stream(buffer_size=45000):
    """Start data streaming."""
    board.start_stream(buffer_size)
    print(f"Streaming from {len(ACTIVE_CHANNELS)} active channels at {SAMPLING_RATE} Hz...")

def get_data(num_samples=250):
    """Get recent data from board."""
    data = board.get_current_board_data(num_samples)
    eeg_channels = get_eeg_channels()
    return data[eeg_channels, :]

def stop_stream():
    """Stop streaming and release session."""
    board.stop_stream()
    board.release_session()
    print("Stream stopped.")

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    try:
        start_stream()
        
        # Example: Get 1 second of data
        import time
        time.sleep(1)
        data = get_data(SAMPLING_RATE)
        
        print(f"Got data shape: {data.shape}")
        print(f"Channel means: {np.mean(data, axis=1)}")
        
        # Your decoding code here
        # ...
        
    finally:
        stop_stream()
`;
}

/**
 * Download Python integration code
 */
export function downloadBrainflowPythonCode(
  electrodeConfig: ElectrodeConfiguration,
  boardId?: number
) {
  const code = generateBrainflowPythonCode(electrodeConfig, boardId);
  const filename = `brainflow-integration-${electrodeConfig.name.replace(/\s+/g, '-')}.py`;
  
  const blob = new Blob([code], { type: 'text/x-python' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Brainflow Export Utilities
 * Convert electrode configurations to Brainflow-compatible formats
 */

import type { ElectrodeConfiguration, ElectrodeInfo } from '../types/electrodes';

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
  metadata: {
    source: string;
    version: string;
    notes?: string;
  };
}

/**
 * Convert PhantomLoop electrode configuration to Brainflow format
 */
export function exportToBrainflow(
  electrodeConfig: ElectrodeConfiguration,
  boardId: number = -1, // -1 = Synthetic board
  deviceConfig?: Partial<BrainflowBoardConfig>
): BrainflowExportData {
  const channels: BrainflowChannelMetadata[] = electrodeConfig.layout.electrodes.map(
    (electrode) => ({
      channel_index: electrode.channelIndex,
      channel_name: electrode.label,
      channel_type: 'EEG', // Assuming EEG for Cerelog esp-eeg
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
    board_id: boardId,
    timeout: 15,
    ...deviceConfig,
  };

  return {
    board_config: boardConfig,
    channels,
    montage: electrodeConfig.layout.montage,
    sampling_rate: electrodeConfig.samplingRate,
    created_at: new Date(electrodeConfig.createdAt).toISOString(),
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

  const config: ElectrodeConfiguration = {
    id: `imported-${Date.now()}`,
    name: `Imported from Brainflow`,
    deviceType: 'brainflow',
    channelCount: electrodes.length,
    samplingRate: brainflowData.sampling_rate,
    layout: {
      name: `${brainflowData.montage} ${electrodes.length}-channel`,
      montage: brainflowData.montage as '10-20' | '10-10' | 'custom',
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
  boardId: number = 38 // 38 = Synthetic board
): string {
  const exportData = exportToBrainflow(electrodeConfig, boardId);

  return `# Brainflow Integration - Generated from PhantomLoop
# Electrode configuration: ${electrodeConfig.name}

from brainflow import BoardShim, BrainFlowInputParams, BoardIds
import json

# Board configuration
params = BrainFlowInputParams()
${exportData.board_config.serial_port ? `params.serial_port = "${exportData.board_config.serial_port}"` : ''}
${exportData.board_config.ip_address ? `params.ip_address = "${exportData.board_config.ip_address}"` : ''}
${exportData.board_config.ip_port ? `params.ip_port = ${exportData.board_config.ip_port}` : ''}

# Initialize board
board = BoardShim(${boardId}, params)
board.prepare_session()

# Channel mapping (from PhantomLoop electrode configuration)
channel_mapping = {
${exportData.channels
  .map((ch) => `    ${ch.channel_index}: "${ch.channel_name}"  # ${ch.position ? `Position: (${ch.position.x.toFixed(2)}, ${ch.position.y.toFixed(2)}, ${ch.position.z.toFixed(2)})` : 'No position'}`)
  .join(',\n')}
}

# Active channels only
active_channels = [${exportData.channels.filter((ch) => ch.is_active).map((ch) => ch.channel_index).join(', ')}]

# Sampling rate: ${exportData.sampling_rate} Hz
# Montage: ${exportData.montage}

# Start streaming
board.start_stream()
print(f"Streaming from {len(active_channels)} active channels...")

# Your decoding code here
# ...

# Stop and release
board.stop_stream()
board.release_session()`;
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

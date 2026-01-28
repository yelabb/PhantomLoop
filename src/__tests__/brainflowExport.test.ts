/**
 * Unit tests for Brainflow Export Utilities
 * Tests conversion between PhantomLoop electrode configurations and Brainflow formats
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  exportToBrainflow,
  exportToJSON,
  exportToCSV,
  importFromBrainflow,
  generateBrainflowPythonCode,
  type BrainflowExportData,
  type BrainflowBoardConfig,
} from '../utils/brainflowExport';
import type { ElectrodeConfiguration } from '../types/electrodes';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestElectrodeConfig(overrides?: Partial<ElectrodeConfiguration>): ElectrodeConfiguration {
  return {
    id: 'test-config-001',
    name: 'Test 8-Channel Config',
    deviceType: 'esp-eeg',
    channelCount: 8,
    samplingRate: 250,
    layout: {
      name: 'Standard 10-20 8-channel',
      montage: '10-20',
      electrodes: [
        { id: 'e-0', channelIndex: 0, label: 'Fp1', position: { x: -0.31, y: 0.95, z: 0.0 }, impedance: 15, isActive: true, quality: 'good' },
        { id: 'e-1', channelIndex: 1, label: 'Fp2', position: { x: 0.31, y: 0.95, z: 0.0 }, impedance: 12, isActive: true, quality: 'good' },
        { id: 'e-2', channelIndex: 2, label: 'F3', position: { x: -0.55, y: 0.67, z: 0.16 }, impedance: 25, isActive: true, quality: 'fair' },
        { id: 'e-3', channelIndex: 3, label: 'F4', position: { x: 0.55, y: 0.67, z: 0.16 }, impedance: 18, isActive: true, quality: 'good' },
        { id: 'e-4', channelIndex: 4, label: 'C3', position: { x: -0.71, y: 0.0, z: 0.71 }, impedance: 45, isActive: true, quality: 'poor' },
        { id: 'e-5', channelIndex: 5, label: 'C4', position: { x: 0.71, y: 0.0, z: 0.71 }, impedance: 20, isActive: true, quality: 'good' },
        { id: 'e-6', channelIndex: 6, label: 'O1', position: { x: -0.31, y: -0.95, z: 0.0 }, impedance: 999, isActive: false, quality: 'disconnected' },
        { id: 'e-7', channelIndex: 7, label: 'O2', position: { x: 0.31, y: -0.95, z: 0.0 }, impedance: 22, isActive: true, quality: 'good' },
      ],
    },
    createdAt: 1700000000000,
    updatedAt: 1700000100000,
    metadata: {
      subject: 'Test Subject',
      session: 'Session 001',
      notes: 'Test configuration for unit tests',
    },
    ...overrides,
  };
}

function createMinimalElectrodeConfig(): ElectrodeConfiguration {
  return {
    id: 'minimal-001',
    name: 'Minimal Config',
    deviceType: 'esp-eeg',
    channelCount: 1,
    samplingRate: 250,
    layout: {
      name: 'Single channel',
      montage: 'custom',
      electrodes: [
        { id: 'e-0', channelIndex: 0, label: 'Ch1', position: { x: 0, y: 0, z: 1 }, isActive: true },
      ],
    },
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };
}

// ============================================================================
// exportToBrainflow Tests
// ============================================================================

describe('exportToBrainflow', () => {
  it('should convert electrode configuration to Brainflow format', () => {
    const config = createTestElectrodeConfig();
    const result = exportToBrainflow(config);

    expect(result.board_config.board_id).toBe(-1); // Default synthetic board
    expect(result.board_config.timeout).toBe(15);
    expect(result.channels).toHaveLength(8);
    expect(result.montage).toBe('10-20');
    expect(result.sampling_rate).toBe(250);
    expect(result.metadata.source).toBe('PhantomLoop Electrode Placement');
    expect(result.metadata.version).toBe('1.0.0');
    expect(result.metadata.notes).toBe('Test configuration for unit tests');
  });

  it('should correctly map channel metadata', () => {
    const config = createTestElectrodeConfig();
    const result = exportToBrainflow(config);

    const ch0 = result.channels[0];
    expect(ch0.channel_index).toBe(0);
    expect(ch0.channel_name).toBe('Fp1');
    expect(ch0.channel_type).toBe('EEG');
    expect(ch0.units).toBe('µV');
    expect(ch0.position).toEqual({ x: -0.31, y: 0.95, z: 0.0 });
    expect(ch0.impedance).toBe(15);
    expect(ch0.is_active).toBe(true);
  });

  it('should handle inactive channels', () => {
    const config = createTestElectrodeConfig();
    const result = exportToBrainflow(config);

    const ch6 = result.channels[6]; // O1 is inactive
    expect(ch6.channel_name).toBe('O1');
    expect(ch6.is_active).toBe(false);
    expect(ch6.impedance).toBe(999);
  });

  it('should use custom board ID when provided', () => {
    const config = createTestElectrodeConfig();
    const result = exportToBrainflow(config, 38); // Synthetic board

    expect(result.board_config.board_id).toBe(38);
  });

  it('should merge device config options', () => {
    const config = createTestElectrodeConfig();
    const deviceConfig: Partial<BrainflowBoardConfig> = {
      serial_port: 'COM3',
      ip_address: '192.168.4.1',
      ip_port: 1112,
    };
    const result = exportToBrainflow(config, 0, deviceConfig);

    expect(result.board_config.serial_port).toBe('COM3');
    expect(result.board_config.ip_address).toBe('192.168.4.1');
    expect(result.board_config.ip_port).toBe(1112);
    expect(result.board_config.board_id).toBe(0);
  });

  it('should format created_at as ISO string', () => {
    const config = createTestElectrodeConfig();
    const result = exportToBrainflow(config);

    expect(result.created_at).toBe('2023-11-14T22:13:20.000Z');
    expect(() => new Date(result.created_at)).not.toThrow();
  });

  it('should handle config without metadata notes', () => {
    const config = createMinimalElectrodeConfig();
    const result = exportToBrainflow(config);

    expect(result.metadata.notes).toBeUndefined();
  });
});

// ============================================================================
// exportToJSON Tests
// ============================================================================

describe('exportToJSON', () => {
  it('should produce valid JSON string', () => {
    const config = createTestElectrodeConfig();
    const json = exportToJSON(config);

    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.board_config).toBeDefined();
    expect(parsed.channels).toHaveLength(8);
  });

  it('should be properly formatted with indentation', () => {
    const config = createMinimalElectrodeConfig();
    const json = exportToJSON(config);

    // Pretty-printed JSON has newlines
    expect(json).toContain('\n');
    expect(json).toContain('  '); // 2-space indentation
  });

  it('should include all export data fields', () => {
    const config = createTestElectrodeConfig();
    const parsed = JSON.parse(exportToJSON(config));

    expect(parsed).toHaveProperty('board_config');
    expect(parsed).toHaveProperty('channels');
    expect(parsed).toHaveProperty('montage');
    expect(parsed).toHaveProperty('sampling_rate');
    expect(parsed).toHaveProperty('created_at');
    expect(parsed).toHaveProperty('metadata');
  });

  it('should pass through custom board ID', () => {
    const config = createTestElectrodeConfig();
    const json = exportToJSON(config, 38);
    const parsed = JSON.parse(json);

    expect(parsed.board_config.board_id).toBe(38);
  });
});

// ============================================================================
// exportToCSV Tests
// ============================================================================

describe('exportToCSV', () => {
  it('should produce valid CSV with headers', () => {
    const config = createTestElectrodeConfig();
    const csv = exportToCSV(config);

    const lines = csv.split('\n');
    expect(lines[0]).toBe('Channel,Label,Position_X,Position_Y,Position_Z,Impedance_kOhm,Quality,Active,Montage_Position');
    expect(lines).toHaveLength(9); // 1 header + 8 electrodes
  });

  it('should include all electrode data', () => {
    const config = createTestElectrodeConfig();
    const csv = exportToCSV(config);
    const lines = csv.split('\n');

    // Check first electrode (Fp1)
    const fp1Line = lines[1].split(',');
    expect(fp1Line[0]).toBe('0'); // Channel index
    expect(fp1Line[1]).toBe('Fp1'); // Label
    expect(fp1Line[2]).toBe('-0.3100'); // Position X
    expect(fp1Line[3]).toBe('0.9500'); // Position Y
    expect(fp1Line[4]).toBe('0.0000'); // Position Z
    expect(fp1Line[5]).toBe('15.00'); // Impedance
    expect(fp1Line[6]).toBe('good'); // Quality
    expect(fp1Line[7]).toBe('Yes'); // Active
  });

  it('should handle missing impedance as N/A', () => {
    const config = createMinimalElectrodeConfig();
    const csv = exportToCSV(config);
    const lines = csv.split('\n');

    const dataLine = lines[1].split(',');
    expect(dataLine[5]).toBe('N/A'); // Impedance
  });

  it('should show inactive channels as No', () => {
    const config = createTestElectrodeConfig();
    const csv = exportToCSV(config);
    const lines = csv.split('\n');

    // Channel 6 (O1) is inactive
    const o1Line = lines[7].split(',');
    expect(o1Line[7]).toBe('No');
  });

  it('should handle missing quality as unknown', () => {
    const config = createMinimalElectrodeConfig();
    const csv = exportToCSV(config);
    const lines = csv.split('\n');

    const dataLine = lines[1].split(',');
    expect(dataLine[6]).toBe('unknown');
  });
});

// ============================================================================
// importFromBrainflow Tests
// ============================================================================

describe('importFromBrainflow', () => {
  let brainflowData: BrainflowExportData;

  beforeEach(() => {
    brainflowData = {
      board_config: { board_id: 38, timeout: 15 },
      channels: [
        { channel_index: 0, channel_name: 'Fp1', channel_type: 'EEG', units: 'µV', position: { x: -0.31, y: 0.95, z: 0.0 }, impedance: 15, is_active: true },
        { channel_index: 1, channel_name: 'Fp2', channel_type: 'EEG', units: 'µV', position: { x: 0.31, y: 0.95, z: 0.0 }, impedance: 12, is_active: true },
      ],
      montage: '10-20',
      sampling_rate: 250,
      created_at: '2023-11-14T22:13:20.000Z',
      metadata: {
        source: 'PhantomLoop',
        version: '1.0.0',
        notes: 'Imported config',
      },
    };
  });

  it('should convert Brainflow data to ElectrodeConfiguration', () => {
    const config = importFromBrainflow(brainflowData);

    expect(config.name).toBe('Imported from Brainflow');
    expect(config.deviceType).toBe('brainflow-generic');
    expect(config.channelCount).toBe(2);
    expect(config.samplingRate).toBe(250);
    expect(config.layout.montage).toBe('10-20');
    expect(config.layout.electrodes).toHaveLength(2);
  });

  it('should map channel data to electrodes correctly', () => {
    const config = importFromBrainflow(brainflowData);

    const fp1 = config.layout.electrodes[0];
    expect(fp1.channelIndex).toBe(0);
    expect(fp1.label).toBe('Fp1');
    expect(fp1.position).toEqual({ x: -0.31, y: 0.95, z: 0.0 });
    expect(fp1.impedance).toBe(15);
    expect(fp1.isActive).toBe(true);
  });

  it('should generate unique IDs', () => {
    const config = importFromBrainflow(brainflowData);

    expect(config.id).toMatch(/^imported-\d+$/);
    expect(config.layout.electrodes[0].id).toBe('electrode-0');
    expect(config.layout.electrodes[1].id).toBe('electrode-1');
  });

  it('should preserve metadata notes', () => {
    const config = importFromBrainflow(brainflowData);

    expect(config.metadata?.notes).toBe('Imported config');
  });

  it('should handle channels without position', () => {
    brainflowData.channels[0].position = undefined;
    const config = importFromBrainflow(brainflowData);

    expect(config.layout.electrodes[0].position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('should roundtrip export/import correctly', () => {
    const original = createTestElectrodeConfig();
    const exported = exportToBrainflow(original);
    const imported = importFromBrainflow(exported);

    expect(imported.channelCount).toBe(original.channelCount);
    expect(imported.samplingRate).toBe(original.samplingRate);
    expect(imported.layout.montage).toBe(original.layout.montage);
    expect(imported.layout.electrodes).toHaveLength(original.layout.electrodes.length);

    // Check electrode data preserved
    for (let i = 0; i < original.layout.electrodes.length; i++) {
      const orig = original.layout.electrodes[i];
      const imp = imported.layout.electrodes[i];
      expect(imp.channelIndex).toBe(orig.channelIndex);
      expect(imp.label).toBe(orig.label);
      expect(imp.position).toEqual(orig.position);
      expect(imp.impedance).toBe(orig.impedance);
      expect(imp.isActive).toBe(orig.isActive);
    }
  });
});

// ============================================================================
// generateBrainflowPythonCode Tests
// ============================================================================

describe('generateBrainflowPythonCode', () => {
  it('should generate valid Python code structure', () => {
    const config = createTestElectrodeConfig();
    const code = generateBrainflowPythonCode(config);

    // Check essential Python imports
    expect(code).toContain('from brainflow import BoardShim, BrainFlowInputParams, BoardIds');
    expect(code).toContain('import json');

    // Check board initialization
    expect(code).toContain('params = BrainFlowInputParams()');
    expect(code).toContain('board = BoardShim(BOARD_ID, params)');
    expect(code).toContain('board.prepare_session()');
  });

  it('should include channel mapping from electrode config', () => {
    const config = createTestElectrodeConfig();
    const code = generateBrainflowPythonCode(config);

    expect(code).toContain('CHANNEL_MAPPING = {');
    expect(code).toContain('0: "Fp1"');
    expect(code).toContain('1: "Fp2"');
    expect(code).toContain('7: "O2"');
  });

  it('should include position comments in channel mapping', () => {
    const config = createTestElectrodeConfig();
    const code = generateBrainflowPythonCode(config);

    // Position is now in compact inline comment format
    expect(code).toContain('# (-0.31, 0.95, 0.00)');
  });

  it('should list only active channels', () => {
    const config = createTestElectrodeConfig();
    const code = generateBrainflowPythonCode(config);

    // Channel 6 (O1) is inactive
    expect(code).toContain('ACTIVE_CHANNELS = [0, 1, 2, 3, 4, 5, 7]');
    expect(code).not.toContain('ACTIVE_CHANNELS = [0, 1, 2, 3, 4, 5, 6, 7]');
  });

  it('should include sampling rate and montage', () => {
    const config = createTestElectrodeConfig();
    const code = generateBrainflowPythonCode(config);

    expect(code).toContain('# Sampling rate: 250 Hz');
    expect(code).toContain('# Montage: 10-20');
  });

  it('should include config name in header', () => {
    const config = createTestElectrodeConfig();
    const code = generateBrainflowPythonCode(config);

    expect(code).toContain('# Electrode configuration: Test 8-Channel Config');
  });

  it('should use custom board ID when provided', () => {
    const config = createTestElectrodeConfig();
    const code = generateBrainflowPythonCode(config, 0); // Cyton board

    expect(code).toContain('BOARD_ID = 0');
  });

  it('should include device config in params when provided', () => {
    const config = createTestElectrodeConfig();
    // Export with IP config to test params output
    const exported = exportToBrainflow(config, 0, { ip_address: '192.168.4.1', ip_port: 1112 });

    expect(exported.board_config.ip_address).toBe('192.168.4.1');
    expect(exported.board_config.ip_port).toBe(1112);
  });

  it('should include streaming boilerplate', () => {
    const config = createTestElectrodeConfig();
    const code = generateBrainflowPythonCode(config);

    // Wrapped in helper functions
    expect(code).toContain('def start_stream');
    expect(code).toContain('board.start_stream(buffer_size)');
    expect(code).toContain('board.stop_stream()');
    expect(code).toContain('board.release_session()');
  });

  it('should handle all-active channels', () => {
    const config: ElectrodeConfiguration = {
      ...createMinimalElectrodeConfig(),
      layout: {
        name: 'All active',
        montage: 'custom',
        electrodes: [
          { id: 'e-0', channelIndex: 0, label: 'A', position: { x: 0, y: 0, z: 1 }, isActive: true },
          { id: 'e-1', channelIndex: 1, label: 'B', position: { x: 1, y: 0, z: 0 }, isActive: true },
        ],
      },
    };
    const code = generateBrainflowPythonCode(config);

    expect(code).toContain('ACTIVE_CHANNELS = [0, 1]');
  });

  it('should handle no active channels', () => {
    const config: ElectrodeConfiguration = {
      ...createMinimalElectrodeConfig(),
      layout: {
        name: 'None active',
        montage: 'custom',
        electrodes: [
          { id: 'e-0', channelIndex: 0, label: 'A', position: { x: 0, y: 0, z: 1 }, isActive: false },
        ],
      },
    };
    const code = generateBrainflowPythonCode(config);

    expect(code).toContain('ACTIVE_CHANNELS = []');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge cases', () => {
  it('should handle electrode config with empty electrodes array', () => {
    const config: ElectrodeConfiguration = {
      ...createMinimalElectrodeConfig(),
      channelCount: 0,
      layout: {
        name: 'Empty',
        montage: 'custom',
        electrodes: [],
      },
    };

    const brainflow = exportToBrainflow(config);
    expect(brainflow.channels).toHaveLength(0);

    const csv = exportToCSV(config);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1); // Just headers

    const json = exportToJSON(config);
    const parsed = JSON.parse(json);
    expect(parsed.channels).toHaveLength(0);

    const python = generateBrainflowPythonCode(config);
    expect(python).toContain('ACTIVE_CHANNELS = []');
  });

  it('should handle special characters in config name', () => {
    const config = createTestElectrodeConfig({
      name: 'Test "Config" with <special> & chars',
    });

    const json = exportToJSON(config);
    expect(() => JSON.parse(json)).not.toThrow();

    const python = generateBrainflowPythonCode(config);
    expect(python).toContain('# Electrode configuration: Test "Config" with <special> & chars');
  });

  it('should handle very long electrode labels', () => {
    const config: ElectrodeConfiguration = {
      ...createMinimalElectrodeConfig(),
      layout: {
        name: 'Long labels',
        montage: 'custom',
        electrodes: [
          { id: 'e-0', channelIndex: 0, label: 'VeryLongElectrodeLabelForTesting', position: { x: 0, y: 0, z: 1 }, isActive: true },
        ],
      },
    };

    const csv = exportToCSV(config);
    expect(csv).toContain('VeryLongElectrodeLabelForTesting');

    const python = generateBrainflowPythonCode(config);
    expect(python).toContain('"VeryLongElectrodeLabelForTesting"');
  });

  it('should handle negative channel indices (theoretical)', () => {
    const config: ElectrodeConfiguration = {
      ...createMinimalElectrodeConfig(),
      layout: {
        name: 'Negative index',
        montage: 'custom',
        electrodes: [
          { id: 'e-0', channelIndex: -1, label: 'Neg', position: { x: 0, y: 0, z: 1 }, isActive: true },
        ],
      },
    };

    const brainflow = exportToBrainflow(config);
    expect(brainflow.channels[0].channel_index).toBe(-1);
  });

  it('should handle extreme position values', () => {
    const config: ElectrodeConfiguration = {
      ...createMinimalElectrodeConfig(),
      layout: {
        name: 'Extreme positions',
        montage: 'custom',
        electrodes: [
          { id: 'e-0', channelIndex: 0, label: 'Ext', position: { x: 1000.123456, y: -1000.654321, z: 0.0000001 }, isActive: true },
        ],
      },
    };

    const csv = exportToCSV(config);
    expect(csv).toContain('1000.1235'); // 4 decimal places
    expect(csv).toContain('-1000.6543');
    expect(csv).toContain('0.0000');
  });
});

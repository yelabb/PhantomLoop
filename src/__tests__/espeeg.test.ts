/**
 * Unit tests for Cerelog ESP-EEG protocol implementation
 * Tests binary packet parsing, signal quality estimation, and voltage conversion
 */

import { describe, it, expect } from 'vitest';
import {
  CERELOG_PROTOCOL,
  SIGNAL_THRESHOLDS,
  parseADS1299ToMicrovolts,
  parsePacket,
  estimateQualityFromSignal,
  estimatePseudoImpedance,
} from '../hooks/useESPEEG';

/**
 * Helper to create a valid 37-byte ESP-EEG packet
 */
function createValidPacket(options: {
  timestamp?: number;
  status?: number;
  channels?: number[]; // Raw 24-bit values (not µV)
} = {}): Uint8Array {
  const {
    timestamp = 1000,
    status = 0xC00000, // Normal ADS1299 status
    channels = [0, 0, 0, 0, 0, 0, 0, 0],
  } = options;

  const packet = new Uint8Array(37);

  // Start marker (0xABCD)
  packet[0] = 0xAB;
  packet[1] = 0xCD;

  // Length
  packet[2] = 31;

  // Timestamp (big-endian uint32)
  packet[3] = (timestamp >> 24) & 0xFF;
  packet[4] = (timestamp >> 16) & 0xFF;
  packet[5] = (timestamp >> 8) & 0xFF;
  packet[6] = timestamp & 0xFF;

  // ADS1299 Status (3 bytes)
  packet[7] = (status >> 16) & 0xFF;
  packet[8] = (status >> 8) & 0xFF;
  packet[9] = status & 0xFF;

  // 8 channels × 3 bytes each (24-bit signed, big-endian)
  for (let ch = 0; ch < 8; ch++) {
    const value = channels[ch] || 0;
    const offset = 10 + ch * 3;
    packet[offset] = (value >> 16) & 0xFF;
    packet[offset + 1] = (value >> 8) & 0xFF;
    packet[offset + 2] = value & 0xFF;
  }

  // Checksum (sum of bytes 2-33 & 0xFF)
  let checksum = 0;
  for (let i = 2; i < 34; i++) {
    checksum = (checksum + packet[i]) & 0xFF;
  }
  packet[34] = checksum;

  // End marker (0xDCBA)
  packet[35] = 0xDC;
  packet[36] = 0xBA;

  return packet;
}

describe('CERELOG_PROTOCOL constants', () => {
  it('should have correct WiFi credentials', () => {
    expect(CERELOG_PROTOCOL.WIFI_SSID).toBe('CERELOG_EEG');
    expect(CERELOG_PROTOCOL.WIFI_PASSWORD).toBe('cerelog123');
  });

  it('should have correct network configuration', () => {
    expect(CERELOG_PROTOCOL.DEVICE_IP).toBe('192.168.4.1');
    expect(CERELOG_PROTOCOL.TCP_PORT).toBe(1112);
    expect(CERELOG_PROTOCOL.UDP_DISCOVERY_PORT).toBe(4445);
  });

  it('should have correct packet structure constants', () => {
    expect(CERELOG_PROTOCOL.PACKET_SIZE).toBe(37);
    expect(CERELOG_PROTOCOL.START_MARKER).toBe(0xABCD);
    expect(CERELOG_PROTOCOL.END_MARKER).toBe(0xDCBA);
  });

  it('should have correct ADS1299 hardware specs', () => {
    expect(CERELOG_PROTOCOL.SAMPLING_RATE).toBe(250);
    expect(CERELOG_PROTOCOL.NUM_CHANNELS).toBe(8);
    expect(CERELOG_PROTOCOL.BYTES_PER_CHANNEL).toBe(3);
    expect(CERELOG_PROTOCOL.STATUS_BYTES).toBe(3);
    expect(CERELOG_PROTOCOL.VREF).toBe(4.50);
    expect(CERELOG_PROTOCOL.GAIN).toBe(24);
  });
});

describe('SIGNAL_THRESHOLDS', () => {
  it('should have reasonable thresholds for EEG signals', () => {
    expect(SIGNAL_THRESHOLDS.NOISE_FLOOR_UV).toBe(5);
    expect(SIGNAL_THRESHOLDS.GOOD_MAX_UV).toBe(100);
    expect(SIGNAL_THRESHOLDS.FAIR_MAX_UV).toBe(200);
    expect(SIGNAL_THRESHOLDS.POOR_MAX_UV).toBe(500);
  });

  it('should have thresholds in ascending order', () => {
    expect(SIGNAL_THRESHOLDS.NOISE_FLOOR_UV).toBeLessThan(SIGNAL_THRESHOLDS.GOOD_MAX_UV);
    expect(SIGNAL_THRESHOLDS.GOOD_MAX_UV).toBeLessThan(SIGNAL_THRESHOLDS.FAIR_MAX_UV);
    expect(SIGNAL_THRESHOLDS.FAIR_MAX_UV).toBeLessThan(SIGNAL_THRESHOLDS.POOR_MAX_UV);
  });
});

describe('parseADS1299ToMicrovolts', () => {
  it('should convert zero to zero µV', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00]);
    const result = parseADS1299ToMicrovolts(bytes, 0);
    expect(result).toBe(0);
  });

  it('should convert positive 24-bit values correctly', () => {
    // Small positive value
    const bytes = new Uint8Array([0x00, 0x01, 0x00]); // 256 in 24-bit
    const result = parseADS1299ToMicrovolts(bytes, 0);
    
    // Expected: 256 * (2 * 4.50 / 24) / 2^24 * 1e6
    const expectedScale = (2 * 4.50 / 24) / Math.pow(2, 24);
    const expected = 256 * expectedScale * 1e6;
    
    expect(result).toBeCloseTo(expected, 6);
  });

  it('should handle negative 24-bit values (sign extension)', () => {
    // 0xFFFFFF = -1 in signed 24-bit
    const bytes = new Uint8Array([0xFF, 0xFF, 0xFF]);
    const result = parseADS1299ToMicrovolts(bytes, 0);
    
    const expectedScale = (2 * 4.50 / 24) / Math.pow(2, 24);
    const expected = -1 * expectedScale * 1e6;
    
    expect(result).toBeCloseTo(expected, 6);
  });

  it('should handle 0x800000 as most negative value', () => {
    // 0x800000 = -8388608 in signed 24-bit
    const bytes = new Uint8Array([0x80, 0x00, 0x00]);
    const result = parseADS1299ToMicrovolts(bytes, 0);
    
    const expectedScale = (2 * 4.50 / 24) / Math.pow(2, 24);
    const expected = -8388608 * expectedScale * 1e6;
    
    expect(result).toBeCloseTo(expected, 2);
  });

  it('should handle 0x7FFFFF as most positive value', () => {
    // 0x7FFFFF = 8388607 in signed 24-bit
    const bytes = new Uint8Array([0x7F, 0xFF, 0xFF]);
    const result = parseADS1299ToMicrovolts(bytes, 0);
    
    const expectedScale = (2 * 4.50 / 24) / Math.pow(2, 24);
    const expected = 8388607 * expectedScale * 1e6;
    
    expect(result).toBeCloseTo(expected, 2);
  });

  it('should use correct offset parameter', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01, 0x00]); // Value at offset 3
    const result = parseADS1299ToMicrovolts(bytes, 3);
    
    const expectedScale = (2 * 4.50 / 24) / Math.pow(2, 24);
    const expected = 256 * expectedScale * 1e6;
    
    expect(result).toBeCloseTo(expected, 6);
  });
});

describe('parsePacket', () => {
  it('should parse a valid packet correctly', () => {
    const packet = createValidPacket({ timestamp: 5000 });
    const result = parsePacket(packet);

    expect(result).not.toBeNull();
    expect(result!.timestamp).toBe(5000);
    expect(result!.channels).toHaveLength(8);
    expect(result!.status).toBe(0xC00000);
  });

  it('should return null for wrong packet size', () => {
    const shortPacket = new Uint8Array(36);
    const longPacket = new Uint8Array(38);

    expect(parsePacket(shortPacket)).toBeNull();
    expect(parsePacket(longPacket)).toBeNull();
  });

  it('should return null for invalid start marker', () => {
    const packet = createValidPacket();
    packet[0] = 0x00; // Corrupt start marker

    expect(parsePacket(packet)).toBeNull();
  });

  it('should return null for invalid end marker', () => {
    const packet = createValidPacket();
    packet[35] = 0x00; // Corrupt end marker

    expect(parsePacket(packet)).toBeNull();
  });

  it('should return null for invalid checksum', () => {
    const packet = createValidPacket();
    packet[34] = (packet[34] + 1) & 0xFF; // Corrupt checksum

    expect(parsePacket(packet)).toBeNull();
  });

  it('should parse channel values correctly', () => {
    // Set channel 0 to a known positive value
    const channelValue = 0x001000; // 4096
    const packet = createValidPacket({ channels: [channelValue, 0, 0, 0, 0, 0, 0, 0] });
    const result = parsePacket(packet);

    expect(result).not.toBeNull();
    
    const expectedScale = (2 * 4.50 / 24) / Math.pow(2, 24);
    const expectedMicrovolts = channelValue * expectedScale * 1e6;
    
    expect(result!.channels[0]).toBeCloseTo(expectedMicrovolts, 4);
  });

  it('should parse timestamp as big-endian uint32', () => {
    const packet = createValidPacket({ timestamp: 0x12345678 });
    const result = parsePacket(packet);

    expect(result).not.toBeNull();
    expect(result!.timestamp).toBe(0x12345678);
  });

  it('should handle all 8 channels', () => {
    const channels = [100, 200, 300, 400, 500, 600, 700, 800];
    const packet = createValidPacket({ channels });
    const result = parsePacket(packet);

    expect(result).not.toBeNull();
    expect(result!.channels).toHaveLength(8);
    
    // Verify each channel is parsed (values will be converted to µV)
    for (let i = 0; i < 8; i++) {
      const expectedScale = (2 * 4.50 / 24) / Math.pow(2, 24);
      const expected = channels[i] * expectedScale * 1e6;
      expect(result!.channels[i]).toBeCloseTo(expected, 4);
    }
  });
});

describe('estimateQualityFromSignal', () => {
  it('should return "disconnected" for flatline (below noise floor)', () => {
    expect(estimateQualityFromSignal({ std: 2, peakToPeak: 4 })).toBe('disconnected');
    expect(estimateQualityFromSignal({ std: 0, peakToPeak: 0 })).toBe('disconnected');
  });

  it('should return "good" for normal EEG range', () => {
    expect(estimateQualityFromSignal({ std: 50, peakToPeak: 150 })).toBe('good');
    expect(estimateQualityFromSignal({ std: 100, peakToPeak: 300 })).toBe('good');
  });

  it('should return "fair" for elevated noise', () => {
    expect(estimateQualityFromSignal({ std: 150, peakToPeak: 500 })).toBe('fair');
    expect(estimateQualityFromSignal({ std: 200, peakToPeak: 600 })).toBe('fair');
  });

  it('should return "poor" for high noise', () => {
    expect(estimateQualityFromSignal({ std: 300, peakToPeak: 1000 })).toBe('poor');
    expect(estimateQualityFromSignal({ std: 400, peakToPeak: 1500 })).toBe('poor');
  });

  it('should return "disconnected" for saturated signal (above poor max)', () => {
    expect(estimateQualityFromSignal({ std: 600, peakToPeak: 2000 })).toBe('disconnected');
    expect(estimateQualityFromSignal({ std: 1000, peakToPeak: 4000 })).toBe('disconnected');
  });

  it('should use max of std and peakToPeak/4 for amplitude estimation', () => {
    // When peakToPeak/4 > std, it should use peakToPeak/4
    // peakToPeak = 2000, peakToPeak/4 = 500, std = 50
    // amplitude = max(50, 500) = 500, which is at POOR_MAX boundary
    expect(estimateQualityFromSignal({ std: 50, peakToPeak: 2000 })).toBe('poor');
    
    // peakToPeak = 2400, peakToPeak/4 = 600 > POOR_MAX = 500
    expect(estimateQualityFromSignal({ std: 50, peakToPeak: 2400 })).toBe('disconnected');
  });
});

describe('estimatePseudoImpedance', () => {
  it('should return 999 for signals below noise floor (open circuit)', () => {
    expect(estimatePseudoImpedance(0)).toBe(999);
    expect(estimatePseudoImpedance(2)).toBe(999);
    expect(estimatePseudoImpedance(4.9)).toBe(999);
  });

  it('should return low pseudo-impedance for good signals', () => {
    const impedance = estimatePseudoImpedance(10);
    expect(impedance).toBeGreaterThan(5);
    expect(impedance).toBeLessThan(30);
  });

  it('should return higher pseudo-impedance for noisy signals', () => {
    const lowNoise = estimatePseudoImpedance(10);
    const highNoise = estimatePseudoImpedance(100);
    
    expect(highNoise).toBeGreaterThan(lowNoise);
  });

  it('should cap pseudo-impedance at 100 kΩ', () => {
    expect(estimatePseudoImpedance(10000)).toBeLessThanOrEqual(100);
  });

  it('should return values with one decimal place precision', () => {
    const impedance = estimatePseudoImpedance(50);
    const decimalPlaces = (impedance.toString().split('.')[1] || '').length;
    expect(decimalPlaces).toBeLessThanOrEqual(1);
  });
});

describe('Packet integrity', () => {
  it('should reject packets with corrupted middle bytes', () => {
    const packet = createValidPacket();
    // Corrupt a data byte without updating checksum
    packet[15] = (packet[15] + 1) & 0xFF;
    
    expect(parsePacket(packet)).toBeNull();
  });

  it('should accept packets with any valid channel data', () => {
    // Test with extreme values
    const extremeChannels = [
      0x7FFFFF, // Max positive
      0x800000, // Max negative (as unsigned)
      0x000000, // Zero
      0xFFFFFF, // -1
      0x123456,
      0xABCDEF,
      0x000001,
      0xFFFFFE,
    ];
    
    const packet = createValidPacket({ channels: extremeChannels });
    const result = parsePacket(packet);
    
    expect(result).not.toBeNull();
    expect(result!.channels).toHaveLength(8);
  });
});

describe('Edge cases', () => {
  it('should handle large timestamp values', () => {
    // Note: JavaScript bit-shifting treats values as signed 32-bit
    // 0x7FFFFFFF is the max safe positive timestamp
    const packet = createValidPacket({ timestamp: 0x7FFFFFFF });
    const result = parsePacket(packet);
    
    expect(result).not.toBeNull();
    expect(result!.timestamp).toBe(0x7FFFFFFF);
  });

  it('should handle zero timestamp', () => {
    const packet = createValidPacket({ timestamp: 0 });
    const result = parsePacket(packet);
    
    expect(result).not.toBeNull();
    expect(result!.timestamp).toBe(0);
  });

  it('should handle empty Uint8Array', () => {
    expect(parsePacket(new Uint8Array(0))).toBeNull();
  });
});

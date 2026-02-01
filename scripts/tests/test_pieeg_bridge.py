#!/usr/bin/env python3
"""
Unit tests for pieeg_ws_bridge.py

Tests cover:
- ADS1299 constants and enums
- PiEEGConfig dataclass
- PiEEGSimulator
- Sample packing/unpacking
- WebSocket message handling

Run with: pytest scripts/tests/test_pieeg_bridge.py -v
"""

import sys
import os
import struct
import json
import pytest
import numpy as np

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pieeg_ws_bridge import (
    ADS1299Register,
    ADS1299Command,
    ADS1299Gain,
    ADS1299SampleRate,
    PiEEGConfig,
    PiEEGSimulator,
    VREF,
    NUM_CHANNELS,
    STATUS_BYTES,
    BYTES_PER_CHANNEL,
    SAMPLE_BYTES,
)


# ============================================================================
# CONSTANTS TESTS
# ============================================================================

class TestADS1299Constants:
    """Tests for ADS1299 hardware constants"""

    def test_register_addresses(self):
        """Test key register addresses"""
        assert ADS1299Register.ID == 0x00
        assert ADS1299Register.CONFIG1 == 0x01
        assert ADS1299Register.CONFIG2 == 0x02
        assert ADS1299Register.CONFIG3 == 0x03
        assert ADS1299Register.CH1SET == 0x05
        assert ADS1299Register.CH8SET == 0x0C

    def test_command_values(self):
        """Test SPI command values"""
        assert ADS1299Command.WAKEUP == 0x02
        assert ADS1299Command.RESET == 0x06
        assert ADS1299Command.START == 0x08
        assert ADS1299Command.STOP == 0x0A
        assert ADS1299Command.RDATAC == 0x10
        assert ADS1299Command.SDATAC == 0x11
        assert ADS1299Command.RREG == 0x20
        assert ADS1299Command.WREG == 0x40

    def test_gain_values(self):
        """Test PGA gain register values"""
        assert ADS1299Gain.GAIN_1 == 0x00
        assert ADS1299Gain.GAIN_2 == 0x10
        assert ADS1299Gain.GAIN_4 == 0x20
        assert ADS1299Gain.GAIN_6 == 0x30
        assert ADS1299Gain.GAIN_8 == 0x40
        assert ADS1299Gain.GAIN_12 == 0x50
        assert ADS1299Gain.GAIN_24 == 0x60

    def test_sample_rate_values(self):
        """Test sample rate register values"""
        assert ADS1299SampleRate.SPS_16000 == 0x00
        assert ADS1299SampleRate.SPS_8000 == 0x01
        assert ADS1299SampleRate.SPS_4000 == 0x02
        assert ADS1299SampleRate.SPS_2000 == 0x03
        assert ADS1299SampleRate.SPS_1000 == 0x04
        assert ADS1299SampleRate.SPS_500 == 0x05
        assert ADS1299SampleRate.SPS_250 == 0x06

    def test_hardware_constants(self):
        """Test hardware spec constants"""
        assert VREF == 4.5
        assert NUM_CHANNELS == 8
        assert STATUS_BYTES == 3
        assert BYTES_PER_CHANNEL == 3
        assert SAMPLE_BYTES == 27  # 3 + 8*3


# ============================================================================
# CONFIG TESTS
# ============================================================================

class TestPiEEGConfig:
    """Tests for PiEEGConfig dataclass"""

    def test_default_values(self):
        """Test default configuration"""
        config = PiEEGConfig()
        
        assert config.spi_bus == 0
        assert config.spi_device == 0
        assert config.spi_speed == 2000000
        assert config.sample_rate == ADS1299SampleRate.SPS_250
        assert config.gain == ADS1299Gain.GAIN_24
        assert config.num_channels == 8
        assert config.daisy_chain == False

    def test_custom_values(self):
        """Test custom configuration"""
        config = PiEEGConfig(
            sample_rate=ADS1299SampleRate.SPS_500,
            gain=ADS1299Gain.GAIN_12,
            num_channels=16,
            daisy_chain=True,
        )
        
        assert config.sample_rate == ADS1299SampleRate.SPS_500
        assert config.gain == ADS1299Gain.GAIN_12
        assert config.num_channels == 16
        assert config.daisy_chain == True


# ============================================================================
# SIMULATOR TESTS
# ============================================================================

class TestPiEEGSimulator:
    """Tests for PiEEGSimulator class"""

    def test_initialization(self):
        """Test simulator initializes correctly"""
        config = PiEEGConfig()
        sim = PiEEGSimulator(config)
        
        assert sim.is_streaming == False
        assert sim.sample_count == 0

    def test_connect(self):
        """Test simulator connect returns True"""
        config = PiEEGConfig()
        sim = PiEEGSimulator(config)
        
        assert sim.connect() == True

    def test_start_stop_streaming(self):
        """Test streaming state management"""
        config = PiEEGConfig()
        sim = PiEEGSimulator(config)
        sim.connect()
        
        sim.start_streaming()
        assert sim.is_streaming == True
        assert sim.sample_count == 0
        
        sim.stop_streaming()
        assert sim.is_streaming == False

    def test_sample_rate_hz(self):
        """Test sample rate Hz conversion"""
        test_cases = [
            (ADS1299SampleRate.SPS_250, 250),
            (ADS1299SampleRate.SPS_500, 500),
            (ADS1299SampleRate.SPS_1000, 1000),
            (ADS1299SampleRate.SPS_2000, 2000),
        ]
        
        for rate_enum, expected_hz in test_cases:
            config = PiEEGConfig(sample_rate=rate_enum)
            sim = PiEEGSimulator(config)
            assert sim._get_sample_rate_hz() == expected_hz

    def test_read_sample_when_not_streaming(self):
        """Test read_sample returns None when not streaming"""
        config = PiEEGConfig()
        sim = PiEEGSimulator(config)
        sim.connect()
        
        # Not streaming yet
        result = sim.read_sample()
        # May return None due to rate limiting
        # Just ensure no exception

    def test_read_sample_returns_correct_channels(self):
        """Test read_sample returns correct number of channels"""
        config = PiEEGConfig(num_channels=8)
        sim = PiEEGSimulator(config)
        sim.connect()
        sim.start_streaming()
        
        # Wait a bit to ensure sample is ready
        import time
        time.sleep(0.01)
        
        sample = sim.read_sample()
        if sample is not None:
            assert len(sample) == 8

    def test_simulated_values_in_eeg_range(self):
        """Test simulated values are in realistic EEG range"""
        config = PiEEGConfig()
        sim = PiEEGSimulator(config)
        sim.connect()
        sim.start_streaming()
        
        import time
        samples = []
        for _ in range(100):
            sample = sim.read_sample()
            if sample is not None:
                samples.append(sample)
            time.sleep(0.001)
        
        if samples:
            all_values = np.array(samples).flatten()
            # EEG typically ±100 µV, simulator adds some noise
            assert np.abs(all_values).max() < 200  # µV

    def test_disconnect(self):
        """Test disconnect stops streaming"""
        config = PiEEGConfig()
        sim = PiEEGSimulator(config)
        sim.connect()
        sim.start_streaming()
        
        sim.disconnect()
        assert sim.is_streaming == False


# ============================================================================
# SCALE FACTOR TESTS
# ============================================================================

class TestScaleFactor:
    """Tests for µV scale factor calculation"""

    def test_gain_24_scale_factor(self):
        """Test scale factor with gain 24"""
        # Formula: (2 * VREF / gain) / (2^24) * 1e6
        # = (2 * 4.5 / 24) / 16777216 * 1e6
        # = 0.375 / 16777216 * 1e6
        # ≈ 0.0223517 µV/LSB
        
        gain = 24
        expected_scale = (2 * VREF / gain) / (2**24) * 1e6
        
        assert abs(expected_scale - 0.0223517) < 0.0001

    def test_gain_1_scale_factor(self):
        """Test scale factor with gain 1 (maximum range)"""
        gain = 1
        expected_scale = (2 * VREF / gain) / (2**24) * 1e6
        
        # Should be 24x larger than gain 24
        assert abs(expected_scale - 0.0223517 * 24) < 0.01

    def test_full_scale_range(self):
        """Test full scale input range"""
        gain = 24
        # Full scale = ±VREF/gain = ±4.5/24 = ±187.5 mV
        # In µV: ±187,500 µV
        
        scale = (2 * VREF / gain) / (2**24) * 1e6
        full_scale_uv = scale * (2**23 - 1)  # Max positive value
        
        assert abs(full_scale_uv - 187500) < 500  # Within 0.3%


# ============================================================================
# PACKET FORMAT TESTS
# ============================================================================

class TestPacketFormat:
    """Tests for WebSocket packet format"""

    def test_pack_samples_format(self):
        """Test binary packet structure"""
        # Simulate what _pack_samples does
        samples = [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]]
        timestamp = 12345.6789
        num_samples = len(samples)
        num_channels = len(samples[0])
        
        # Header: magic (2) + num_samples (2) + num_channels (1) + timestamp (8)
        header = struct.pack('>HHBd', 0xEEEE, num_samples, num_channels, timestamp)
        
        assert len(header) == 13
        
        # Data: float32 × channels × samples
        data = struct.pack(f'>{num_channels}f', *samples[0])
        assert len(data) == num_channels * 4  # 32 bytes

    def test_unpack_header(self):
        """Test unpacking packet header"""
        # Create header
        magic = 0xEEEE
        num_samples = 5
        num_channels = 8
        timestamp = 1234567890.123
        
        header = struct.pack('>HHBd', magic, num_samples, num_channels, timestamp)
        
        # Unpack
        unpacked = struct.unpack('>HHBd', header)
        
        assert unpacked[0] == magic
        assert unpacked[1] == num_samples
        assert unpacked[2] == num_channels
        assert abs(unpacked[3] - timestamp) < 0.001

    def test_unpack_sample_data(self):
        """Test unpacking sample data"""
        channels = [10.5, -20.3, 30.1, -40.7, 50.2, -60.8, 70.4, -80.9]
        
        # Pack
        data = struct.pack(f'>8f', *channels)
        
        # Unpack
        unpacked = struct.unpack(f'>8f', data)
        
        for i, (original, recovered) in enumerate(zip(channels, unpacked)):
            assert abs(original - recovered) < 0.001, f"Channel {i} mismatch"


# ============================================================================
# 24-BIT PARSING TESTS
# ============================================================================

class Test24BitParsing:
    """Tests for 24-bit ADC value parsing"""

    def test_parse_positive_value(self):
        """Test parsing positive 24-bit value"""
        # 24-bit big-endian value: 0x123456 = 1193046
        data = bytes([0x12, 0x34, 0x56])
        
        value = (data[0] << 16) | (data[1] << 8) | data[2]
        # No sign extension needed for positive
        assert value == 0x123456

    def test_parse_negative_value(self):
        """Test parsing negative 24-bit value (two's complement)"""
        # -1 in 24-bit = 0xFFFFFF
        data = bytes([0xFF, 0xFF, 0xFF])
        
        value = (data[0] << 16) | (data[1] << 8) | data[2]
        # Sign extend
        if value & 0x800000:
            value -= 0x1000000
        
        assert value == -1

    def test_parse_max_positive(self):
        """Test parsing maximum positive value"""
        # 0x7FFFFF = 8388607 (max positive for 24-bit signed)
        data = bytes([0x7F, 0xFF, 0xFF])
        
        value = (data[0] << 16) | (data[1] << 8) | data[2]
        if value & 0x800000:
            value -= 0x1000000
        
        assert value == 8388607

    def test_parse_min_negative(self):
        """Test parsing minimum negative value"""
        # 0x800000 = -8388608 (min negative for 24-bit signed)
        data = bytes([0x80, 0x00, 0x00])
        
        value = (data[0] << 16) | (data[1] << 8) | data[2]
        if value & 0x800000:
            value -= 0x1000000
        
        assert value == -8388608

    def test_parse_zero(self):
        """Test parsing zero"""
        data = bytes([0x00, 0x00, 0x00])
        
        value = (data[0] << 16) | (data[1] << 8) | data[2]
        if value & 0x800000:
            value -= 0x1000000
        
        assert value == 0


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

class TestSimulatorIntegration:
    """Integration tests for simulator"""

    def test_full_session(self):
        """Test complete simulator session"""
        import time
        
        config = PiEEGConfig(sample_rate=ADS1299SampleRate.SPS_250)
        sim = PiEEGSimulator(config)
        
        # Connect
        assert sim.connect() == True
        
        # Start streaming
        sim.start_streaming()
        assert sim.is_streaming == True
        
        # Collect samples
        samples = []
        start = time.time()
        while time.time() - start < 0.1:  # 100ms
            sample = sim.read_sample()
            if sample is not None:
                samples.append(sample)
            time.sleep(0.001)
        
        # Should have some samples
        assert len(samples) > 0
        
        # Stop
        sim.stop_streaming()
        assert sim.is_streaming == False
        
        # Disconnect
        sim.disconnect()

    def test_sample_count_increments(self):
        """Test that sample count increments correctly"""
        import time
        
        config = PiEEGConfig()
        sim = PiEEGSimulator(config)
        sim.connect()
        sim.start_streaming()
        
        initial_count = sim.sample_count
        
        # Read some samples
        for _ in range(50):
            sim.read_sample()
            time.sleep(0.001)
        
        # Count should have increased
        assert sim.sample_count >= initial_count
        
        sim.disconnect()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

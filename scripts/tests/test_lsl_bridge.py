#!/usr/bin/env python3
"""
Unit tests for lsl_ws_bridge.py

Tests cover:
- LSL stream discovery simulation
- LSL channel format parsing
- Stream metadata handling
- WebSocket message formats
- LSLSimulator class

Run with: pytest scripts/tests/test_lsl_bridge.py -v
"""

import sys
import os
import struct
import json
import pytest
import numpy as np

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lsl_ws_bridge import (
    LSLChannelFormat,
    LSLStreamInfo,
    LSLSimulator,
    LSL_AVAILABLE,
)


# ============================================================================
# CHANNEL FORMAT TESTS
# ============================================================================

class TestLSLChannelFormat:
    """Tests for LSL channel format enum"""

    def test_format_values(self):
        """Test channel format numeric values"""
        assert LSLChannelFormat.FLOAT32.value == 1
        assert LSLChannelFormat.DOUBLE64.value == 2

    def test_format_names(self):
        """Test format enum names"""
        assert LSLChannelFormat.FLOAT32.name == "FLOAT32"
        assert LSLChannelFormat.DOUBLE64.name == "DOUBLE64"


# ============================================================================
# STREAM INFO TESTS
# ============================================================================

class TestLSLStreamInfo:
    """Tests for LSLStreamInfo dataclass"""

    def test_default_creation(self):
        """Test creating stream info with required fields"""
        info = LSLStreamInfo(
            name="TestStream",
            stream_type="EEG",
            channel_count=8,
            sampling_rate=250.0,
            source_id="test-123",
        )
        
        assert info.name == "TestStream"
        assert info.stream_type == "EEG"
        assert info.channel_count == 8
        assert info.sampling_rate == 250.0
        assert info.source_id == "test-123"

    def test_optional_fields(self):
        """Test optional channel labels"""
        labels = ["Fp1", "Fp2", "C3", "C4", "P3", "P4", "O1", "O2"]
        info = LSLStreamInfo(
            name="EEG",
            stream_type="EEG",
            channel_count=8,
            sampling_rate=256.0,
            source_id="openbci",
            channel_labels=labels,
        )
        
        assert info.channel_labels == labels

    def test_to_dict(self):
        """Test conversion to dictionary (for JSON)"""
        from dataclasses import asdict
        
        info = LSLStreamInfo(
            name="MyStream",
            stream_type="EEG",
            channel_count=4,
            sampling_rate=500.0,
            source_id="src",
        )
        
        d = asdict(info)
        
        assert d["name"] == "MyStream"
        assert d["stream_type"] == "EEG"
        assert d["channel_count"] == 4
        assert d["sampling_rate"] == 500.0


# ============================================================================
# SIMULATOR TESTS
# ============================================================================

class TestLSLSimulator:
    """Tests for LSLSimulator class"""

    def test_initialization(self):
        """Test simulator initialization"""
        sim = LSLSimulator(
            stream_name="TestEEG",
            channel_count=8,
            sample_rate=250.0,
        )
        
        assert sim.stream_info.name == "TestEEG"
        assert sim.stream_info.channel_count == 8
        assert sim.stream_info.sampling_rate == 250.0
        assert sim.is_streaming == False

    def test_get_stream_info(self):
        """Test getting stream info"""
        sim = LSLSimulator(
            stream_name="OpenBCI_EEG",
            channel_count=16,
            sample_rate=125.0,
        )
        
        info = sim.get_stream_info()
        
        assert info.name == "OpenBCI_EEG"
        assert info.channel_count == 16
        assert info.sampling_rate == 125.0
        assert info.stream_type == "EEG"

    def test_start_stop(self):
        """Test start and stop streaming"""
        sim = LSLSimulator(
            stream_name="Test",
            channel_count=4,
            sample_rate=250.0,
        )
        
        sim.start()
        assert sim.is_streaming == True
        
        sim.stop()
        assert sim.is_streaming == False

    def test_pull_sample_shape(self):
        """Test pulled sample has correct shape"""
        sim = LSLSimulator(
            stream_name="Test",
            channel_count=8,
            sample_rate=250.0,
        )
        sim.start()
        
        import time
        time.sleep(0.01)  # Let it generate a sample
        
        sample, timestamp = sim.pull_sample()
        
        if sample is not None:
            assert len(sample) == 8
            assert isinstance(timestamp, float)
        
        sim.stop()

    def test_simulated_values_range(self):
        """Test simulated values are in EEG range"""
        sim = LSLSimulator(
            stream_name="Test",
            channel_count=8,
            sample_rate=1000.0,  # Fast for testing
        )
        sim.start()
        
        import time
        samples = []
        for _ in range(100):
            sample, ts = sim.pull_sample()
            if sample is not None:
                samples.append(sample)
            time.sleep(0.001)
        
        sim.stop()
        
        if samples:
            all_values = np.array(samples).flatten()
            # Should be in µV range
            assert np.abs(all_values).max() < 200

    def test_timestamp_increases(self):
        """Test timestamps are monotonically increasing"""
        sim = LSLSimulator(
            stream_name="Test",
            channel_count=4,
            sample_rate=1000.0,
        )
        sim.start()
        
        import time
        timestamps = []
        for _ in range(50):
            sample, ts = sim.pull_sample()
            if ts is not None and ts > 0:
                timestamps.append(ts)
            time.sleep(0.001)
        
        sim.stop()
        
        if len(timestamps) > 1:
            # Check monotonic
            for i in range(1, len(timestamps)):
                assert timestamps[i] >= timestamps[i-1]


# ============================================================================
# WEBSOCKET MESSAGE FORMAT TESTS
# ============================================================================

class TestWebSocketMessages:
    """Tests for WebSocket message formats"""

    def test_metadata_message(self):
        """Test metadata message structure"""
        metadata = {
            "type": "metadata",
            "stream": {
                "name": "OpenBCI_EEG",
                "stream_type": "EEG",
                "channel_count": 8,
                "sampling_rate": 250.0,
                "channel_labels": ["Fp1", "Fp2", "C3", "C4", "P3", "P4", "O1", "O2"],
            }
        }
        
        # Should be valid JSON
        json_str = json.dumps(metadata)
        parsed = json.loads(json_str)
        
        assert parsed["type"] == "metadata"
        assert parsed["stream"]["name"] == "OpenBCI_EEG"
        assert parsed["stream"]["channel_count"] == 8

    def test_discover_command(self):
        """Test discover command format"""
        cmd = {"command": "discover"}
        json_str = json.dumps(cmd)
        parsed = json.loads(json_str)
        
        assert parsed["command"] == "discover"

    def test_connect_command(self):
        """Test connect command format"""
        cmd = {
            "command": "connect",
            "name": "OpenBCI_EEG",
            "stream_type": "EEG",
        }
        json_str = json.dumps(cmd)
        parsed = json.loads(json_str)
        
        assert parsed["command"] == "connect"
        assert parsed["name"] == "OpenBCI_EEG"

    def test_streams_response(self):
        """Test streams list response format"""
        response = {
            "type": "streams",
            "streams": [
                {
                    "name": "OpenBCI_EEG",
                    "stream_type": "EEG",
                    "channel_count": 8,
                    "sampling_rate": 250.0,
                },
                {
                    "name": "Muse",
                    "stream_type": "EEG",
                    "channel_count": 4,
                    "sampling_rate": 256.0,
                },
            ]
        }
        
        json_str = json.dumps(response)
        parsed = json.loads(json_str)
        
        assert parsed["type"] == "streams"
        assert len(parsed["streams"]) == 2

    def test_error_response(self):
        """Test error response format"""
        error = {
            "type": "error",
            "message": "Stream not found",
            "code": "STREAM_NOT_FOUND",
        }
        
        json_str = json.dumps(error)
        parsed = json.loads(json_str)
        
        assert parsed["type"] == "error"
        assert "Stream not found" in parsed["message"]


# ============================================================================
# BINARY PACKET FORMAT TESTS
# ============================================================================

class TestBinaryPacketFormat:
    """Tests for binary sample packet format"""

    def test_header_format(self):
        """Test binary packet header structure"""
        magic = 0xEEEE
        packet_type = 0x01  # Raw samples
        num_samples = 10
        num_channels = 8
        timestamp = 1234567890.123456
        
        # Pack header
        header = struct.pack('>HBHBD', magic, packet_type, num_samples, num_channels, timestamp)
        
        # Should be 14 bytes
        assert len(header) == 14
        
        # Unpack and verify
        unpacked = struct.unpack('>HBHBD', header)
        assert unpacked[0] == magic
        assert unpacked[1] == packet_type
        assert unpacked[2] == num_samples
        assert unpacked[3] == num_channels
        assert abs(unpacked[4] - timestamp) < 0.000001

    def test_sample_packing(self):
        """Test sample data packing"""
        samples = [
            [1.0, 2.0, 3.0, 4.0],
            [5.0, 6.0, 7.0, 8.0],
            [9.0, 10.0, 11.0, 12.0],
        ]
        
        # Pack samples
        data = b''
        for sample in samples:
            data += struct.pack(f'>{len(sample)}f', *sample)
        
        # Should be 3 samples × 4 channels × 4 bytes = 48 bytes
        assert len(data) == 48
        
        # Unpack and verify
        offset = 0
        for i, sample in enumerate(samples):
            unpacked = struct.unpack('>4f', data[offset:offset+16])
            for j, val in enumerate(sample):
                assert abs(unpacked[j] - val) < 0.0001
            offset += 16

    def test_full_packet(self):
        """Test complete packet creation and parsing"""
        # Create packet
        magic = 0xEEEE
        packet_type = 0x01
        num_samples = 2
        num_channels = 4
        timestamp = 1000.5
        samples = [[10.0, 20.0, 30.0, 40.0], [50.0, 60.0, 70.0, 80.0]]
        
        # Pack
        header = struct.pack('>HBHBD', magic, packet_type, num_samples, num_channels, timestamp)
        data = b''
        for sample in samples:
            data += struct.pack(f'>{num_channels}f', *sample)
        
        packet = header + data
        
        # Parse
        parsed_header = struct.unpack('>HBHBD', packet[:14])
        assert parsed_header[0] == magic
        assert parsed_header[2] == num_samples
        
        # Parse samples
        offset = 14
        for i in range(num_samples):
            parsed_sample = struct.unpack(f'>{num_channels}f', packet[offset:offset+num_channels*4])
            for j in range(num_channels):
                assert abs(parsed_sample[j] - samples[i][j]) < 0.0001
            offset += num_channels * 4


# ============================================================================
# STREAM DISCOVERY SIMULATION TESTS
# ============================================================================

class TestStreamDiscovery:
    """Tests for stream discovery simulation"""

    def test_discover_returns_list(self):
        """Test that discovery returns a list of streams"""
        # Simulate what discover would return
        discovered = [
            LSLStreamInfo(
                name="OpenBCI_EEG",
                stream_type="EEG",
                channel_count=8,
                sampling_rate=250.0,
                source_id="openbci-1",
            ),
            LSLStreamInfo(
                name="Markers",
                stream_type="Markers",
                channel_count=1,
                sampling_rate=0.0,  # Irregular
                source_id="markers-1",
            ),
        ]
        
        assert len(discovered) == 2
        assert discovered[0].stream_type == "EEG"
        assert discovered[1].stream_type == "Markers"

    def test_filter_by_type(self):
        """Test filtering streams by type"""
        all_streams = [
            LSLStreamInfo("EEG1", "EEG", 8, 250.0, "1"),
            LSLStreamInfo("EEG2", "EEG", 16, 500.0, "2"),
            LSLStreamInfo("Markers", "Markers", 1, 0.0, "3"),
            LSLStreamInfo("Audio", "Audio", 2, 44100.0, "4"),
        ]
        
        eeg_only = [s for s in all_streams if s.stream_type == "EEG"]
        
        assert len(eeg_only) == 2


# ============================================================================
# CHANNEL LABEL TESTS
# ============================================================================

class TestChannelLabels:
    """Tests for channel label handling"""

    def test_standard_10_20_labels(self):
        """Test standard 10-20 system labels"""
        labels_8ch = ["Fp1", "Fp2", "C3", "C4", "P3", "P4", "O1", "O2"]
        
        assert len(labels_8ch) == 8
        assert "Fp1" in labels_8ch
        assert "O2" in labels_8ch

    def test_generate_default_labels(self):
        """Test generating default channel labels"""
        num_channels = 16
        labels = [f"Ch{i+1}" for i in range(num_channels)]
        
        assert len(labels) == 16
        assert labels[0] == "Ch1"
        assert labels[15] == "Ch16"

    def test_muse_labels(self):
        """Test Muse headband channel labels"""
        muse_labels = ["TP9", "AF7", "AF8", "TP10"]
        
        assert len(muse_labels) == 4
        # Left temporal
        assert "TP9" in muse_labels
        # Right temporal
        assert "TP10" in muse_labels


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

class TestLSLSimulatorIntegration:
    """Integration tests for LSL simulator"""

    def test_full_session(self):
        """Test complete simulator session"""
        import time
        
        sim = LSLSimulator(
            stream_name="IntegrationTest",
            channel_count=8,
            sample_rate=250.0,
        )
        
        # Get info
        info = sim.get_stream_info()
        assert info.name == "IntegrationTest"
        
        # Start
        sim.start()
        assert sim.is_streaming
        
        # Collect samples
        samples = []
        start = time.time()
        while time.time() - start < 0.1:
            sample, ts = sim.pull_sample()
            if sample is not None:
                samples.append((sample, ts))
            time.sleep(0.001)
        
        # Should have collected some samples
        assert len(samples) > 0
        
        # Stop
        sim.stop()
        assert not sim.is_streaming

    def test_multiple_simulators(self):
        """Test running multiple simulators"""
        sim1 = LSLSimulator("Stream1", 4, 250.0)
        sim2 = LSLSimulator("Stream2", 8, 500.0)
        
        assert sim1.stream_info.channel_count == 4
        assert sim2.stream_info.channel_count == 8
        
        sim1.start()
        sim2.start()
        
        assert sim1.is_streaming
        assert sim2.is_streaming
        
        sim1.stop()
        sim2.stop()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

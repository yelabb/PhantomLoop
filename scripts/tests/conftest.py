#!/usr/bin/env python3
"""
Pytest configuration and shared fixtures for bridge tests.
"""

import sys
import os
import pytest
import numpy as np

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def sample_rate():
    """Default sample rate for tests"""
    return 250.0


@pytest.fixture
def num_channels():
    """Default number of channels"""
    return 8


@pytest.fixture
def eeg_sample(num_channels):
    """Generate a realistic EEG sample"""
    # Alpha wave + noise
    alpha = 30.0 * np.sin(np.random.random() * 2 * np.pi)
    noise = np.random.normal(0, 5, num_channels)
    return alpha + noise


@pytest.fixture
def eeg_batch(num_channels, sample_rate):
    """Generate 1 second of EEG data"""
    num_samples = int(sample_rate)
    t = np.arange(num_samples) / sample_rate
    
    # Generate alpha waves for each channel
    data = np.zeros((num_samples, num_channels))
    for ch in range(num_channels):
        freq = 10 + np.random.random()  # 10-11 Hz
        phase = np.random.random() * 2 * np.pi
        amplitude = 25 + np.random.random() * 10  # 25-35 µV
        data[:, ch] = amplitude * np.sin(2 * np.pi * freq * t + phase)
        data[:, ch] += np.random.normal(0, 3, num_samples)  # Noise
    
    return data


@pytest.fixture
def noisy_eeg_sample(num_channels):
    """Generate EEG sample with powerline interference"""
    t = np.random.random()
    
    # EEG
    alpha = 30.0 * np.sin(2 * np.pi * 10 * t)
    
    # 60 Hz interference
    powerline = 15.0 * np.sin(2 * np.pi * 60 * t)
    
    # DC offset
    dc = 50.0
    
    # Noise
    noise = np.random.normal(0, 5, num_channels)
    
    return alpha + powerline + dc + noise


@pytest.fixture
def artifact_sample(num_channels):
    """Generate sample with large artifact"""
    sample = np.random.normal(0, 10, num_channels)
    # Add artifact to channel 0
    sample[0] = 500.0  # Way above normal EEG
    return sample


# ============================================================================
# MOCK CLASSES
# ============================================================================

class MockWebSocket:
    """Mock WebSocket for testing"""
    
    def __init__(self):
        self.sent_messages = []
        self.received_messages = []
        self.is_open = True
        self.remote_address = ("127.0.0.1", 12345)
        
    async def send(self, message):
        self.sent_messages.append(message)
        
    async def recv(self):
        if self.received_messages:
            return self.received_messages.pop(0)
        raise Exception("No messages")
        
    def close(self):
        self.is_open = False
        
    def add_message(self, message):
        """Add message to receive queue"""
        self.received_messages.append(message)


@pytest.fixture
def mock_websocket():
    """Provide mock WebSocket instance"""
    return MockWebSocket()


# ============================================================================
# MARKERS
# ============================================================================

def pytest_configure(config):
    """Register custom markers"""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "hardware: marks tests requiring hardware (deselect with '-m \"not hardware\"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks integration tests"
    )

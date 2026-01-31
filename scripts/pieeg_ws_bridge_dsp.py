#!/usr/bin/env python3
"""
WebSocket Bridge for PiEEG with Real-Time DSP Signal Hygiene

This enhanced bridge applies real-time digital signal processing to clean
EEG signals before WebSocket transmission. Runs on Raspberry Pi with PiEEG.

Signal Hygiene Pipeline:
    1. DC Blocking      - Removes electrode drift (high-pass @ 0.1 Hz)
    2. Notch Filter     - Removes powerline interference (50/60 Hz + harmonics)
    3. Bandpass Filter  - Isolates EEG band (0.5-45 Hz default)
    4. Artifact Reject  - Flags/blanks samples exceeding threshold
    5. CAR              - Common Average Reference for spatial filtering
    6. Smoothing        - Optional exponential moving average

Usage:
    # Basic usage with 60 Hz notch (Americas, Asia)
    python pieeg_ws_bridge_dsp.py --notch 60
    
    # European 50 Hz with custom bandpass
    python pieeg_ws_bridge_dsp.py --notch 50 --highpass 1.0 --lowpass 40
    
    # Full signal hygiene with artifact rejection
    python pieeg_ws_bridge_dsp.py --notch 60 --car --artifact-threshold 150
    
    # Disable specific filters
    python pieeg_ws_bridge_dsp.py --no-notch --no-bandpass
    
Requirements:
    pip install websockets spidev RPi.GPIO numpy scipy
    
    For simulation mode (development):
    pip install websockets numpy scipy

License: MIT
"""

import asyncio
import struct
import json
import sys
import time
import argparse
from typing import Optional, List, Dict, Tuple, Callable
from dataclasses import dataclass, field, asdict
from enum import IntEnum
from collections import deque
import numpy as np

try:
    from scipy import signal as scipy_signal
    SCIPY_AVAILABLE = True
except ImportError:
    print("Warning: scipy not available. Install with: pip install scipy")
    print("         DSP filters will be disabled.")
    SCIPY_AVAILABLE = False

try:
    import websockets
except ImportError:
    print("Error: websockets library required. Install with: pip install websockets")
    sys.exit(1)

# Check if running on Raspberry Pi
IS_RASPBERRY_PI = False
try:
    import spidev
    import RPi.GPIO as GPIO
    IS_RASPBERRY_PI = True
except ImportError:
    print("Warning: Not running on Raspberry Pi. Using simulation mode.")


# ============================================================================
# DSP FILTER CLASSES
# ============================================================================

class DCBlocker:
    """
    First-order IIR DC blocking filter.
    Removes DC offset and very slow drifts from electrode polarization.
    
    Transfer function: H(z) = (1 - z^-1) / (1 - α*z^-1)
    where α controls the cutoff frequency.
    """
    
    def __init__(self, alpha: float = 0.995, num_channels: int = 8):
        """
        Args:
            alpha: Pole location (0.99 = ~1.6 Hz, 0.995 = ~0.8 Hz, 0.999 = ~0.16 Hz)
            num_channels: Number of EEG channels
        """
        self.alpha = alpha
        self.num_channels = num_channels
        self.x_prev = np.zeros(num_channels)
        self.y_prev = np.zeros(num_channels)
        
    def process(self, sample: np.ndarray) -> np.ndarray:
        """Process single sample (all channels)"""
        y = sample - self.x_prev + self.alpha * self.y_prev
        self.x_prev = sample.copy()
        self.y_prev = y.copy()
        return y
        
    def reset(self):
        """Reset filter state"""
        self.x_prev.fill(0)
        self.y_prev.fill(0)


class IIRFilter:
    """
    Real-time IIR filter using scipy's sosfilt with state preservation.
    Supports lowpass, highpass, bandpass, and bandstop (notch) configurations.
    """
    
    def __init__(self, sos: np.ndarray, num_channels: int = 8):
        """
        Args:
            sos: Second-order sections from scipy.signal.butter/iirnotch
            num_channels: Number of EEG channels
        """
        self.sos = sos
        self.num_channels = num_channels
        # State: (n_sections, 2) per channel
        self.zi = np.zeros((num_channels, sos.shape[0], 2))
        
    def process(self, sample: np.ndarray) -> np.ndarray:
        """Process single sample through filter"""
        output = np.zeros(self.num_channels)
        for ch in range(self.num_channels):
            # Filter single sample, update state
            out, self.zi[ch] = scipy_signal.sosfilt(
                self.sos, 
                [sample[ch]], 
                zi=self.zi[ch]
            )
            output[ch] = out[0]
        return output
        
    def process_batch(self, samples: np.ndarray) -> np.ndarray:
        """Process batch of samples [num_samples, num_channels]"""
        output = np.zeros_like(samples)
        for ch in range(self.num_channels):
            output[:, ch], self.zi[ch] = scipy_signal.sosfilt(
                self.sos,
                samples[:, ch],
                zi=self.zi[ch]
            )
        return output
        
    def reset(self):
        """Reset filter state"""
        self.zi.fill(0)
        
    @classmethod
    def create_notch(cls, freq: float, fs: float, Q: float = 30.0, 
                     num_channels: int = 8) -> 'IIRFilter':
        """Create notch filter at specified frequency"""
        b, a = scipy_signal.iirnotch(freq, Q, fs)
        sos = scipy_signal.tf2sos(b, a)
        return cls(sos, num_channels)
        
    @classmethod
    def create_bandpass(cls, lowcut: float, highcut: float, fs: float,
                        order: int = 4, num_channels: int = 8) -> 'IIRFilter':
        """Create Butterworth bandpass filter"""
        nyq = fs / 2
        low = lowcut / nyq
        high = highcut / nyq
        sos = scipy_signal.butter(order, [low, high], btype='band', output='sos')
        return cls(sos, num_channels)
        
    @classmethod
    def create_highpass(cls, cutoff: float, fs: float, order: int = 4,
                        num_channels: int = 8) -> 'IIRFilter':
        """Create Butterworth highpass filter"""
        nyq = fs / 2
        normalized_cutoff = cutoff / nyq
        sos = scipy_signal.butter(order, normalized_cutoff, btype='high', output='sos')
        return cls(sos, num_channels)
        
    @classmethod
    def create_lowpass(cls, cutoff: float, fs: float, order: int = 4,
                       num_channels: int = 8) -> 'IIRFilter':
        """Create Butterworth lowpass filter"""
        nyq = fs / 2
        normalized_cutoff = cutoff / nyq
        sos = scipy_signal.butter(order, normalized_cutoff, btype='low', output='sos')
        return cls(sos, num_channels)


class NotchFilterBank:
    """
    Bank of notch filters for powerline interference removal.
    Includes fundamental frequency and harmonics.
    """
    
    def __init__(self, fundamental: float, fs: float, num_harmonics: int = 3,
                 Q: float = 30.0, num_channels: int = 8):
        """
        Args:
            fundamental: Powerline frequency (50 or 60 Hz)
            fs: Sampling frequency
            num_harmonics: Number of harmonics to filter (1=fundamental only)
            Q: Quality factor (higher = narrower notch)
            num_channels: Number of EEG channels
        """
        self.filters: List[IIRFilter] = []
        nyq = fs / 2
        
        for i in range(1, num_harmonics + 1):
            freq = fundamental * i
            if freq < nyq:  # Only add if below Nyquist
                notch = IIRFilter.create_notch(freq, fs, Q, num_channels)
                self.filters.append(notch)
                print(f"  ✓ Notch filter @ {freq} Hz (Q={Q})")
                
    def process(self, sample: np.ndarray) -> np.ndarray:
        """Apply all notch filters in series"""
        output = sample
        for filt in self.filters:
            output = filt.process(output)
        return output
        
    def reset(self):
        """Reset all filter states"""
        for filt in self.filters:
            filt.reset()


class ArtifactRejector:
    """
    Simple amplitude-based artifact detection and rejection.
    Flags or blanks samples exceeding threshold.
    """
    
    def __init__(self, threshold_uv: float = 150.0, blanking_samples: int = 5,
                 num_channels: int = 8):
        """
        Args:
            threshold_uv: Amplitude threshold in microvolts
            blanking_samples: Number of samples to blank after artifact
            num_channels: Number of EEG channels
        """
        self.threshold = threshold_uv
        self.blanking_samples = blanking_samples
        self.num_channels = num_channels
        self.blanking_counter = np.zeros(num_channels, dtype=int)
        self.last_good = np.zeros(num_channels)
        self.artifact_count = 0
        self.total_samples = 0
        
    def process(self, sample: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Process sample and return (cleaned_sample, artifact_flags).
        
        Returns:
            cleaned: Sample with artifacts replaced by last good value
            flags: Boolean array indicating artifact on each channel
        """
        self.total_samples += 1
        flags = np.zeros(self.num_channels, dtype=bool)
        cleaned = sample.copy()
        
        for ch in range(self.num_channels):
            # Check if in blanking period
            if self.blanking_counter[ch] > 0:
                cleaned[ch] = self.last_good[ch]
                self.blanking_counter[ch] -= 1
                flags[ch] = True
            # Check for new artifact
            elif np.abs(sample[ch]) > self.threshold:
                cleaned[ch] = self.last_good[ch]
                self.blanking_counter[ch] = self.blanking_samples
                flags[ch] = True
                self.artifact_count += 1
            else:
                self.last_good[ch] = sample[ch]
                
        return cleaned, flags
        
    def get_artifact_rate(self) -> float:
        """Get percentage of samples flagged as artifacts"""
        if self.total_samples == 0:
            return 0.0
        return (self.artifact_count / self.total_samples) * 100
        
    def reset(self):
        """Reset artifact detector state"""
        self.blanking_counter.fill(0)
        self.last_good.fill(0)
        self.artifact_count = 0
        self.total_samples = 0


class CommonAverageReference:
    """
    Common Average Reference (CAR) spatial filter.
    Subtracts the mean across all channels from each channel.
    Helps remove common-mode noise and reference artifacts.
    """
    
    def __init__(self, num_channels: int = 8, exclude_channels: List[int] = None):
        """
        Args:
            num_channels: Number of EEG channels
            exclude_channels: Channels to exclude from average (e.g., bad channels)
        """
        self.num_channels = num_channels
        self.exclude = set(exclude_channels or [])
        
    def process(self, sample: np.ndarray) -> np.ndarray:
        """Apply common average reference"""
        # Calculate mean excluding bad channels
        mask = np.ones(self.num_channels, dtype=bool)
        for ch in self.exclude:
            if 0 <= ch < self.num_channels:
                mask[ch] = False
                
        if mask.sum() == 0:
            return sample  # All channels excluded, return unchanged
            
        avg = np.mean(sample[mask])
        return sample - avg


class ExponentialSmoother:
    """
    Exponential moving average for optional signal smoothing.
    Lower alpha = more smoothing (more lag).
    """
    
    def __init__(self, alpha: float = 0.3, num_channels: int = 8):
        """
        Args:
            alpha: Smoothing factor (0-1). Higher = less smoothing.
            num_channels: Number of EEG channels
        """
        self.alpha = alpha
        self.num_channels = num_channels
        self.ema = np.zeros(num_channels)
        self.initialized = False
        
    def process(self, sample: np.ndarray) -> np.ndarray:
        """Apply exponential smoothing"""
        if not self.initialized:
            self.ema = sample.copy()
            self.initialized = True
            return sample
            
        self.ema = self.alpha * sample + (1 - self.alpha) * self.ema
        return self.ema.copy()
        
    def reset(self):
        """Reset smoother state"""
        self.ema.fill(0)
        self.initialized = False


# ============================================================================
# DSP PIPELINE
# ============================================================================

@dataclass
class DSPConfig:
    """Configuration for the DSP pipeline"""
    # Sampling
    sample_rate: float = 250.0
    num_channels: int = 8
    
    # DC Blocking
    dc_block_enabled: bool = True
    dc_block_alpha: float = 0.995  # ~0.8 Hz cutoff at 250 SPS
    
    # Notch Filter
    notch_enabled: bool = True
    notch_freq: float = 60.0  # 50 for Europe, 60 for Americas
    notch_harmonics: int = 3  # Filter 60, 120, 180 Hz
    notch_q: float = 30.0     # Quality factor
    
    # Bandpass Filter
    bandpass_enabled: bool = True
    highpass_freq: float = 0.5   # Hz
    lowpass_freq: float = 45.0   # Hz
    filter_order: int = 4
    
    # Artifact Rejection
    artifact_enabled: bool = True
    artifact_threshold: float = 150.0  # µV
    artifact_blanking: int = 5         # samples
    
    # Common Average Reference
    car_enabled: bool = False
    car_exclude_channels: List[int] = field(default_factory=list)
    
    # Smoothing
    smoothing_enabled: bool = False
    smoothing_alpha: float = 0.3


class DSPPipeline:
    """
    Complete real-time DSP pipeline for EEG signal hygiene.
    Processes samples through configurable filter chain.
    """
    
    def __init__(self, config: DSPConfig):
        self.config = config
        self.filters: List[Tuple[str, Callable]] = []
        self.artifact_flags = np.zeros(config.num_channels, dtype=bool)
        
        self._build_pipeline()
        
    def _build_pipeline(self):
        """Build filter chain based on configuration"""
        cfg = self.config
        print("\n📊 Building DSP Pipeline:")
        print(f"   Sample Rate: {cfg.sample_rate} Hz")
        print(f"   Channels: {cfg.num_channels}")
        
        # 1. DC Blocking (first to remove drift before other filters)
        if cfg.dc_block_enabled:
            dc_blocker = DCBlocker(cfg.dc_block_alpha, cfg.num_channels)
            self.filters.append(("DC Block", dc_blocker.process))
            print(f"  ✓ DC Blocker (α={cfg.dc_block_alpha})")
            
        if not SCIPY_AVAILABLE:
            print("  ⚠ Scipy not available - skipping IIR filters")
        else:
            # 2. Notch Filter Bank
            if cfg.notch_enabled:
                notch_bank = NotchFilterBank(
                    cfg.notch_freq,
                    cfg.sample_rate,
                    cfg.notch_harmonics,
                    cfg.notch_q,
                    cfg.num_channels
                )
                self.filters.append(("Notch", notch_bank.process))
                
            # 3. Bandpass Filter
            if cfg.bandpass_enabled:
                bandpass = IIRFilter.create_bandpass(
                    cfg.highpass_freq,
                    cfg.lowpass_freq,
                    cfg.sample_rate,
                    cfg.filter_order,
                    cfg.num_channels
                )
                self.filters.append(("Bandpass", bandpass.process))
                print(f"  ✓ Bandpass {cfg.highpass_freq}-{cfg.lowpass_freq} Hz (order {cfg.filter_order})")
                
        # 4. Artifact Rejection
        if cfg.artifact_enabled:
            self.artifact_rejector = ArtifactRejector(
                cfg.artifact_threshold,
                cfg.artifact_blanking,
                cfg.num_channels
            )
            # Don't add to filter chain - handle separately for flags
            print(f"  ✓ Artifact Rejection (±{cfg.artifact_threshold} µV)")
        else:
            self.artifact_rejector = None
            
        # 5. Common Average Reference
        if cfg.car_enabled:
            car = CommonAverageReference(cfg.num_channels, cfg.car_exclude_channels)
            self.filters.append(("CAR", car.process))
            print(f"  ✓ Common Average Reference")
            
        # 6. Smoothing (optional, last)
        if cfg.smoothing_enabled:
            smoother = ExponentialSmoother(cfg.smoothing_alpha, cfg.num_channels)
            self.filters.append(("Smooth", smoother.process))
            print(f"  ✓ Exponential Smoothing (α={cfg.smoothing_alpha})")
            
        print(f"\n   Pipeline: {' → '.join([name for name, _ in self.filters])}")
        if self.artifact_rejector:
            print(f"   + Artifact flagging\n")
        
    def process(self, sample: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Process single sample through entire pipeline.
        
        Args:
            sample: Raw sample array [num_channels]
            
        Returns:
            processed: Cleaned sample
            artifact_flags: Boolean flags for each channel
        """
        output = sample.astype(np.float64)
        
        # Apply filter chain
        for name, filter_fn in self.filters:
            output = filter_fn(output)
            
        # Artifact detection (after filtering for better threshold accuracy)
        if self.artifact_rejector:
            output, self.artifact_flags = self.artifact_rejector.process(output)
        else:
            self.artifact_flags = np.zeros(self.config.num_channels, dtype=bool)
            
        return output, self.artifact_flags
        
    def process_batch(self, samples: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Process batch of samples.
        
        Args:
            samples: Raw samples [num_samples, num_channels]
            
        Returns:
            processed: Cleaned samples
            artifact_flags: Boolean flags [num_samples, num_channels]
        """
        num_samples = samples.shape[0]
        output = np.zeros_like(samples, dtype=np.float64)
        flags = np.zeros((num_samples, self.config.num_channels), dtype=bool)
        
        for i in range(num_samples):
            output[i], flags[i] = self.process(samples[i])
            
        return output, flags
        
    def get_stats(self) -> Dict:
        """Get pipeline statistics"""
        stats = {
            "num_filters": len(self.filters),
            "filter_chain": [name for name, _ in self.filters]
        }
        if self.artifact_rejector:
            stats["artifact_rate_percent"] = self.artifact_rejector.get_artifact_rate()
        return stats


# ============================================================================
# ADS1299 CONSTANTS (from original bridge)
# ============================================================================

class ADS1299Register(IntEnum):
    ID = 0x00
    CONFIG1 = 0x01
    CONFIG2 = 0x02
    CONFIG3 = 0x03
    CH1SET = 0x05
    BIAS_SENSP = 0x0D
    BIAS_SENSN = 0x0E


class ADS1299Command(IntEnum):
    WAKEUP = 0x02
    STANDBY = 0x04
    RESET = 0x06
    START = 0x08
    STOP = 0x0A
    RDATAC = 0x10
    SDATAC = 0x11
    RREG = 0x20
    WREG = 0x40


class ADS1299Gain(IntEnum):
    GAIN_1 = 0x00
    GAIN_2 = 0x10
    GAIN_4 = 0x20
    GAIN_6 = 0x30
    GAIN_8 = 0x40
    GAIN_12 = 0x50
    GAIN_24 = 0x60


class ADS1299SampleRate(IntEnum):
    SPS_16000 = 0x00
    SPS_8000 = 0x01
    SPS_4000 = 0x02
    SPS_2000 = 0x03
    SPS_1000 = 0x04
    SPS_500 = 0x05
    SPS_250 = 0x06


VREF = 4.5
NUM_CHANNELS = 8
STATUS_BYTES = 3
BYTES_PER_CHANNEL = 3
DEFAULT_DRDY_PIN = 17
DEFAULT_RESET_PIN = 27


# ============================================================================
# PIEEG DEVICE WITH DSP
# ============================================================================

@dataclass
class PiEEGDSPConfig:
    """Extended configuration for PiEEG with DSP"""
    # Hardware
    spi_bus: int = 0
    spi_device: int = 0
    spi_speed: int = 2000000
    drdy_pin: int = DEFAULT_DRDY_PIN
    reset_pin: int = DEFAULT_RESET_PIN
    sample_rate: ADS1299SampleRate = ADS1299SampleRate.SPS_250
    gain: ADS1299Gain = ADS1299Gain.GAIN_24
    num_channels: int = 8
    daisy_chain: bool = False
    
    # DSP
    dsp_config: DSPConfig = field(default_factory=DSPConfig)


class PiEEGDeviceDSP:
    """PiEEG device with integrated DSP pipeline"""
    
    def __init__(self, config: PiEEGDSPConfig):
        self.config = config
        self.spi = None
        self.is_streaming = False
        self.sample_count = 0
        self.start_time = 0.0
        
        # Calculate scale factor
        gain_values = {0x00: 1, 0x10: 2, 0x20: 4, 0x30: 6, 0x40: 8, 0x50: 12, 0x60: 24}
        gain = gain_values.get(config.gain, 24)
        self.scale_uv = (2 * VREF / gain) / (2**24) * 1e6
        
        # DSP Pipeline
        config.dsp_config.sample_rate = self._get_sample_rate_hz()
        config.dsp_config.num_channels = config.num_channels
        self.dsp = DSPPipeline(config.dsp_config)
        
    def _get_sample_rate_hz(self) -> int:
        rates = {0: 16000, 1: 8000, 2: 4000, 3: 2000, 4: 1000, 5: 500, 6: 250}
        return rates.get(self.config.sample_rate, 250)
        
    def _get_gain_value(self) -> int:
        gains = {0x00: 1, 0x10: 2, 0x20: 4, 0x30: 6, 0x40: 8, 0x50: 12, 0x60: 24}
        return gains.get(self.config.gain, 24)
        
    def setup_gpio(self):
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        GPIO.setup(self.config.drdy_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.setup(self.config.reset_pin, GPIO.OUT)
        GPIO.output(self.config.reset_pin, GPIO.HIGH)
        
    def setup_spi(self):
        self.spi = spidev.SpiDev()
        self.spi.open(self.config.spi_bus, self.config.spi_device)
        self.spi.max_speed_hz = self.config.spi_speed
        self.spi.mode = 0b01
        
    def reset(self):
        GPIO.output(self.config.reset_pin, GPIO.LOW)
        time.sleep(0.001)
        GPIO.output(self.config.reset_pin, GPIO.HIGH)
        time.sleep(0.1)
        
    def send_command(self, cmd: int):
        self.spi.xfer2([cmd])
        time.sleep(0.000004)
        
    def write_register(self, reg: int, value: int):
        self.send_command(ADS1299Command.SDATAC)
        self.spi.xfer2([ADS1299Command.WREG | reg, 0x00, value])
        time.sleep(0.000004)
        
    def read_register(self, reg: int) -> int:
        self.send_command(ADS1299Command.SDATAC)
        result = self.spi.xfer2([ADS1299Command.RREG | reg, 0x00, 0x00])
        return result[2]
        
    def configure(self):
        self.send_command(ADS1299Command.SDATAC)
        time.sleep(0.001)
        
        device_id = self.read_register(ADS1299Register.ID)
        if (device_id & 0x1F) != 0x1E:
            print(f"Warning: Unexpected device ID: 0x{device_id:02X}")
        else:
            print(f"✓ ADS1299 detected (ID: 0x{device_id:02X})")
            
        config1 = self.config.sample_rate
        if self.config.daisy_chain:
            config1 |= 0xC0
        else:
            config1 |= 0x90
        self.write_register(ADS1299Register.CONFIG1, config1)
        
        self.write_register(ADS1299Register.CONFIG2, 0xC0)
        self.write_register(ADS1299Register.CONFIG3, 0xEC)
        time.sleep(0.15)
        
        for ch in range(8):
            self.write_register(ADS1299Register.CH1SET + ch, self.config.gain | 0x00)
            
        self.write_register(ADS1299Register.BIAS_SENSP, 0xFF)
        self.write_register(ADS1299Register.BIAS_SENSN, 0xFF)
        
        print(f"✓ ADS1299 configured: {self._get_sample_rate_hz()} SPS, Gain: {self._get_gain_value()}x")
        
    def start_streaming(self):
        self.send_command(ADS1299Command.START)
        time.sleep(0.001)
        self.send_command(ADS1299Command.RDATAC)
        self.is_streaming = True
        self.sample_count = 0
        self.start_time = time.time()
        print("✓ DSP Streaming started")
        
    def stop_streaming(self):
        self.send_command(ADS1299Command.SDATAC)
        self.send_command(ADS1299Command.STOP)
        self.is_streaming = False
        
        elapsed = time.time() - self.start_time
        if elapsed > 0:
            actual_rate = self.sample_count / elapsed
            stats = self.dsp.get_stats()
            print(f"✓ Streaming stopped. {self.sample_count} samples, {actual_rate:.1f} SPS")
            if "artifact_rate_percent" in stats:
                print(f"  Artifact rate: {stats['artifact_rate_percent']:.2f}%")
                
    def wait_for_drdy(self, timeout: float = 0.1) -> bool:
        start = time.time()
        while GPIO.input(self.config.drdy_pin) == GPIO.HIGH:
            if time.time() - start > timeout:
                return False
            time.sleep(0.0001)
        return True
        
    def read_sample(self) -> Optional[Tuple[List[float], List[bool]]]:
        """Read and process one sample through DSP pipeline"""
        if not self.wait_for_drdy():
            return None
            
        num_bytes = STATUS_BYTES + (self.config.num_channels * BYTES_PER_CHANNEL)
        data = self.spi.xfer2([0x00] * num_bytes)
        
        # Parse raw channels
        raw_channels = np.zeros(self.config.num_channels)
        for ch in range(self.config.num_channels):
            offset = STATUS_BYTES + (ch * BYTES_PER_CHANNEL)
            value = (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2]
            if value & 0x800000:
                value -= 0x1000000
            raw_channels[ch] = value * self.scale_uv
            
        # Apply DSP pipeline
        processed, artifact_flags = self.dsp.process(raw_channels)
        
        self.sample_count += 1
        return processed.tolist(), artifact_flags.tolist()
        
    def connect(self) -> bool:
        try:
            self.setup_gpio()
            self.setup_spi()
            self.reset()
            self.configure()
            return True
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            return False
            
    def disconnect(self):
        if self.is_streaming:
            self.stop_streaming()
        if self.spi:
            self.spi.close()
        GPIO.cleanup()


# ============================================================================
# SIMULATOR WITH DSP
# ============================================================================

class PiEEGSimulatorDSP:
    """Simulates PiEEG with DSP for development"""
    
    def __init__(self, config: PiEEGDSPConfig):
        self.config = config
        self.is_streaming = False
        self.sample_count = 0
        self.start_time = 0.0
        self._last_sample_time = 0.0
        self._sample_interval = 1.0 / self._get_sample_rate_hz()
        
        # Simulate various EEG rhythms
        self._phase = np.zeros(8)
        # Mix of alpha (8-12 Hz), beta (12-30 Hz), theta (4-8 Hz)
        self._freqs = [10.0, 10.5, 22.0, 11.0, 6.0, 9.0, 25.0, 10.0]
        self._amps = [30.0, 35.0, 10.0, 25.0, 20.0, 30.0, 8.0, 28.0]
        
        # Simulate powerline interference
        self._powerline_phase = 0.0
        self._powerline_freq = config.dsp_config.notch_freq
        
        # DSP Pipeline
        config.dsp_config.sample_rate = self._get_sample_rate_hz()
        config.dsp_config.num_channels = config.num_channels
        self.dsp = DSPPipeline(config.dsp_config)
        
    def _get_sample_rate_hz(self) -> int:
        rates = {0: 16000, 1: 8000, 2: 4000, 3: 2000, 4: 1000, 5: 500, 6: 250}
        return rates.get(self.config.sample_rate, 250)
        
    def connect(self) -> bool:
        print(f"✓ [SIMULATION] PiEEG+DSP simulator ({self._get_sample_rate_hz()} SPS)")
        return True
        
    def disconnect(self):
        self.is_streaming = False
        
    def start_streaming(self):
        self.is_streaming = True
        self.sample_count = 0
        self.start_time = time.time()
        self._last_sample_time = self.start_time
        print("✓ [SIMULATION] DSP Streaming started")
        
    def stop_streaming(self):
        self.is_streaming = False
        elapsed = time.time() - self.start_time
        if elapsed > 0:
            stats = self.dsp.get_stats()
            print(f"✓ [SIMULATION] Stopped. {self.sample_count} samples, {self.sample_count/elapsed:.1f} SPS")
            if "artifact_rate_percent" in stats:
                print(f"  Artifact rate: {stats['artifact_rate_percent']:.2f}%")
                
    def read_sample(self) -> Optional[Tuple[List[float], List[bool]]]:
        """Generate simulated noisy EEG and process through DSP"""
        now = time.time()
        
        if now - self._last_sample_time < self._sample_interval * 0.9:
            return None
            
        self._last_sample_time = now
        dt = self._sample_interval
        
        # Generate raw signal with realistic artifacts
        raw_channels = np.zeros(self.config.num_channels)
        
        for i in range(self.config.num_channels):
            self._phase[i] += 2 * np.pi * self._freqs[i] * dt
            
            # EEG rhythm
            eeg = self._amps[i] * np.sin(self._phase[i])
            
            # Add powerline interference (before DSP removes it)
            self._powerline_phase += 2 * np.pi * self._powerline_freq * dt
            powerline = 15 * np.sin(self._powerline_phase)  # 15 µV artifact
            
            # Add DC drift
            dc_drift = 50 * np.sin(2 * np.pi * 0.05 * now)  # Slow 0.05 Hz drift
            
            # Add random noise
            noise = np.random.normal(0, 3)
            
            # Occasional large artifact (muscle twitch simulation)
            if np.random.random() < 0.001:  # 0.1% chance
                noise += np.random.choice([-1, 1]) * 200  # ±200 µV spike
                
            raw_channels[i] = eeg + powerline + dc_drift + noise
            
        # Apply DSP pipeline
        processed, artifact_flags = self.dsp.process(raw_channels)
        
        self.sample_count += 1
        return processed.tolist(), artifact_flags.tolist()


# ============================================================================
# WEBSOCKET BRIDGE WITH DSP
# ============================================================================

class PiEEGBridgeDSP:
    """WebSocket bridge with integrated DSP"""
    
    def __init__(self, config: PiEEGDSPConfig, ws_host: str = "0.0.0.0", 
                 ws_port: int = 8766):
        self.config = config
        self.ws_host = ws_host
        self.ws_port = ws_port
        self.clients: set = set()
        self.streaming = False
        
        # Select device implementation
        if IS_RASPBERRY_PI:
            self.device = PiEEGDeviceDSP(config)
        else:
            self.device = PiEEGSimulatorDSP(config)
            
    async def stream_task(self):
        """Background task to read, process, and broadcast samples"""
        sample_buffer = []
        artifact_buffer = []
        last_send = time.time()
        
        while self.streaming:
            result = self.device.read_sample()
            if result:
                sample, artifacts = result
                sample_buffer.append(sample)
                artifact_buffer.append(artifacts)
                
                now = time.time()
                if len(sample_buffer) >= 10 or (now - last_send) > 0.02:
                    if self.clients and sample_buffer:
                        packet = self._pack_samples_dsp(sample_buffer, artifact_buffer, now)
                        
                        await asyncio.gather(
                            *[client.send(packet) for client in self.clients],
                            return_exceptions=True
                        )
                        sample_buffer.clear()
                        artifact_buffer.clear()
                        last_send = now
                        
            await asyncio.sleep(0.0001)
            
    def _pack_samples_dsp(self, samples: List[List[float]], 
                          artifacts: List[List[bool]], 
                          timestamp: float) -> bytes:
        """Pack DSP-processed samples with artifact flags"""
        num_samples = len(samples)
        num_channels = len(samples[0]) if samples else 8
        
        # Header: magic (2) + type (1) + num_samples (2) + num_channels (1) + timestamp (8)
        # Type: 0x01 = raw, 0x02 = DSP processed
        header = struct.pack('>HBHBD', 0xEEEE, 0x02, num_samples, num_channels, timestamp)
        
        # Data: [float32 × channels + artifact_byte] × samples
        data = b''
        for i, sample in enumerate(samples):
            data += struct.pack(f'>{num_channels}f', *sample)
            # Pack artifact flags as single byte (1 bit per channel)
            artifact_byte = sum((1 << ch) for ch, flag in enumerate(artifacts[i]) if flag)
            data += struct.pack('B', artifact_byte)
            
        return header + data
        
    async def handle_client(self, websocket):
        """Handle WebSocket client connection"""
        client_addr = websocket.remote_address
        print(f"→ Client connected: {client_addr}")
        self.clients.add(websocket)
        
        try:
            dsp_cfg = self.config.dsp_config
            await websocket.send(json.dumps({
                "type": "device_info",
                "device": "PiEEG-DSP",
                "channels": self.config.num_channels,
                "sample_rate": self.device._get_sample_rate_hz(),
                "dsp": {
                    "enabled": True,
                    "dc_block": dsp_cfg.dc_block_enabled,
                    "notch_freq": dsp_cfg.notch_freq if dsp_cfg.notch_enabled else None,
                    "bandpass": [dsp_cfg.highpass_freq, dsp_cfg.lowpass_freq] if dsp_cfg.bandpass_enabled else None,
                    "artifact_threshold": dsp_cfg.artifact_threshold if dsp_cfg.artifact_enabled else None,
                    "car": dsp_cfg.car_enabled
                },
                "simulation": not IS_RASPBERRY_PI
            }))
            
            async for message in websocket:
                try:
                    cmd = json.loads(message)
                    await self._handle_command(websocket, cmd)
                except json.JSONDecodeError:
                    pass
                    
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.clients.discard(websocket)
            print(f"← Client disconnected: {client_addr}")
            
    async def _handle_command(self, websocket, cmd: dict):
        """Handle client commands"""
        cmd_type = cmd.get("type", "")
        
        if cmd_type == "start":
            if not self.streaming:
                self.device.start_streaming()
                self.streaming = True
                asyncio.create_task(self.stream_task())
            await websocket.send(json.dumps({"type": "status", "streaming": True}))
            
        elif cmd_type == "stop":
            self.streaming = False
            self.device.stop_streaming()
            await websocket.send(json.dumps({"type": "status", "streaming": False}))
            
        elif cmd_type == "get_stats":
            stats = self.device.dsp.get_stats()
            await websocket.send(json.dumps({"type": "stats", **stats}))
            
    async def run(self):
        """Start the WebSocket server"""
        if not self.device.connect():
            print("✗ Failed to connect to device")
            return
            
        print(f"\n🧠 PiEEG DSP Bridge")
        print(f"   WebSocket: ws://{self.ws_host}:{self.ws_port}")
        print(f"   Mode: {'Hardware' if IS_RASPBERRY_PI else 'Simulation'}")
        
        try:
            async with websockets.serve(self.handle_client, self.ws_host, self.ws_port):
                print("\n✓ Waiting for connections... (Ctrl+C to stop)\n")
                await asyncio.Future()  # Run forever
        except KeyboardInterrupt:
            print("\n\n⏹  Shutting down...")
        finally:
            self.streaming = False
            self.device.disconnect()


# ============================================================================
# CLI
# ============================================================================

def parse_args():
    parser = argparse.ArgumentParser(
        description="PiEEG WebSocket Bridge with Real-Time DSP",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage with 60 Hz notch (Americas)
  python pieeg_ws_bridge_dsp.py --notch 60
  
  # European 50 Hz with custom bandpass
  python pieeg_ws_bridge_dsp.py --notch 50 --highpass 1.0 --lowpass 40
  
  # Full signal hygiene
  python pieeg_ws_bridge_dsp.py --notch 60 --car --artifact-threshold 150
  
  # Minimal processing (DC block only)
  python pieeg_ws_bridge_dsp.py --no-notch --no-bandpass
        """
    )
    
    # Network
    parser.add_argument("--host", default="0.0.0.0", help="WebSocket bind address")
    parser.add_argument("--port", type=int, default=8766, help="WebSocket port")
    
    # Hardware
    parser.add_argument("--sample-rate", type=int, choices=[250, 500, 1000, 2000],
                        default=250, help="Sample rate in Hz")
    parser.add_argument("--gain", type=int, choices=[1, 2, 4, 6, 8, 12, 24],
                        default=24, help="PGA gain")
    parser.add_argument("--channels", type=int, default=8, help="Number of channels")
    
    # DSP: Notch
    notch_group = parser.add_mutually_exclusive_group()
    notch_group.add_argument("--notch", type=float, default=60.0,
                             help="Powerline frequency for notch filter (50 or 60 Hz)")
    notch_group.add_argument("--no-notch", action="store_true",
                             help="Disable notch filter")
    parser.add_argument("--notch-harmonics", type=int, default=3,
                        help="Number of harmonics to filter")
    parser.add_argument("--notch-q", type=float, default=30.0,
                        help="Notch filter Q factor")
    
    # DSP: Bandpass
    parser.add_argument("--highpass", type=float, default=0.5,
                        help="High-pass cutoff frequency (Hz)")
    parser.add_argument("--lowpass", type=float, default=45.0,
                        help="Low-pass cutoff frequency (Hz)")
    parser.add_argument("--no-bandpass", action="store_true",
                        help="Disable bandpass filter")
    parser.add_argument("--filter-order", type=int, default=4,
                        help="Butterworth filter order")
    
    # DSP: DC Block
    parser.add_argument("--no-dc-block", action="store_true",
                        help="Disable DC blocking filter")
    parser.add_argument("--dc-alpha", type=float, default=0.995,
                        help="DC blocker alpha (0.99-0.999)")
    
    # DSP: Artifact Rejection
    parser.add_argument("--artifact-threshold", type=float, default=150.0,
                        help="Artifact threshold in µV (0 to disable)")
    parser.add_argument("--no-artifact", action="store_true",
                        help="Disable artifact rejection")
    
    # DSP: CAR
    parser.add_argument("--car", action="store_true",
                        help="Enable Common Average Reference")
    parser.add_argument("--car-exclude", type=str, default="",
                        help="Channels to exclude from CAR (comma-separated, e.g., '0,7')")
    
    # DSP: Smoothing
    parser.add_argument("--smooth", type=float, default=0.0,
                        help="Smoothing alpha (0 to disable, 0.1-0.5 typical)")
    
    return parser.parse_args()


def main():
    args = parse_args()
    
    # Map sample rate to enum
    rate_map = {250: 6, 500: 5, 1000: 4, 2000: 3}
    gain_map = {1: 0x00, 2: 0x10, 4: 0x20, 6: 0x30, 8: 0x40, 12: 0x50, 24: 0x60}
    
    # Parse CAR exclude channels
    car_exclude = []
    if args.car_exclude:
        try:
            car_exclude = [int(x.strip()) for x in args.car_exclude.split(",")]
        except ValueError:
            print("Warning: Invalid --car-exclude format, ignoring")
    
    # Build DSP config
    dsp_config = DSPConfig(
        sample_rate=float(args.sample_rate),
        num_channels=args.channels,
        dc_block_enabled=not args.no_dc_block,
        dc_block_alpha=args.dc_alpha,
        notch_enabled=not args.no_notch,
        notch_freq=args.notch,
        notch_harmonics=args.notch_harmonics,
        notch_q=args.notch_q,
        bandpass_enabled=not args.no_bandpass,
        highpass_freq=args.highpass,
        lowpass_freq=args.lowpass,
        filter_order=args.filter_order,
        artifact_enabled=not args.no_artifact and args.artifact_threshold > 0,
        artifact_threshold=args.artifact_threshold,
        car_enabled=args.car,
        car_exclude_channels=car_exclude,
        smoothing_enabled=args.smooth > 0,
        smoothing_alpha=args.smooth if args.smooth > 0 else 0.3
    )
    
    # Build device config
    device_config = PiEEGDSPConfig(
        sample_rate=rate_map.get(args.sample_rate, 6),
        gain=gain_map.get(args.gain, 0x60),
        num_channels=args.channels,
        dsp_config=dsp_config
    )
    
    # Run bridge
    bridge = PiEEGBridgeDSP(device_config, args.host, args.port)
    asyncio.run(bridge.run())


if __name__ == "__main__":
    main()

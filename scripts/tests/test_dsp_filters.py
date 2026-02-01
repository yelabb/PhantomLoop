#!/usr/bin/env python3
"""
Unit tests for DSP filters in pieeg_ws_bridge_dsp.py

Tests cover:
- DC Blocker filter
- IIR Filter (notch, bandpass, highpass, lowpass)
- Notch Filter Bank
- Artifact Rejector
- Common Average Reference
- Exponential Smoother
- Full DSP Pipeline

Run with: pytest scripts/tests/test_dsp_filters.py -v
"""

import sys
import os
import pytest
import numpy as np

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import DSP components
from pieeg_ws_bridge_dsp import (
    DCBlocker,
    IIRFilter,
    NotchFilterBank,
    ArtifactRejector,
    CommonAverageReference,
    ExponentialSmoother,
    DSPConfig,
    DSPPipeline,
    SCIPY_AVAILABLE,
)


# ============================================================================
# DC BLOCKER TESTS
# ============================================================================

class TestDCBlocker:
    """Tests for DCBlocker filter"""

    def test_initialization(self):
        """Test DCBlocker initializes with correct parameters"""
        blocker = DCBlocker(alpha=0.995, num_channels=8)
        assert blocker.alpha == 0.995
        assert blocker.num_channels == 8
        assert blocker.x_prev.shape == (8,)
        assert blocker.y_prev.shape == (8,)

    def test_removes_dc_offset(self):
        """Test that DC blocker removes constant offset"""
        blocker = DCBlocker(alpha=0.99, num_channels=1)
        
        # Apply 1000 samples with DC offset of 100
        dc_offset = 100.0
        outputs = []
        for _ in range(1000):
            sample = np.array([dc_offset])
            output = blocker.process(sample)
            outputs.append(output[0])
        
        # After settling, output should be near zero
        assert abs(outputs[-1]) < 5.0, "DC offset should be removed"

    def test_passes_ac_signal(self):
        """Test that AC signals pass through with minimal attenuation"""
        blocker = DCBlocker(alpha=0.995, num_channels=1)
        fs = 250.0
        freq = 10.0  # 10 Hz signal (well above DC blocker cutoff)
        
        # Generate 2 seconds of 10 Hz sine wave
        t = np.arange(0, 2.0, 1/fs)
        signal = 50.0 * np.sin(2 * np.pi * freq * t)
        
        outputs = []
        for sample in signal:
            output = blocker.process(np.array([sample]))
            outputs.append(output[0])
        
        # Check last 250 samples (1 second, after settling)
        output_signal = np.array(outputs[-250:])
        input_signal = signal[-250:]
        
        # RMS should be similar (within 10%)
        input_rms = np.sqrt(np.mean(input_signal**2))
        output_rms = np.sqrt(np.mean(output_signal**2))
        attenuation = abs(output_rms - input_rms) / input_rms
        
        assert attenuation < 0.1, f"10 Hz signal attenuated by {attenuation*100:.1f}%"

    def test_reset(self):
        """Test that reset clears filter state"""
        blocker = DCBlocker(alpha=0.995, num_channels=4)
        
        # Process some samples
        for _ in range(10):
            blocker.process(np.array([100, 200, 300, 400]))
        
        # Reset
        blocker.reset()
        
        assert np.all(blocker.x_prev == 0)
        assert np.all(blocker.y_prev == 0)

    def test_multichannel(self):
        """Test that multichannel processing works independently"""
        blocker = DCBlocker(alpha=0.99, num_channels=3)
        
        # Different DC offsets per channel
        for _ in range(500):
            sample = np.array([100.0, 200.0, 300.0])
            output = blocker.process(sample)
        
        # All channels should converge to near zero
        assert np.all(np.abs(output) < 10.0)


# ============================================================================
# IIR FILTER TESTS
# ============================================================================

@pytest.mark.skipif(not SCIPY_AVAILABLE, reason="scipy not installed")
class TestIIRFilter:
    """Tests for IIRFilter class"""

    def test_notch_filter_creation(self):
        """Test notch filter creation"""
        notch = IIRFilter.create_notch(freq=60.0, fs=250.0, Q=30.0, num_channels=8)
        assert notch.sos is not None
        assert notch.num_channels == 8
        assert notch.zi.shape[0] == 8

    def test_notch_attenuates_target_frequency(self):
        """Test that notch filter attenuates the target frequency"""
        fs = 250.0
        notch_freq = 60.0
        notch = IIRFilter.create_notch(notch_freq, fs, Q=30.0, num_channels=1)
        
        # Generate 60 Hz signal
        t = np.arange(0, 2.0, 1/fs)
        signal_60hz = 50.0 * np.sin(2 * np.pi * notch_freq * t)
        
        outputs = []
        for sample in signal_60hz:
            output = notch.process(np.array([sample]))
            outputs.append(output[0])
        
        # Check last second (after filter settles)
        output_signal = np.array(outputs[-250:])
        input_signal = signal_60hz[-250:]
        
        input_rms = np.sqrt(np.mean(input_signal**2))
        output_rms = np.sqrt(np.mean(output_signal**2))
        
        attenuation_db = 20 * np.log10(output_rms / input_rms)
        assert attenuation_db < -20, f"60 Hz only attenuated by {attenuation_db:.1f} dB"

    def test_notch_passes_other_frequencies(self):
        """Test that notch filter passes non-target frequencies"""
        fs = 250.0
        notch = IIRFilter.create_notch(60.0, fs, Q=30.0, num_channels=1)
        
        # Generate 10 Hz signal (alpha band)
        t = np.arange(0, 2.0, 1/fs)
        signal_10hz = 50.0 * np.sin(2 * np.pi * 10.0 * t)
        
        outputs = []
        for sample in signal_10hz:
            output = notch.process(np.array([sample]))
            outputs.append(output[0])
        
        output_signal = np.array(outputs[-250:])
        input_signal = signal_10hz[-250:]
        
        input_rms = np.sqrt(np.mean(input_signal**2))
        output_rms = np.sqrt(np.mean(output_signal**2))
        
        attenuation = abs(output_rms - input_rms) / input_rms
        assert attenuation < 0.05, f"10 Hz attenuated by {attenuation*100:.1f}%"

    def test_bandpass_filter_creation(self):
        """Test bandpass filter creation"""
        bp = IIRFilter.create_bandpass(0.5, 45.0, fs=250.0, order=4, num_channels=8)
        assert bp.sos is not None
        assert bp.num_channels == 8

    def test_bandpass_attenuates_out_of_band(self):
        """Test bandpass filter attenuates frequencies outside passband"""
        fs = 250.0
        bp = IIRFilter.create_bandpass(1.0, 40.0, fs, order=4, num_channels=1)
        
        # Test 0.1 Hz signal (below passband)
        t = np.arange(0, 10.0, 1/fs)  # Longer for low freq
        signal_low = 50.0 * np.sin(2 * np.pi * 0.1 * t)
        
        outputs = []
        for sample in signal_low:
            output = bp.process(np.array([sample]))
            outputs.append(output[0])
        
        # Check output is significantly attenuated
        output_rms = np.sqrt(np.mean(np.array(outputs[-500:])**2))
        input_rms = np.sqrt(np.mean(signal_low[-500:]**2))
        
        assert output_rms < input_rms * 0.3, "0.1 Hz should be attenuated"

    def test_highpass_filter(self):
        """Test highpass filter creation and behavior"""
        fs = 250.0
        hp = IIRFilter.create_highpass(1.0, fs, order=4, num_channels=1)
        
        # DC should be blocked
        outputs = []
        for _ in range(500):
            output = hp.process(np.array([100.0]))
            outputs.append(output[0])
        
        assert abs(outputs[-1]) < 1.0, "DC should be blocked by highpass"

    def test_lowpass_filter(self):
        """Test lowpass filter creation and behavior"""
        fs = 250.0
        lp = IIRFilter.create_lowpass(40.0, fs, order=4, num_channels=1)
        
        # High frequency should be attenuated
        t = np.arange(0, 2.0, 1/fs)
        signal_100hz = 50.0 * np.sin(2 * np.pi * 100.0 * t)
        
        outputs = []
        for sample in signal_100hz:
            output = lp.process(np.array([sample]))
            outputs.append(output[0])
        
        output_rms = np.sqrt(np.mean(np.array(outputs[-250:])**2))
        input_rms = np.sqrt(np.mean(signal_100hz[-250:]**2))
        
        assert output_rms < input_rms * 0.1, "100 Hz should be strongly attenuated"

    def test_batch_processing(self):
        """Test batch processing matches sample-by-sample"""
        fs = 250.0
        
        # Create two identical filters
        bp1 = IIRFilter.create_bandpass(1.0, 40.0, fs, order=4, num_channels=2)
        bp2 = IIRFilter.create_bandpass(1.0, 40.0, fs, order=4, num_channels=2)
        
        # Generate test signal
        samples = np.random.randn(100, 2) * 50
        
        # Process sample-by-sample
        outputs1 = []
        for sample in samples:
            outputs1.append(bp1.process(sample))
        outputs1 = np.array(outputs1)
        
        # Process as batch
        outputs2 = bp2.process_batch(samples)
        
        np.testing.assert_array_almost_equal(outputs1, outputs2, decimal=10)


# ============================================================================
# NOTCH FILTER BANK TESTS
# ============================================================================

@pytest.mark.skipif(not SCIPY_AVAILABLE, reason="scipy not installed")
class TestNotchFilterBank:
    """Tests for NotchFilterBank class"""

    def test_creates_harmonics(self, capsys):
        """Test that filter bank creates filters for harmonics"""
        bank = NotchFilterBank(60.0, fs=250.0, num_harmonics=2, Q=30.0, num_channels=8)
        
        # Should have 2 filters: 60 Hz and 120 Hz
        assert len(bank.filters) == 2
        
        # Check console output
        captured = capsys.readouterr()
        assert "60" in captured.out or "60.0" in captured.out
        assert "120" in captured.out or "120.0" in captured.out

    def test_respects_nyquist(self):
        """Test that harmonics above Nyquist are not created"""
        # At 250 Hz sample rate, Nyquist is 125 Hz
        # So 60, 120 should work, but 180 should be skipped
        bank = NotchFilterBank(60.0, fs=250.0, num_harmonics=4, Q=30.0, num_channels=8)
        
        # Only 60 and 120 should be created (180, 240 > 125)
        assert len(bank.filters) == 2

    def test_attenuates_all_harmonics(self):
        """Test that all harmonic frequencies are attenuated"""
        fs = 1000.0  # Higher sample rate to test more harmonics
        bank = NotchFilterBank(60.0, fs, num_harmonics=3, Q=30.0, num_channels=1)
        
        for freq in [60.0, 120.0, 180.0]:
            bank.reset()
            t = np.arange(0, 1.0, 1/fs)
            signal = 50.0 * np.sin(2 * np.pi * freq * t)
            
            outputs = []
            for sample in signal:
                output = bank.process(np.array([sample]))
                outputs.append(output[0])
            
            output_rms = np.sqrt(np.mean(np.array(outputs[-500:])**2))
            input_rms = np.sqrt(np.mean(signal[-500:]**2))
            
            attenuation_db = 20 * np.log10(output_rms / input_rms + 1e-10)
            assert attenuation_db < -15, f"{freq} Hz only attenuated by {attenuation_db:.1f} dB"


# ============================================================================
# ARTIFACT REJECTOR TESTS
# ============================================================================

class TestArtifactRejector:
    """Tests for ArtifactRejector class"""

    def test_initialization(self):
        """Test ArtifactRejector initializes correctly"""
        ar = ArtifactRejector(threshold_uv=150.0, blanking_samples=5, num_channels=8)
        assert ar.threshold == 150.0
        assert ar.blanking_samples == 5
        assert ar.num_channels == 8
        assert ar.artifact_count == 0

    def test_passes_normal_samples(self):
        """Test that samples within threshold pass unchanged"""
        ar = ArtifactRejector(threshold_uv=150.0, blanking_samples=5, num_channels=2)
        
        sample = np.array([50.0, -50.0])
        cleaned, flags = ar.process(sample)
        
        np.testing.assert_array_equal(cleaned, sample)
        assert not np.any(flags)

    def test_detects_artifacts(self):
        """Test that samples exceeding threshold are flagged"""
        ar = ArtifactRejector(threshold_uv=150.0, blanking_samples=5, num_channels=2)
        
        # First, establish "last good" with a normal sample
        ar.process(np.array([50.0, 50.0]))
        
        # Now send artifact
        sample = np.array([200.0, 50.0])  # Channel 0 exceeds threshold
        cleaned, flags = ar.process(sample)
        
        assert flags[0] == True
        assert flags[1] == False
        assert cleaned[0] == 50.0  # Replaced with last good
        assert cleaned[1] == 50.0

    def test_blanking_period(self):
        """Test that blanking continues for specified samples"""
        ar = ArtifactRejector(threshold_uv=150.0, blanking_samples=3, num_channels=1)
        
        # Establish baseline
        ar.process(np.array([50.0]))
        
        # Trigger artifact
        ar.process(np.array([200.0]))
        
        # Next 3 samples should be blanked even if normal
        for i in range(3):
            cleaned, flags = ar.process(np.array([60.0]))
            assert flags[0] == True, f"Sample {i+1} should still be blanked"
        
        # 4th sample should be normal
        cleaned, flags = ar.process(np.array([60.0]))
        assert flags[0] == False

    def test_artifact_rate_calculation(self):
        """Test artifact rate percentage calculation"""
        ar = ArtifactRejector(threshold_uv=100.0, blanking_samples=0, num_channels=1)
        
        # Process 100 samples, 10 are artifacts
        for i in range(100):
            value = 150.0 if i % 10 == 0 else 50.0
            ar.process(np.array([value]))
        
        rate = ar.get_artifact_rate()
        assert 9 < rate < 11  # Should be ~10%

    def test_reset(self):
        """Test that reset clears state"""
        ar = ArtifactRejector(threshold_uv=150.0, blanking_samples=5, num_channels=2)
        
        # Accumulate some state
        for _ in range(50):
            ar.process(np.array([200.0, 200.0]))
        
        ar.reset()
        
        assert ar.artifact_count == 0
        assert ar.total_samples == 0
        assert np.all(ar.blanking_counter == 0)


# ============================================================================
# COMMON AVERAGE REFERENCE TESTS
# ============================================================================

class TestCommonAverageReference:
    """Tests for CommonAverageReference class"""

    def test_subtracts_mean(self):
        """Test that CAR subtracts channel mean"""
        car = CommonAverageReference(num_channels=4)
        
        sample = np.array([10.0, 20.0, 30.0, 40.0])
        output = car.process(sample)
        
        # Mean is 25, so output should be [-15, -5, 5, 15]
        expected = sample - 25.0
        np.testing.assert_array_almost_equal(output, expected)

    def test_output_mean_is_zero(self):
        """Test that output has zero mean"""
        car = CommonAverageReference(num_channels=8)
        
        sample = np.random.randn(8) * 50
        output = car.process(sample)
        
        assert abs(np.mean(output)) < 1e-10

    def test_exclude_channels(self):
        """Test that excluded channels don't affect average"""
        car = CommonAverageReference(num_channels=4, exclude_channels=[3])
        
        # Channel 3 has large value but should be excluded
        sample = np.array([10.0, 20.0, 30.0, 1000.0])
        output = car.process(sample)
        
        # Mean of channels 0,1,2 is 20
        expected = sample - 20.0
        np.testing.assert_array_almost_equal(output, expected)

    def test_all_excluded_returns_unchanged(self):
        """Test that excluding all channels returns unchanged sample"""
        car = CommonAverageReference(num_channels=3, exclude_channels=[0, 1, 2])
        
        sample = np.array([10.0, 20.0, 30.0])
        output = car.process(sample)
        
        np.testing.assert_array_equal(output, sample)


# ============================================================================
# EXPONENTIAL SMOOTHER TESTS
# ============================================================================

class TestExponentialSmoother:
    """Tests for ExponentialSmoother class"""

    def test_initialization(self):
        """Test smoother initializes correctly"""
        smoother = ExponentialSmoother(alpha=0.3, num_channels=8)
        assert smoother.alpha == 0.3
        assert not smoother.initialized

    def test_first_sample_passes_through(self):
        """Test first sample passes through unchanged"""
        smoother = ExponentialSmoother(alpha=0.3, num_channels=2)
        
        sample = np.array([100.0, 200.0])
        output = smoother.process(sample)
        
        np.testing.assert_array_equal(output, sample)
        assert smoother.initialized

    def test_smoothing_effect(self):
        """Test that smoothing reduces noise"""
        smoother = ExponentialSmoother(alpha=0.1, num_channels=1)
        
        # Generate noisy signal
        np.random.seed(42)
        clean = 50.0
        noisy = clean + np.random.randn(500) * 20
        
        outputs = []
        for sample in noisy:
            output = smoother.process(np.array([sample]))
            outputs.append(output[0])
        
        # Smoothed output should have less variance
        output_std = np.std(outputs[-200:])
        input_std = np.std(noisy[-200:])
        
        assert output_std < input_std * 0.5

    def test_step_response(self):
        """Test step response converges to new value"""
        smoother = ExponentialSmoother(alpha=0.3, num_channels=1)
        
        # Initialize at 0
        smoother.process(np.array([0.0]))
        
        # Step to 100
        outputs = []
        for _ in range(50):
            output = smoother.process(np.array([100.0]))
            outputs.append(output[0])
        
        # Should converge to ~100
        assert outputs[-1] > 99.0

    def test_reset(self):
        """Test reset clears state"""
        smoother = ExponentialSmoother(alpha=0.3, num_channels=2)
        
        smoother.process(np.array([100.0, 200.0]))
        smoother.reset()
        
        assert not smoother.initialized
        assert np.all(smoother.ema == 0)


# ============================================================================
# DSP PIPELINE TESTS
# ============================================================================

class TestDSPPipeline:
    """Tests for complete DSP pipeline"""

    def test_minimal_pipeline(self):
        """Test pipeline with only DC blocker"""
        config = DSPConfig(
            sample_rate=250.0,
            num_channels=4,
            dc_block_enabled=True,
            notch_enabled=False,
            bandpass_enabled=False,
            artifact_enabled=False,
            car_enabled=False,
            smoothing_enabled=False,
        )
        
        pipeline = DSPPipeline(config)
        
        # Should have 1 filter (DC block)
        assert len(pipeline.filters) == 1
        assert pipeline.filters[0][0] == "DC Block"

    @pytest.mark.skipif(not SCIPY_AVAILABLE, reason="scipy not installed")
    def test_full_pipeline(self):
        """Test pipeline with all filters enabled"""
        config = DSPConfig(
            sample_rate=250.0,
            num_channels=8,
            dc_block_enabled=True,
            notch_enabled=True,
            notch_freq=60.0,
            bandpass_enabled=True,
            artifact_enabled=True,
            car_enabled=True,
            smoothing_enabled=True,
        )
        
        pipeline = DSPPipeline(config)
        
        # Should have multiple filters
        filter_names = [name for name, _ in pipeline.filters]
        assert "DC Block" in filter_names
        assert "Notch" in filter_names
        assert "Bandpass" in filter_names
        assert "CAR" in filter_names
        assert "Smooth" in filter_names

    def test_process_returns_correct_shape(self):
        """Test that process returns correct array shapes"""
        config = DSPConfig(
            sample_rate=250.0,
            num_channels=8,
            dc_block_enabled=True,
            notch_enabled=False,
            bandpass_enabled=False,
            artifact_enabled=True,
        )
        
        pipeline = DSPPipeline(config)
        
        sample = np.random.randn(8) * 50
        processed, flags = pipeline.process(sample)
        
        assert processed.shape == (8,)
        assert flags.shape == (8,)
        assert flags.dtype == bool

    def test_batch_process(self):
        """Test batch processing"""
        config = DSPConfig(
            sample_rate=250.0,
            num_channels=4,
            dc_block_enabled=True,
            notch_enabled=False,
            bandpass_enabled=False,
            artifact_enabled=True,
        )
        
        pipeline = DSPPipeline(config)
        
        samples = np.random.randn(100, 4) * 50
        processed, flags = pipeline.process_batch(samples)
        
        assert processed.shape == (100, 4)
        assert flags.shape == (100, 4)

    @pytest.mark.skipif(not SCIPY_AVAILABLE, reason="scipy not installed")
    def test_removes_powerline_interference(self):
        """Test that full pipeline removes 60 Hz interference"""
        config = DSPConfig(
            sample_rate=250.0,
            num_channels=1,
            dc_block_enabled=True,
            notch_enabled=True,
            notch_freq=60.0,
            bandpass_enabled=True,
            highpass_freq=0.5,
            lowpass_freq=45.0,
            artifact_enabled=False,
        )
        
        pipeline = DSPPipeline(config)
        
        # Generate signal: 10 Hz alpha + 60 Hz powerline
        fs = 250.0
        t = np.arange(0, 4.0, 1/fs)
        alpha = 30.0 * np.sin(2 * np.pi * 10.0 * t)
        powerline = 20.0 * np.sin(2 * np.pi * 60.0 * t)
        signal = alpha + powerline
        
        outputs = []
        for sample in signal:
            processed, _ = pipeline.process(np.array([sample]))
            outputs.append(processed[0])
        
        # Analyze output frequency content (last 2 seconds)
        output_signal = np.array(outputs[-500:])
        
        # FFT analysis
        from numpy.fft import rfft, rfftfreq
        freqs = rfftfreq(len(output_signal), 1/fs)
        spectrum = np.abs(rfft(output_signal))
        
        # Find power at 10 Hz and 60 Hz
        idx_10hz = np.argmin(np.abs(freqs - 10.0))
        idx_60hz = np.argmin(np.abs(freqs - 60.0))
        
        power_10hz = spectrum[idx_10hz]
        power_60hz = spectrum[idx_60hz]
        
        # 60 Hz should be much weaker than 10 Hz
        assert power_60hz < power_10hz * 0.1, "60 Hz not sufficiently attenuated"

    def test_get_stats(self):
        """Test statistics retrieval"""
        config = DSPConfig(
            sample_rate=250.0,
            num_channels=4,
            dc_block_enabled=True,
            artifact_enabled=True,
        )
        
        pipeline = DSPPipeline(config)
        
        # Process some samples with artifacts
        for _ in range(100):
            sample = np.random.randn(4) * 50
            pipeline.process(sample)
        
        stats = pipeline.get_stats()
        
        assert "num_filters" in stats
        assert "filter_chain" in stats
        assert "artifact_rate_percent" in stats


# ============================================================================
# CONFIGURATION TESTS
# ============================================================================

class TestDSPConfig:
    """Tests for DSPConfig dataclass"""

    def test_default_values(self):
        """Test default configuration values"""
        config = DSPConfig()
        
        assert config.sample_rate == 250.0
        assert config.num_channels == 8
        assert config.dc_block_enabled == True
        assert config.notch_enabled == True
        assert config.notch_freq == 60.0
        assert config.bandpass_enabled == True
        assert config.highpass_freq == 0.5
        assert config.lowpass_freq == 45.0
        assert config.artifact_enabled == True
        assert config.artifact_threshold == 150.0
        assert config.car_enabled == False
        assert config.smoothing_enabled == False

    def test_custom_values(self):
        """Test custom configuration"""
        config = DSPConfig(
            sample_rate=500.0,
            num_channels=16,
            notch_freq=50.0,
            highpass_freq=1.0,
            lowpass_freq=40.0,
            car_enabled=True,
        )
        
        assert config.sample_rate == 500.0
        assert config.num_channels == 16
        assert config.notch_freq == 50.0
        assert config.highpass_freq == 1.0
        assert config.lowpass_freq == 40.0
        assert config.car_enabled == True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

#!/usr/bin/env python3
"""
WebSocket Bridge for PiEEG (Raspberry Pi EEG Shield)

This script bridges the gap between browsers (WebSocket only) and the
PiEEG ADS1299 device connected via SPI to Raspberry Pi GPIO.

Based on the official PiEEG SDK from:
https://github.com/pieeg-club/PiEEG

Usage:
    1. Connect PiEEG shield to Raspberry Pi GPIO
    2. Ensure SPI is enabled: sudo raspi-config → Interface Options → SPI
    3. Run this bridge:
       python pieeg_ws_bridge.py
       
    4. In PhantomLoop, connect to: ws://<raspberry-pi-ip>:8766
       
Requirements:
    pip install websockets spidev RPi.GPIO numpy
    
    Or for BrainFlow integration:
    pip install websockets brainflow numpy

Hardware:
    - PiEEG 8-channel or PiEEG-16 (16-channel)
    - Raspberry Pi 3/4/5
    - Battery power (5V) - NEVER use mains power!
    
Protocol:
    - ADS1299 communicates via SPI at up to 2MHz
    - DRDY pin signals when new data is available
    - 24-bit signed samples, 8 channels per ADS1299
    - Configurable sampling rates: 250-16000 SPS
"""

import asyncio
import struct
import json
import sys
import time
import argparse
from typing import Optional, List, Callable
from dataclasses import dataclass
from enum import IntEnum
import numpy as np

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

# Optional BrainFlow integration
BRAINFLOW_AVAILABLE = False
try:
    from brainflow.board_shim import BoardShim, BrainFlowInputParams, BoardIds
    from brainflow.data_filter import DataFilter
    BRAINFLOW_AVAILABLE = True
except ImportError:
    pass

# ============================================================================
# ADS1299 CONSTANTS
# ============================================================================

class ADS1299Register(IntEnum):
    """ADS1299 register addresses"""
    ID = 0x00
    CONFIG1 = 0x01
    CONFIG2 = 0x02
    CONFIG3 = 0x03
    LOFF = 0x04
    CH1SET = 0x05
    CH2SET = 0x06
    CH3SET = 0x07
    CH4SET = 0x08
    CH5SET = 0x09
    CH6SET = 0x0A
    CH7SET = 0x0B
    CH8SET = 0x0C
    BIAS_SENSP = 0x0D
    BIAS_SENSN = 0x0E
    LOFF_SENSP = 0x0F
    LOFF_SENSN = 0x10
    LOFF_FLIP = 0x11
    LOFF_STATP = 0x12
    LOFF_STATN = 0x13
    GPIO = 0x14
    MISC1 = 0x15
    MISC2 = 0x16
    CONFIG4 = 0x17


class ADS1299Command(IntEnum):
    """ADS1299 SPI commands"""
    WAKEUP = 0x02
    STANDBY = 0x04
    RESET = 0x06
    START = 0x08
    STOP = 0x0A
    RDATAC = 0x10  # Read data continuous
    SDATAC = 0x11  # Stop read data continuous
    RDATA = 0x12   # Read single sample
    RREG = 0x20    # Read register (OR with address)
    WREG = 0x40    # Write register (OR with address)


class ADS1299Gain(IntEnum):
    """Programmable gain amplifier settings"""
    GAIN_1 = 0x00
    GAIN_2 = 0x10
    GAIN_4 = 0x20
    GAIN_6 = 0x30
    GAIN_8 = 0x40
    GAIN_12 = 0x50
    GAIN_24 = 0x60


class ADS1299SampleRate(IntEnum):
    """Sample rate settings (CONFIG1 register bits)"""
    SPS_16000 = 0x00
    SPS_8000 = 0x01
    SPS_4000 = 0x02
    SPS_2000 = 0x03
    SPS_1000 = 0x04
    SPS_500 = 0x05
    SPS_250 = 0x06


# Hardware constants
VREF = 4.5  # Internal reference voltage
NUM_CHANNELS = 8
BYTES_PER_CHANNEL = 3
STATUS_BYTES = 3
SAMPLE_BYTES = STATUS_BYTES + (NUM_CHANNELS * BYTES_PER_CHANNEL)  # 27 bytes

# Default GPIO pins (BCM numbering)
DEFAULT_DRDY_PIN = 17
DEFAULT_RESET_PIN = 27
DEFAULT_CS_PIN = 8  # CE0

# ============================================================================
# PiEEG DEVICE CLASS
# ============================================================================

@dataclass
class PiEEGConfig:
    """Configuration for PiEEG device"""
    spi_bus: int = 0
    spi_device: int = 0
    spi_speed: int = 2000000  # 2 MHz
    drdy_pin: int = DEFAULT_DRDY_PIN
    reset_pin: int = DEFAULT_RESET_PIN
    sample_rate: ADS1299SampleRate = ADS1299SampleRate.SPS_250
    gain: ADS1299Gain = ADS1299Gain.GAIN_24
    num_channels: int = 8
    daisy_chain: bool = False  # True for PiEEG-16


class PiEEGDevice:
    """Direct SPI interface to PiEEG ADS1299"""
    
    def __init__(self, config: PiEEGConfig):
        self.config = config
        self.spi: Optional[spidev.SpiDev] = None
        self.is_streaming = False
        self.sample_count = 0
        self.start_time = 0.0
        
        # Calculate scale factor for µV conversion
        gain_values = {0x00: 1, 0x10: 2, 0x20: 4, 0x30: 6, 0x40: 8, 0x50: 12, 0x60: 24}
        gain = gain_values.get(config.gain, 24)
        self.scale_uv = (2 * VREF / gain) / (2**24) * 1e6
        
    def setup_gpio(self):
        """Initialize GPIO pins"""
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        
        # DRDY as input with pull-up
        GPIO.setup(self.config.drdy_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        
        # Reset as output
        GPIO.setup(self.config.reset_pin, GPIO.OUT)
        GPIO.output(self.config.reset_pin, GPIO.HIGH)
        
    def setup_spi(self):
        """Initialize SPI interface"""
        self.spi = spidev.SpiDev()
        self.spi.open(self.config.spi_bus, self.config.spi_device)
        self.spi.max_speed_hz = self.config.spi_speed
        self.spi.mode = 0b01  # CPOL=0, CPHA=1 for ADS1299
        
    def reset(self):
        """Hardware reset via GPIO"""
        GPIO.output(self.config.reset_pin, GPIO.LOW)
        time.sleep(0.001)  # 1ms pulse
        GPIO.output(self.config.reset_pin, GPIO.HIGH)
        time.sleep(0.1)  # Wait for reset
        
    def send_command(self, cmd: int):
        """Send single-byte command"""
        self.spi.xfer2([cmd])
        time.sleep(0.000004)  # 4 TCLK cycles
        
    def write_register(self, reg: int, value: int):
        """Write to ADS1299 register"""
        self.send_command(ADS1299Command.SDATAC)  # Stop continuous read
        self.spi.xfer2([ADS1299Command.WREG | reg, 0x00, value])
        time.sleep(0.000004)
        
    def read_register(self, reg: int) -> int:
        """Read from ADS1299 register"""
        self.send_command(ADS1299Command.SDATAC)
        result = self.spi.xfer2([ADS1299Command.RREG | reg, 0x00, 0x00])
        return result[2]
        
    def configure(self):
        """Configure ADS1299 for EEG recording"""
        # Stop any ongoing conversion
        self.send_command(ADS1299Command.SDATAC)
        time.sleep(0.001)
        
        # Verify device ID (should be 0x3E for ADS1299)
        device_id = self.read_register(ADS1299Register.ID)
        if (device_id & 0x1F) != 0x1E:  # Check revision-independent ID bits
            print(f"Warning: Unexpected device ID: 0x{device_id:02X}")
        else:
            print(f"✓ ADS1299 detected (ID: 0x{device_id:02X})")
        
        # CONFIG1: Set sample rate, daisy chain mode
        config1 = self.config.sample_rate
        if self.config.daisy_chain:
            config1 |= 0xC0  # Enable daisy chain + clock output
        else:
            config1 |= 0x90  # CLK output disabled
        self.write_register(ADS1299Register.CONFIG1, config1)
        
        # CONFIG2: Internal test signal off
        self.write_register(ADS1299Register.CONFIG2, 0xC0)
        
        # CONFIG3: Enable internal reference, bias
        self.write_register(ADS1299Register.CONFIG3, 0xEC)
        time.sleep(0.15)  # Wait for reference to settle
        
        # Configure all channels with selected gain, normal input
        for ch in range(8):
            ch_reg = ADS1299Register.CH1SET + ch
            self.write_register(ch_reg, self.config.gain | 0x00)  # Normal electrode input
            
        # BIAS_SENSP/N: Enable all channels for bias
        self.write_register(ADS1299Register.BIAS_SENSP, 0xFF)
        self.write_register(ADS1299Register.BIAS_SENSN, 0xFF)
        
        print(f"✓ ADS1299 configured: {self._get_sample_rate_hz()} SPS, Gain: {self._get_gain_value()}x")
        
    def _get_sample_rate_hz(self) -> int:
        """Get configured sample rate in Hz"""
        rates = {0: 16000, 1: 8000, 2: 4000, 3: 2000, 4: 1000, 5: 500, 6: 250}
        return rates.get(self.config.sample_rate, 250)
        
    def _get_gain_value(self) -> int:
        """Get configured gain value"""
        gains = {0x00: 1, 0x10: 2, 0x20: 4, 0x30: 6, 0x40: 8, 0x50: 12, 0x60: 24}
        return gains.get(self.config.gain, 24)
        
    def start_streaming(self):
        """Start continuous data acquisition"""
        self.send_command(ADS1299Command.START)
        time.sleep(0.001)
        self.send_command(ADS1299Command.RDATAC)
        self.is_streaming = True
        self.sample_count = 0
        self.start_time = time.time()
        print("✓ Streaming started")
        
    def stop_streaming(self):
        """Stop data acquisition"""
        self.send_command(ADS1299Command.SDATAC)
        self.send_command(ADS1299Command.STOP)
        self.is_streaming = False
        
        elapsed = time.time() - self.start_time
        if elapsed > 0:
            actual_rate = self.sample_count / elapsed
            print(f"✓ Streaming stopped. {self.sample_count} samples, {actual_rate:.1f} SPS")
        
    def wait_for_drdy(self, timeout: float = 0.1) -> bool:
        """Wait for DRDY pin to go low (data ready)"""
        start = time.time()
        while GPIO.input(self.config.drdy_pin) == GPIO.HIGH:
            if time.time() - start > timeout:
                return False
            time.sleep(0.0001)  # 100µs polling
        return True
        
    def read_sample(self) -> Optional[List[float]]:
        """Read one sample (8 channels) when DRDY is low"""
        if not self.wait_for_drdy():
            return None
            
        # Read status + 8 channels (27 bytes total)
        num_bytes = STATUS_BYTES + (self.config.num_channels * BYTES_PER_CHANNEL)
        data = self.spi.xfer2([0x00] * num_bytes)
        
        # Parse channels
        channels = []
        for ch in range(self.config.num_channels):
            offset = STATUS_BYTES + (ch * BYTES_PER_CHANNEL)
            # 24-bit big-endian signed integer
            value = (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2]
            # Sign extend
            if value & 0x800000:
                value -= 0x1000000
            # Convert to µV
            channels.append(value * self.scale_uv)
            
        self.sample_count += 1
        return channels
        
    def connect(self) -> bool:
        """Initialize PiEEG connection"""
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
        """Clean up resources"""
        if self.is_streaming:
            self.stop_streaming()
        if self.spi:
            self.spi.close()
        GPIO.cleanup()


# ============================================================================
# SIMULATION MODE (for development without hardware)
# ============================================================================

class PiEEGSimulator:
    """Simulates PiEEG for development on non-Pi systems"""
    
    def __init__(self, config: PiEEGConfig):
        self.config = config
        self.is_streaming = False
        self.sample_count = 0
        self.start_time = 0.0
        self._last_sample_time = 0.0
        self._sample_interval = 1.0 / self._get_sample_rate_hz()
        
        # Simulate brain rhythms
        self._phase = np.zeros(8)
        self._freqs = [10.0, 10.5, 12.0, 11.0, 8.0, 9.0, 11.5, 10.0]  # Alpha band
        
    def _get_sample_rate_hz(self) -> int:
        rates = {0: 16000, 1: 8000, 2: 4000, 3: 2000, 4: 1000, 5: 500, 6: 250}
        return rates.get(self.config.sample_rate, 250)
        
    def connect(self) -> bool:
        print(f"✓ [SIMULATION] PiEEG simulator initialized ({self._get_sample_rate_hz()} SPS)")
        return True
        
    def disconnect(self):
        self.is_streaming = False
        
    def start_streaming(self):
        self.is_streaming = True
        self.sample_count = 0
        self.start_time = time.time()
        self._last_sample_time = self.start_time
        print("✓ [SIMULATION] Streaming started")
        
    def stop_streaming(self):
        self.is_streaming = False
        elapsed = time.time() - self.start_time
        if elapsed > 0:
            print(f"✓ [SIMULATION] Stopped. {self.sample_count} samples, {self.sample_count/elapsed:.1f} SPS")
        
    def read_sample(self) -> Optional[List[float]]:
        """Generate simulated EEG data (alpha waves + noise)"""
        now = time.time()
        
        # Rate limiting to match configured sample rate
        if now - self._last_sample_time < self._sample_interval * 0.9:
            return None
            
        self._last_sample_time = now
        
        # Generate realistic-ish EEG signals
        dt = self._sample_interval
        channels = []
        for i in range(self.config.num_channels):
            # Update phase
            self._phase[i] += 2 * np.pi * self._freqs[i] * dt
            
            # Alpha wave + noise (realistic µV range: 10-100 µV)
            alpha = 30 * np.sin(self._phase[i])
            noise = np.random.normal(0, 5)
            channels.append(alpha + noise)
            
        self.sample_count += 1
        return channels


# ============================================================================
# BRAINFLOW INTEGRATION
# ============================================================================

class PiEEGBrainFlow:
    """PiEEG via BrainFlow (if available)"""
    
    def __init__(self, config: PiEEGConfig):
        self.config = config
        self.board: Optional[BoardShim] = None
        self.is_streaming = False
        
    def connect(self) -> bool:
        try:
            params = BrainFlowInputParams()
            # PiEEG board ID in BrainFlow is 46
            self.board = BoardShim(46, params)
            self.board.prepare_session()
            print("✓ PiEEG connected via BrainFlow")
            return True
        except Exception as e:
            print(f"✗ BrainFlow connection failed: {e}")
            return False
            
    def disconnect(self):
        if self.board:
            if self.is_streaming:
                self.board.stop_stream()
            self.board.release_session()
            
    def start_streaming(self):
        if self.board:
            self.board.start_stream()
            self.is_streaming = True
            print("✓ BrainFlow streaming started")
            
    def stop_streaming(self):
        if self.board:
            self.board.stop_stream()
            self.is_streaming = False
            
    def read_sample(self) -> Optional[List[float]]:
        if not self.board or not self.is_streaming:
            return None
        try:
            data = self.board.get_current_board_data(1)
            if data.size > 0:
                eeg_channels = BoardShim.get_eeg_channels(46)
                return [data[ch][0] for ch in eeg_channels[:8]]
        except:
            pass
        return None


# ============================================================================
# WEBSOCKET BRIDGE
# ============================================================================

class PiEEGBridge:
    """WebSocket bridge for PiEEG data"""
    
    def __init__(self, config: PiEEGConfig, ws_host: str = "0.0.0.0", ws_port: int = 8766,
                 use_brainflow: bool = False):
        self.config = config
        self.ws_host = ws_host
        self.ws_port = ws_port
        self.clients: set = set()
        self.streaming = False
        self.device = None
        
        # Select device implementation
        if use_brainflow and BRAINFLOW_AVAILABLE:
            self.device = PiEEGBrainFlow(config)
        elif IS_RASPBERRY_PI:
            self.device = PiEEGDevice(config)
        else:
            self.device = PiEEGSimulator(config)
            
    async def stream_task(self):
        """Background task to read samples and broadcast"""
        sample_buffer = []
        last_send = time.time()
        
        while self.streaming:
            sample = self.device.read_sample()
            if sample:
                sample_buffer.append(sample)
                
                # Send in batches for efficiency (every 20ms or 10 samples)
                now = time.time()
                if len(sample_buffer) >= 10 or (now - last_send) > 0.02:
                    if self.clients and sample_buffer:
                        # Pack samples as binary for efficiency
                        # Format: [num_samples:u16] + [timestamp:f64] + [ch0:f32, ch1:f32, ...] × num_samples
                        packet = self._pack_samples(sample_buffer, now)
                        
                        await asyncio.gather(
                            *[client.send(packet) for client in self.clients],
                            return_exceptions=True
                        )
                        sample_buffer.clear()
                        last_send = now
                        
            await asyncio.sleep(0.0001)  # 100µs yield
            
    def _pack_samples(self, samples: List[List[float]], timestamp: float) -> bytes:
        """Pack samples into binary format for WebSocket transmission"""
        num_samples = len(samples)
        num_channels = len(samples[0]) if samples else 8
        
        # Header: magic (2) + num_samples (2) + num_channels (1) + timestamp (8)
        header = struct.pack('>HHBD', 0xEEEE, num_samples, num_channels, timestamp)
        
        # Data: float32 × channels × samples
        data = b''
        for sample in samples:
            data += struct.pack(f'>{num_channels}f', *sample)
            
        return header + data
        
    async def handle_client(self, websocket):
        """Handle WebSocket client connection"""
        client_addr = websocket.remote_address
        print(f"→ Client connected: {client_addr}")
        self.clients.add(websocket)
        
        try:
            # Send device info on connect
            await websocket.send(json.dumps({
                "type": "device_info",
                "device": "PiEEG",
                "channels": self.config.num_channels,
                "sampleRate": self._get_sample_rate(),
                "gain": self._get_gain(),
                "simulation": isinstance(self.device, PiEEGSimulator)
            }))
            
            async for message in websocket:
                try:
                    cmd = json.loads(message)
                    await self._handle_command(websocket, cmd)
                except json.JSONDecodeError:
                    print(f"Invalid JSON: {message}")
                    
        except websockets.exceptions.ConnectionClosed:
            print(f"← Client disconnected: {client_addr}")
        finally:
            self.clients.discard(websocket)
            
    async def _handle_command(self, websocket, cmd: dict):
        """Process client commands"""
        command = cmd.get("command")
        
        if command == "connect":
            if not self.streaming:
                if self.device.connect():
                    self.device.start_streaming()
                    self.streaming = True
                    asyncio.create_task(self.stream_task())
                    await websocket.send(json.dumps({
                        "type": "status",
                        "connected": True,
                        "streaming": True
                    }))
                else:
                    await websocket.send(json.dumps({
                        "type": "status",
                        "connected": False,
                        "error": "Failed to connect to PiEEG"
                    }))
                    
        elif command == "disconnect":
            self.streaming = False
            if self.device:
                self.device.stop_streaming()
                self.device.disconnect()
            await websocket.send(json.dumps({
                "type": "status",
                "connected": False,
                "streaming": False
            }))
            
        elif command == "set_gain":
            gain = cmd.get("gain", 24)
            gain_map = {1: 0x00, 2: 0x10, 4: 0x20, 6: 0x30, 8: 0x40, 12: 0x50, 24: 0x60}
            self.config.gain = gain_map.get(gain, 0x60)
            await websocket.send(json.dumps({
                "type": "config",
                "gain": gain
            }))
            
        elif command == "set_sample_rate":
            rate = cmd.get("rate", 250)
            rate_map = {250: 6, 500: 5, 1000: 4, 2000: 3, 4000: 2, 8000: 1, 16000: 0}
            self.config.sample_rate = rate_map.get(rate, 6)
            await websocket.send(json.dumps({
                "type": "config",
                "sampleRate": rate
            }))
            
    def _get_sample_rate(self) -> int:
        rates = {0: 16000, 1: 8000, 2: 4000, 3: 2000, 4: 1000, 5: 500, 6: 250}
        return rates.get(self.config.sample_rate, 250)
        
    def _get_gain(self) -> int:
        gains = {0x00: 1, 0x10: 2, 0x20: 4, 0x30: 6, 0x40: 8, 0x50: 12, 0x60: 24}
        return gains.get(self.config.gain, 24)
        
    async def run(self):
        """Start the WebSocket server"""
        mode = "BrainFlow" if isinstance(self.device, PiEEGBrainFlow) else \
               "SPI" if IS_RASPBERRY_PI else "Simulation"
        
        print(f"""
╔════════════════════════════════════════════════════════════╗
║             PiEEG WebSocket Bridge                         ║
╠════════════════════════════════════════════════════════════╣
║  WebSocket Server: ws://{self.ws_host}:{self.ws_port:<24}║
║  Mode:             {mode:<39}║
║  Channels:         {self.config.num_channels:<39}║
║  Sample Rate:      {self._get_sample_rate()} SPS{' ':<32}║
║  Gain:             {self._get_gain()}x{' ':<37}║
╠════════════════════════════════════════════════════════════╣
║  Commands:                                                 ║
║    {{"command": "connect"}}     - Start streaming           ║
║    {{"command": "disconnect"}}  - Stop streaming            ║
║    {{"command": "set_gain", "gain": 24}}                    ║
║    {{"command": "set_sample_rate", "rate": 250}}            ║
╚════════════════════════════════════════════════════════════╝
        """)
        
        async with websockets.serve(self.handle_client, self.ws_host, self.ws_port):
            await asyncio.Future()  # Run forever


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="WebSocket bridge for PiEEG")
    parser.add_argument("--host", default="0.0.0.0", help="WebSocket bind address (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8766, help="WebSocket port (default: 8766)")
    parser.add_argument("--channels", type=int, default=8, choices=[8, 16], help="Number of channels")
    parser.add_argument("--rate", type=int, default=250, 
                        choices=[250, 500, 1000, 2000, 4000, 8000, 16000],
                        help="Sample rate in SPS (default: 250)")
    parser.add_argument("--gain", type=int, default=24, 
                        choices=[1, 2, 4, 6, 8, 12, 24],
                        help="PGA gain (default: 24)")
    parser.add_argument("--brainflow", action="store_true", help="Use BrainFlow instead of direct SPI")
    parser.add_argument("--drdy-pin", type=int, default=17, help="DRDY GPIO pin (BCM, default: 17)")
    parser.add_argument("--reset-pin", type=int, default=27, help="Reset GPIO pin (BCM, default: 27)")
    
    args = parser.parse_args()
    
    # Map sample rate to register value
    rate_map = {250: 6, 500: 5, 1000: 4, 2000: 3, 4000: 2, 8000: 1, 16000: 0}
    gain_map = {1: 0x00, 2: 0x10, 4: 0x20, 6: 0x30, 8: 0x40, 12: 0x50, 24: 0x60}
    
    config = PiEEGConfig(
        sample_rate=rate_map[args.rate],
        gain=gain_map[args.gain],
        num_channels=args.channels,
        daisy_chain=(args.channels == 16),
        drdy_pin=args.drdy_pin,
        reset_pin=args.reset_pin
    )
    
    bridge = PiEEGBridge(config, args.host, args.port, use_brainflow=args.brainflow)
    
    try:
        asyncio.run(bridge.run())
    except KeyboardInterrupt:
        print("\nShutting down...")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
WebSocket Bridge for BrainFlow Synthetic Board

This script bridges the gap between browsers (WebSocket only) and the
BrainFlow Synthetic Board - perfect for development and testing without
any EEG hardware.

The Synthetic Board generates realistic EEG-like signals with:
- Configurable sample rates (250, 500, 1000 Hz, etc.)
- 8 or 16 EEG channels
- Simulated brain rhythms (alpha, beta, theta patterns)
- Optional noise and artifacts

Usage:
    1. Install dependencies:
       pip install websockets brainflow numpy
       
    2. Run this bridge:
       python synthetic_board_bridge.py
       
    3. Run with options:
       python synthetic_board_bridge.py --channels 16 --sample-rate 500
       
    4. In PhantomLoop, select "Brainflow Synthetic" device and connect to:
       ws://localhost:8768
       
Requirements:
    pip install websockets brainflow numpy

Protocol:
    - Starts BrainFlow Synthetic Board (BoardId: -1)
    - Streams EEG data via WebSocket in binary format
    - Supports multiple concurrent clients
    - Provides impedance simulation and device info
    
Documentation:
    https://brainflow.readthedocs.io/
"""

import asyncio
import struct
import json
import sys
import time
import argparse
import logging
from typing import Optional, List, Set
from dataclasses import dataclass, asdict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

try:
    import websockets
    from websockets.server import WebSocketServerProtocol
except ImportError:
    logger.error("websockets library required. Install with: pip install websockets")
    sys.exit(1)

try:
    import numpy as np
except ImportError:
    logger.error("numpy library required. Install with: pip install numpy")
    sys.exit(1)

try:
    from brainflow.board_shim import BoardShim, BrainFlowInputParams, BoardIds, BrainFlowPresets
    from brainflow.data_filter import DataFilter
    BRAINFLOW_AVAILABLE = True
except ImportError:
    logger.error("brainflow library required. Install with: pip install brainflow")
    sys.exit(1)


# ============================================================================
# CONSTANTS
# ============================================================================

# Synthetic Board ID in BrainFlow
SYNTHETIC_BOARD_ID = BoardIds.SYNTHETIC_BOARD.value  # -1

# Default WebSocket settings
DEFAULT_WS_HOST = "0.0.0.0"
DEFAULT_WS_PORT = 8770  # Match PhantomLoop's expected port for brainflow-synthetic

# Binary protocol magic bytes
MAGIC_BYTES = 0xEEEE


# ============================================================================
# CONFIGURATION
# ============================================================================

@dataclass
class SyntheticBoardConfig:
    """Configuration for the Synthetic Board bridge"""
    ws_host: str = DEFAULT_WS_HOST
    ws_port: int = DEFAULT_WS_PORT
    num_channels: int = 8
    sample_rate: int = 250
    buffer_size: int = 450000  # BrainFlow ring buffer size
    batch_size: int = 10  # Samples per WebSocket packet
    send_interval_ms: float = 20.0  # Target send interval


# ============================================================================
# SYNTHETIC BOARD WRAPPER
# ============================================================================

class SyntheticBoardDevice:
    """BrainFlow Synthetic Board wrapper"""
    
    def __init__(self, config: SyntheticBoardConfig):
        self.config = config
        self.board: Optional[BoardShim] = None
        self.is_streaming = False
        self.sample_count = 0
        self.start_time = 0.0
        
        # Channel information
        self.eeg_channels: List[int] = []
        self.timestamp_channel: int = 0
        self.sample_rate: int = config.sample_rate
        
    def connect(self) -> bool:
        """Initialize and prepare the Synthetic Board session"""
        try:
            # Enable BrainFlow logging for debugging
            BoardShim.enable_board_logger()
            
            # Configure input params (Synthetic board doesn't need much)
            params = BrainFlowInputParams()
            
            # Create board instance
            self.board = BoardShim(SYNTHETIC_BOARD_ID, params)
            
            # Prepare the session
            self.board.prepare_session()
            
            # Get channel information
            self.eeg_channels = BoardShim.get_eeg_channels(SYNTHETIC_BOARD_ID)
            self.timestamp_channel = BoardShim.get_timestamp_channel(SYNTHETIC_BOARD_ID)
            self.sample_rate = BoardShim.get_sampling_rate(SYNTHETIC_BOARD_ID)
            
            # Limit to configured number of channels
            if len(self.eeg_channels) > self.config.num_channels:
                self.eeg_channels = self.eeg_channels[:self.config.num_channels]
            
            logger.info(f"✓ Synthetic Board connected")
            logger.info(f"  → Sample rate: {self.sample_rate} Hz")
            logger.info(f"  → EEG channels: {len(self.eeg_channels)}")
            logger.info(f"  → Channel indices: {self.eeg_channels}")
            
            return True
            
        except Exception as e:
            logger.error(f"✗ Connection failed: {e}")
            return False
            
    def disconnect(self):
        """Release the board session"""
        if self.board:
            try:
                if self.is_streaming:
                    self.stop_streaming()
                self.board.release_session()
                logger.info("✓ Synthetic Board disconnected")
            except Exception as e:
                logger.error(f"Error during disconnect: {e}")
                
    def start_streaming(self):
        """Start data acquisition"""
        if not self.board:
            logger.error("Board not connected")
            return
            
        try:
            self.board.start_stream(self.config.buffer_size)
            self.is_streaming = True
            self.sample_count = 0
            self.start_time = time.time()
            logger.info("✓ Streaming started")
        except Exception as e:
            logger.error(f"Failed to start streaming: {e}")
            
    def stop_streaming(self):
        """Stop data acquisition"""
        if not self.board:
            return
            
        try:
            self.board.stop_stream()
            self.is_streaming = False
            
            elapsed = time.time() - self.start_time
            if elapsed > 0:
                actual_rate = self.sample_count / elapsed
                logger.info(f"✓ Streaming stopped. {self.sample_count} samples, {actual_rate:.1f} SPS")
        except Exception as e:
            logger.error(f"Error stopping stream: {e}")
            
    def get_samples(self, num_samples: int = 0) -> Optional[np.ndarray]:
        """
        Get samples from the board buffer.
        
        Args:
            num_samples: Number of samples to get (0 = all available)
            
        Returns:
            Array of shape (channels, samples) or None if no data
        """
        if not self.board or not self.is_streaming:
            return None
            
        try:
            if num_samples > 0:
                data = self.board.get_current_board_data(num_samples)
            else:
                data = self.board.get_board_data()
                
            if data.size == 0:
                return None
                
            # Extract EEG channels and timestamp
            eeg_data = data[self.eeg_channels, :]
            self.sample_count += eeg_data.shape[1]
            
            return eeg_data
            
        except Exception as e:
            logger.error(f"Error reading samples: {e}")
            return None
            
    def get_device_info(self) -> dict:
        """Get device information for client handshake"""
        return {
            "type": "device_info",
            "device": "BrainFlow Synthetic Board",
            "board_id": SYNTHETIC_BOARD_ID,
            "sample_rate": self.sample_rate,
            "num_channels": len(self.eeg_channels),
            "channels": self.eeg_channels,
            "channel_names": [f"EEG{i+1}" for i in range(len(self.eeg_channels))],
            "units": "µV",
            "timestamp": time.time()
        }


# ============================================================================
# WEBSOCKET BRIDGE
# ============================================================================

class SyntheticBoardBridge:
    """WebSocket bridge for Synthetic Board data"""
    
    def __init__(self, config: SyntheticBoardConfig):
        self.config = config
        self.device = SyntheticBoardDevice(config)
        self.clients: Set[WebSocketServerProtocol] = set()
        self.streaming = False
        self._stream_task: Optional[asyncio.Task] = None
        
    async def start(self):
        """Start the WebSocket server"""
        # Connect to the synthetic board
        if not self.device.connect():
            logger.error("Failed to connect to Synthetic Board")
            return
            
        # Start WebSocket server
        logger.info(f"Starting WebSocket server on ws://{self.config.ws_host}:{self.config.ws_port}")
        
        async with websockets.serve(
            self.handle_client,
            self.config.ws_host,
            self.config.ws_port,
            ping_interval=20,
            ping_timeout=20
        ):
            logger.info("✓ WebSocket server running. Press Ctrl+C to stop.")
            await asyncio.Future()  # Run forever
            
    async def handle_client(self, websocket: WebSocketServerProtocol):
        """Handle a WebSocket client connection"""
        client_addr = websocket.remote_address
        logger.info(f"→ Client connected: {client_addr}")
        
        self.clients.add(websocket)
        
        try:
            # Send device info on connect
            device_info = self.device.get_device_info()
            await websocket.send(json.dumps(device_info))
            
            # Start streaming if this is the first client
            if len(self.clients) == 1:
                await self._start_streaming()
                
            # Handle incoming messages
            async for message in websocket:
                await self._handle_message(websocket, message)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"← Client disconnected: {client_addr}")
        except Exception as e:
            logger.error(f"Client error: {e}")
        finally:
            self.clients.discard(websocket)
            
            # Stop streaming if no more clients
            if len(self.clients) == 0:
                await self._stop_streaming()
                
    async def _handle_message(self, websocket: WebSocketServerProtocol, message: str):
        """Handle incoming client message"""
        try:
            data = json.loads(message)
            msg_type = data.get("type", "")
            
            if msg_type == "start":
                await self._start_streaming()
                await websocket.send(json.dumps({"type": "ack", "action": "start"}))
                
            elif msg_type == "stop":
                await self._stop_streaming()
                await websocket.send(json.dumps({"type": "ack", "action": "stop"}))
                
            elif msg_type == "get_info":
                device_info = self.device.get_device_info()
                await websocket.send(json.dumps(device_info))
                
            elif msg_type == "ping":
                await websocket.send(json.dumps({"type": "pong", "timestamp": time.time()}))
                
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON message: {message}")
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            
    async def _start_streaming(self):
        """Start the streaming loop"""
        if self.streaming:
            return
            
        self.device.start_streaming()
        self.streaming = True
        self._stream_task = asyncio.create_task(self._stream_loop())
        logger.info("✓ Stream broadcasting started")
        
    async def _stop_streaming(self):
        """Stop the streaming loop"""
        if not self.streaming:
            return
            
        self.streaming = False
        
        if self._stream_task:
            self._stream_task.cancel()
            try:
                await self._stream_task
            except asyncio.CancelledError:
                pass
            self._stream_task = None
            
        self.device.stop_streaming()
        logger.info("✓ Stream broadcasting stopped")
        
    async def _stream_loop(self):
        """Background task to read and broadcast samples"""
        send_interval = self.config.send_interval_ms / 1000.0
        last_send = time.time()
        
        try:
            while self.streaming:
                now = time.time()
                
                # Get available samples
                samples = self.device.get_samples(self.config.batch_size)
                
                if samples is not None and samples.shape[1] > 0:
                    # Time to send?
                    if now - last_send >= send_interval:
                        # Send each sample as JSON (compatible with UniversalEEGAdapter)
                        for i in range(samples.shape[1]):
                            sample_data = {
                                "timestamp": now * 1000,  # ms timestamp
                                "channels": samples[:, i].tolist(),
                            }
                            message = json.dumps(sample_data)
                            
                            if self.clients:
                                await asyncio.gather(
                                    *[self._safe_send(client, message) for client in self.clients],
                                    return_exceptions=True
                                )
                        last_send = now
                        
                # Small yield to prevent CPU spinning
                await asyncio.sleep(0.001)
                
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Stream loop error: {e}")
            
    async def _safe_send(self, client: WebSocketServerProtocol, data: str):
        """Safely send data to a client"""
        try:
            await client.send(data)
        except Exception:
            pass  # Client will be removed on next iteration
            
    def _pack_samples(self, samples: np.ndarray, timestamp: float) -> bytes:
        """
        Pack samples into binary format for WebSocket transmission.
        
        Format:
            Header (13 bytes):
                - Magic bytes: 2 bytes (0xEEEE)
                - Num samples: 2 bytes (uint16, big-endian)
                - Num channels: 1 byte (uint8)
                - Timestamp: 8 bytes (float64, big-endian)
            Data:
                - float32 × channels × samples (big-endian)
        """
        num_channels, num_samples = samples.shape
        
        # Pack header (use lowercase 'd' for double)
        header = struct.pack('>HHBd', MAGIC_BYTES, num_samples, num_channels, timestamp)
        
        # Pack data (transpose to sample-major order for streaming)
        # Convert µV values to float32
        data_bytes = samples.T.astype(np.float32).tobytes()
        
        return header + data_bytes
        
    def stop(self):
        """Clean shutdown"""
        self.device.disconnect()


# ============================================================================
# CLI
# ============================================================================

def parse_args():
    """Parse command-line arguments"""
    parser = argparse.ArgumentParser(
        description="WebSocket Bridge for BrainFlow Synthetic Board",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python synthetic_board_bridge.py
    python synthetic_board_bridge.py --port 8768 --channels 16
    python synthetic_board_bridge.py --sample-rate 500 --debug
        """
    )
    
    parser.add_argument(
        "--host",
        default=DEFAULT_WS_HOST,
        help=f"WebSocket host (default: {DEFAULT_WS_HOST})"
    )
    
    parser.add_argument(
        "--port", "-p",
        type=int,
        default=DEFAULT_WS_PORT,
        help=f"WebSocket port (default: {DEFAULT_WS_PORT})"
    )
    
    parser.add_argument(
        "--channels", "-c",
        type=int,
        default=8,
        choices=[8, 16],
        help="Number of EEG channels (default: 8)"
    )
    
    parser.add_argument(
        "--sample-rate", "-s",
        type=int,
        default=250,
        choices=[125, 250, 500, 1000],
        help="Sample rate in Hz (default: 250)"
    )
    
    parser.add_argument(
        "--batch-size", "-b",
        type=int,
        default=10,
        help="Samples per WebSocket packet (default: 10)"
    )
    
    parser.add_argument(
        "--debug", "-d",
        action="store_true",
        help="Enable debug logging"
    )
    
    return parser.parse_args()


async def main():
    """Main entry point"""
    args = parse_args()
    
    # Configure logging level
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
        BoardShim.set_log_level(2)  # BrainFlow debug
    else:
        BoardShim.set_log_level(0)  # BrainFlow errors only
        
    # Create configuration
    config = SyntheticBoardConfig(
        ws_host=args.host,
        ws_port=args.port,
        num_channels=args.channels,
        sample_rate=args.sample_rate,
        batch_size=args.batch_size
    )
    
    # Print banner
    print("""
╔═══════════════════════════════════════════════════════════════╗
║         BrainFlow Synthetic Board WebSocket Bridge            ║
╠═══════════════════════════════════════════════════════════════╣
║  Perfect for development and testing without EEG hardware!    ║
╚═══════════════════════════════════════════════════════════════╝
    """)
    print(f"  Configuration:")
    print(f"    → WebSocket: ws://{config.ws_host}:{config.ws_port}")
    print(f"    → Channels:  {config.num_channels}")
    print(f"    → Sample Rate: {config.sample_rate} Hz")
    print(f"    → Batch Size: {config.batch_size} samples")
    print()
    
    # Create and start bridge
    bridge = SyntheticBoardBridge(config)
    
    try:
        await bridge.start()
    except KeyboardInterrupt:
        print("\n\nShutting down...")
    finally:
        bridge.stop()
        print("Goodbye!")


if __name__ == "__main__":
    asyncio.run(main())

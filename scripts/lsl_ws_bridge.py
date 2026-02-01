#!/usr/bin/env python3
"""
WebSocket Bridge for Lab Streaming Layer (LSL)

This script bridges the gap between browsers (WebSocket only) and any
LSL-compatible EEG device or software source.

Lab Streaming Layer (LSL) is an open-source networked middleware ecosystem
for real-time streaming of time series data (EEG, fNIRS, eye tracking, etc.)

Supported LSL Sources (130+ devices):
- OpenBCI (Cyton, Ganglion, Ultracortex)
- Muse (1, 2, S) via muse-lsl
- Emotiv (EPOC, Insight) via native LSL
- Brain Products (actiCHamp, LiveAmp)
- g.tec (g.USBamp, g.Nautilus)
- ANT Neuro (eego sport)
- BioSemi (ActiveTwo)
- NIRx (NIRSport, NIRScout) - fNIRS
- Cognionics (Quick-20, Quick-30)
- Neurosity (Notion, Crown)
- BrainAccess (HALO, MINI, MIDI)
- Eye trackers (Tobii, SR Research, Pupil Labs)
- Motion capture (OptiTrack, PhaseSpace)
- Any custom LSL outlet

Usage:
    1. Start your LSL stream source (OpenBCI GUI, muse-lsl, etc.)
    
    2. Run this bridge to discover and relay streams:
       python lsl_ws_bridge.py
       
    3. Run with specific stream name:
       python lsl_ws_bridge.py --stream "OpenBCI_EEG"
       
    4. In PhantomLoop, connect to: ws://localhost:8767
       
Requirements:
    pip install websockets pylsl numpy

Protocol:
    - Discovers LSL streams on the network
    - Pulls samples from inlet and forwards via WebSocket
    - Supports multiple concurrent inlets
    - Maintains LSL timestamp synchronization
    
Documentation:
    https://labstreaminglayer.readthedocs.io/
    https://github.com/labstreaminglayer/pylsl
"""

import asyncio
import json
import sys
import time
import struct
import argparse
from typing import Optional, List, Dict, Set, Tuple, Any
from dataclasses import dataclass, asdict
from enum import Enum
import threading
import queue
import logging

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
    from pylsl import StreamInlet, StreamInfo, resolve_streams, resolve_byprop, local_clock
    LSL_AVAILABLE = True
except ImportError:
    logger.warning("pylsl not available. Install with: pip install pylsl")
    LSL_AVAILABLE = False


# ============================================================================
# LSL CONSTANTS
# ============================================================================

class LSLChannelFormat(Enum):
    """LSL channel format types"""
    FLOAT32 = 1
    DOUBLE64 = 2
    STRING = 3
    INT32 = 4
    INT16 = 5
    INT8 = 6
    INT64 = 7
    UNDEFINED = 0


# Common LSL stream types
LSL_STREAM_TYPES = {
    'EEG': 'Electroencephalography',
    'EMG': 'Electromyography',
    'ECG': 'Electrocardiography',
    'EOG': 'Electrooculography',
    'fNIRS': 'Functional Near-Infrared Spectroscopy',
    'Gaze': 'Eye tracking gaze data',
    'Markers': 'Event markers',
    'Audio': 'Audio signal',
    'Video': 'Video frames',
    'MoCap': 'Motion capture',
    'Accelerometer': 'Accelerometer data',
    'Gyroscope': 'Gyroscope data',
    'PPG': 'Photoplethysmography',
    'GSR': 'Galvanic skin response',
}


# ============================================================================
# DATA STRUCTURES
# ============================================================================

@dataclass
class LSLStreamInfo:
    """Lightweight stream info for external use and testing"""
    name: str
    stream_type: str
    channel_count: int
    sampling_rate: float
    source_id: str
    channel_labels: Optional[List[str]] = None


@dataclass
class StreamMetadata:
    """Metadata about an LSL stream"""
    name: str
    stream_type: str
    channel_count: int
    sampling_rate: float
    channel_format: str
    source_id: str
    hostname: str
    uid: str
    version: float
    created_at: float
    channel_labels: List[str]
    channel_types: List[str]
    channel_units: List[str]
    manufacturer: str
    model: str
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Sample:
    """A single sample from an LSL stream"""
    timestamp: float
    lsl_timestamp: float
    channels: List[float]
    stream_id: str


# ============================================================================
# LSL INLET MANAGER
# ============================================================================

class LSLInletManager:
    """Manages LSL stream discovery and inlet connections"""
    
    def __init__(self):
        self.inlets: Dict[str, StreamInlet] = {}
        self.metadata: Dict[str, StreamMetadata] = {}
        self.sample_queues: Dict[str, queue.Queue] = {}
        self.running = False
        self.reader_threads: Dict[str, threading.Thread] = {}
        
    def discover_streams(
        self,
        stream_type: Optional[str] = None,
        stream_name: Optional[str] = None,
        timeout: float = 2.0
    ) -> List[StreamMetadata]:
        """Discover available LSL streams on the network"""
        if not LSL_AVAILABLE:
            return []
        
        logger.info(f"Discovering LSL streams (timeout={timeout}s)...")
        
        if stream_name:
            streams = resolve_byprop('name', stream_name, timeout=timeout)
        elif stream_type:
            streams = resolve_byprop('type', stream_type, timeout=timeout)
        else:
            streams = resolve_streams(timeout)
        
        metadata_list = []
        for stream_info in streams:
            metadata = self._parse_stream_info(stream_info)
            metadata_list.append(metadata)
            logger.info(f"  Found: {metadata.name} ({metadata.stream_type}) "
                       f"{metadata.channel_count}ch @ {metadata.sampling_rate}Hz")
        
        if not metadata_list:
            logger.warning("No LSL streams found on the network")
        
        return metadata_list
    
    def _parse_stream_info(self, info: 'StreamInfo') -> StreamMetadata:
        """Extract metadata from LSL StreamInfo"""
        # Get channel info from XML description
        channel_labels = []
        channel_types = []
        channel_units = []
        manufacturer = ""
        model = ""
        
        try:
            desc = info.desc()
            
            # Try to get manufacturer/model
            acq = desc.child("acquisition")
            if not acq.empty():
                manufacturer = acq.child_value("manufacturer") or ""
                model = acq.child_value("model") or ""
            
            # Get channel metadata
            channels = desc.child("channels")
            if not channels.empty():
                ch = channels.child("channel")
                while not ch.empty():
                    channel_labels.append(ch.child_value("label") or f"Ch{len(channel_labels)+1}")
                    channel_types.append(ch.child_value("type") or info.type())
                    channel_units.append(ch.child_value("unit") or "µV")
                    ch = ch.next_sibling("channel")
        except Exception as e:
            logger.warning(f"Could not parse stream description: {e}")
        
        # Fill in missing channel labels
        num_channels = info.channel_count()
        while len(channel_labels) < num_channels:
            channel_labels.append(f"Ch{len(channel_labels)+1}")
        while len(channel_types) < num_channels:
            channel_types.append(info.type())
        while len(channel_units) < num_channels:
            channel_units.append("µV")
        
        # Get channel format name
        format_names = {
            1: 'float32', 2: 'double64', 3: 'string',
            4: 'int32', 5: 'int16', 6: 'int8', 7: 'int64', 0: 'undefined'
        }
        channel_format = format_names.get(info.channel_format(), 'unknown')
        
        return StreamMetadata(
            name=info.name(),
            stream_type=info.type(),
            channel_count=num_channels,
            sampling_rate=info.nominal_srate(),
            channel_format=channel_format,
            source_id=info.source_id(),
            hostname=info.hostname(),
            uid=info.uid(),
            version=info.version(),
            created_at=info.created_at(),
            channel_labels=channel_labels,
            channel_types=channel_types,
            channel_units=channel_units,
            manufacturer=manufacturer,
            model=model,
        )
    
    def connect_stream(
        self,
        stream_name: Optional[str] = None,
        stream_type: str = "EEG",
        buffer_length: float = 360.0,  # 6 minutes max buffer
        max_chunklen: int = 0,  # 0 = variable chunk size
    ) -> Optional[str]:
        """Connect to an LSL stream and start reading samples"""
        if not LSL_AVAILABLE:
            logger.error("pylsl not available")
            return None
        
        # Resolve the stream
        logger.info(f"Resolving LSL stream: name={stream_name}, type={stream_type}")
        
        if stream_name:
            streams = resolve_byprop('name', stream_name, timeout=5.0)
        else:
            streams = resolve_byprop('type', stream_type, timeout=5.0)
        
        if not streams:
            logger.error(f"Could not find LSL stream: {stream_name or stream_type}")
            return None
        
        # Use first matching stream
        stream_info = streams[0]
        stream_id = stream_info.uid()
        
        if stream_id in self.inlets:
            logger.info(f"Already connected to stream: {stream_id}")
            return stream_id
        
        # Create inlet
        logger.info(f"Creating inlet for: {stream_info.name()}")
        inlet = StreamInlet(
            stream_info,
            max_buflen=buffer_length,
            max_chunklen=max_chunklen,
            recover=True,  # Auto-recover if stream is temporarily lost
        )
        
        # Parse and store metadata
        metadata = self._parse_stream_info(stream_info)
        
        self.inlets[stream_id] = inlet
        self.metadata[stream_id] = metadata
        self.sample_queues[stream_id] = queue.Queue(maxsize=10000)
        
        # Start reader thread
        self._start_reader_thread(stream_id)
        
        logger.info(f"Connected to stream: {metadata.name} ({metadata.channel_count}ch)")
        return stream_id
    
    def _start_reader_thread(self, stream_id: str):
        """Start background thread to read samples from inlet"""
        if stream_id in self.reader_threads:
            return
        
        thread = threading.Thread(
            target=self._reader_loop,
            args=(stream_id,),
            daemon=True,
            name=f"lsl-reader-{stream_id[:8]}"
        )
        self.reader_threads[stream_id] = thread
        self.running = True
        thread.start()
    
    def _reader_loop(self, stream_id: str):
        """Background loop to continuously read samples from inlet"""
        inlet = self.inlets.get(stream_id)
        sample_queue = self.sample_queues.get(stream_id)
        
        if not inlet or not sample_queue:
            return
        
        logger.info(f"Reader thread started for stream: {stream_id[:8]}...")
        
        while self.running and stream_id in self.inlets:
            try:
                # Pull chunk of samples (more efficient than single samples)
                samples, timestamps = inlet.pull_chunk(timeout=0.1, max_samples=32)
                
                if samples:
                    for sample, ts in zip(samples, timestamps):
                        try:
                            sample_obj = Sample(
                                timestamp=time.time(),
                                lsl_timestamp=ts,
                                channels=list(sample),
                                stream_id=stream_id,
                            )
                            sample_queue.put_nowait(sample_obj)
                        except queue.Full:
                            # Drop oldest samples if queue is full
                            try:
                                sample_queue.get_nowait()
                                sample_queue.put_nowait(sample_obj)
                            except queue.Empty:
                                pass
            except Exception as e:
                logger.warning(f"Error reading from stream {stream_id[:8]}: {e}")
                time.sleep(0.1)
        
        logger.info(f"Reader thread stopped for stream: {stream_id[:8]}")
    
    def get_samples(self, stream_id: str, max_samples: int = 100) -> List[Sample]:
        """Get pending samples from a stream (non-blocking)"""
        sample_queue = self.sample_queues.get(stream_id)
        if not sample_queue:
            return []
        
        samples = []
        for _ in range(max_samples):
            try:
                sample = sample_queue.get_nowait()
                samples.append(sample)
            except queue.Empty:
                break
        
        return samples
    
    def disconnect_stream(self, stream_id: str):
        """Disconnect from a specific stream"""
        if stream_id in self.inlets:
            # Stop reader thread by removing inlet
            inlet = self.inlets.pop(stream_id)
            inlet.close_stream()
            
            if stream_id in self.metadata:
                del self.metadata[stream_id]
            if stream_id in self.sample_queues:
                del self.sample_queues[stream_id]
            if stream_id in self.reader_threads:
                del self.reader_threads[stream_id]
            
            logger.info(f"Disconnected from stream: {stream_id[:8]}")
    
    def disconnect_all(self):
        """Disconnect from all streams"""
        self.running = False
        stream_ids = list(self.inlets.keys())
        for stream_id in stream_ids:
            self.disconnect_stream(stream_id)
    
    def get_time_correction(self, stream_id: str) -> float:
        """Get clock offset for a stream (for synchronization)"""
        inlet = self.inlets.get(stream_id)
        if inlet:
            try:
                return inlet.time_correction()
            except Exception:
                return 0.0
        return 0.0


# ============================================================================
# WEBSOCKET SERVER
# ============================================================================

class LSLWebSocketBridge:
    """WebSocket server that bridges LSL streams to browser clients"""
    
    def __init__(
        self,
        host: str = "0.0.0.0",
        port: int = 8767,
        stream_name: Optional[str] = None,
        stream_type: str = "EEG",
        auto_connect: bool = True,
    ):
        self.host = host
        self.port = port
        self.stream_name = stream_name
        self.stream_type = stream_type
        self.auto_connect = auto_connect
        
        self.inlet_manager = LSLInletManager()
        self.connected_clients: Set[WebSocketServerProtocol] = set()
        self.active_stream_id: Optional[str] = None
        self.running = False
        
        # Message queue for broadcasting
        self.broadcast_queue: asyncio.Queue = asyncio.Queue()
    
    async def start(self):
        """Start the WebSocket server"""
        self.running = True
        
        # Start the broadcast task
        broadcast_task = asyncio.create_task(self._broadcast_loop())
        
        # Start LSL connection if auto_connect
        if self.auto_connect:
            await self._auto_connect_lsl()
        
        # Start sample forwarding task
        forward_task = asyncio.create_task(self._forward_samples())
        
        # Start WebSocket server
        logger.info(f"Starting LSL WebSocket bridge on ws://{self.host}:{self.port}")
        
        async with websockets.serve(self._handle_client, self.host, self.port):
            logger.info("LSL WebSocket bridge is running")
            logger.info("Press Ctrl+C to stop")
            
            try:
                await asyncio.Future()  # Run forever
            except asyncio.CancelledError:
                pass
        
        self.running = False
        broadcast_task.cancel()
        forward_task.cancel()
        self.inlet_manager.disconnect_all()
    
    async def _auto_connect_lsl(self):
        """Automatically connect to first available LSL stream"""
        # Run discovery in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        streams = await loop.run_in_executor(
            None,
            lambda: self.inlet_manager.discover_streams(
                stream_type=self.stream_type if not self.stream_name else None,
                stream_name=self.stream_name,
                timeout=5.0
            )
        )
        
        if streams:
            # Connect to first stream
            stream_id = await loop.run_in_executor(
                None,
                lambda: self.inlet_manager.connect_stream(
                    stream_name=self.stream_name,
                    stream_type=self.stream_type,
                )
            )
            if stream_id:
                self.active_stream_id = stream_id
                logger.info(f"Auto-connected to stream: {stream_id[:8]}")
        else:
            logger.warning("No LSL streams found. Waiting for streams...")
            # Schedule periodic retry
            asyncio.create_task(self._retry_connect())
    
    async def _retry_connect(self):
        """Periodically retry LSL connection"""
        while self.running and not self.active_stream_id:
            await asyncio.sleep(5.0)
            await self._auto_connect_lsl()
    
    async def _forward_samples(self):
        """Forward samples from LSL inlet to broadcast queue"""
        while self.running:
            if self.active_stream_id:
                samples = self.inlet_manager.get_samples(self.active_stream_id, max_samples=50)
                for sample in samples:
                    metadata = self.inlet_manager.metadata.get(self.active_stream_id)
                    msg = self._format_sample_message(sample, metadata)
                    await self.broadcast_queue.put(msg)
            
            await asyncio.sleep(0.01)  # ~100Hz update rate
    
    def _format_sample_message(
        self, 
        sample: Sample, 
        metadata: Optional[StreamMetadata]
    ) -> bytes:
        """Format sample as binary message for WebSocket transmission"""
        # Binary format for efficiency:
        # [4 bytes: packet type]
        # [8 bytes: timestamp (double)]
        # [8 bytes: LSL timestamp (double)]
        # [4 bytes: channel count (uint32)]
        # [N * 4 bytes: channel values (float32)]
        
        num_channels = len(sample.channels)
        packet = struct.pack(
            f'>I d d I {num_channels}f',
            0x01,  # Packet type: sample
            sample.timestamp,
            sample.lsl_timestamp,
            num_channels,
            *sample.channels
        )
        return packet
    
    async def _broadcast_loop(self):
        """Broadcast messages to all connected clients"""
        while self.running:
            try:
                msg = await asyncio.wait_for(
                    self.broadcast_queue.get(),
                    timeout=0.1
                )
                
                if self.connected_clients:
                    # Send to all connected clients
                    disconnected = set()
                    for client in self.connected_clients:
                        try:
                            await client.send(msg)
                        except websockets.exceptions.ConnectionClosed:
                            disconnected.add(client)
                    
                    # Remove disconnected clients
                    self.connected_clients -= disconnected
                    
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.warning(f"Broadcast error: {e}")
    
    async def _handle_client(self, websocket: WebSocketServerProtocol):
        """Handle a new WebSocket client connection"""
        client_addr = websocket.remote_address
        logger.info(f"Client connected: {client_addr}")
        
        self.connected_clients.add(websocket)
        
        # Send stream metadata on connect
        if self.active_stream_id:
            metadata = self.inlet_manager.metadata.get(self.active_stream_id)
            if metadata:
                await self._send_metadata(websocket, metadata)
        
        try:
            async for message in websocket:
                await self._handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.connected_clients.discard(websocket)
            logger.info(f"Client disconnected: {client_addr}")
    
    async def _send_metadata(self, websocket: WebSocketServerProtocol, metadata: StreamMetadata):
        """Send stream metadata to client"""
        msg = {
            "type": "metadata",
            "stream": metadata.to_dict(),
            "lsl_time": local_clock() if LSL_AVAILABLE else time.time(),
        }
        await websocket.send(json.dumps(msg))
    
    async def _handle_message(self, websocket: WebSocketServerProtocol, message: str):
        """Handle incoming client message"""
        try:
            data = json.loads(message)
            command = data.get("command")
            
            if command == "discover":
                # Discover available streams
                loop = asyncio.get_event_loop()
                streams = await loop.run_in_executor(
                    None,
                    lambda: self.inlet_manager.discover_streams(
                        stream_type=data.get("type"),
                        stream_name=data.get("name"),
                        timeout=data.get("timeout", 5.0)
                    )
                )
                
                response = {
                    "type": "streams",
                    "streams": [s.to_dict() for s in streams],
                }
                await websocket.send(json.dumps(response))
            
            elif command == "connect":
                # Connect to specific stream
                stream_name = data.get("name")
                stream_type = data.get("stream_type", "EEG")
                
                loop = asyncio.get_event_loop()
                stream_id = await loop.run_in_executor(
                    None,
                    lambda: self.inlet_manager.connect_stream(
                        stream_name=stream_name,
                        stream_type=stream_type,
                    )
                )
                
                if stream_id:
                    self.active_stream_id = stream_id
                    metadata = self.inlet_manager.metadata.get(stream_id)
                    if metadata:
                        await self._send_metadata(websocket, metadata)
                    
                    response = {"type": "connected", "stream_id": stream_id}
                else:
                    response = {"type": "error", "message": "Could not connect to stream"}
                
                await websocket.send(json.dumps(response))
            
            elif command == "disconnect":
                # Disconnect from active stream
                if self.active_stream_id:
                    self.inlet_manager.disconnect_stream(self.active_stream_id)
                    self.active_stream_id = None
                
                response = {"type": "disconnected"}
                await websocket.send(json.dumps(response))
            
            elif command == "configure":
                # Handle device configuration (for compatibility)
                logger.info(f"Configure command received: {data}")
                response = {"type": "configured", "status": "ok"}
                await websocket.send(json.dumps(response))
            
            elif command == "ping":
                response = {
                    "type": "pong",
                    "timestamp": time.time(),
                    "lsl_time": local_clock() if LSL_AVAILABLE else time.time(),
                }
                await websocket.send(json.dumps(response))
            
            else:
                response = {"type": "error", "message": f"Unknown command: {command}"}
                await websocket.send(json.dumps(response))
        
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON message: {message[:100]}")
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            await websocket.send(json.dumps({"type": "error", "message": str(e)}))


# ============================================================================
# LSL SIMULATION (for testing without hardware)
# ============================================================================

class LSLSimulator:
    """Simulates an LSL outlet for testing without hardware"""
    
    def __init__(
        self,
        stream_name: str = "PhantomLoop_Simulated_EEG",
        stream_type: str = "EEG",
        channel_count: int = 8,
        sample_rate: float = 250.0,
        name: str = None,  # Alias for backward compatibility
        sampling_rate: float = None,  # Alias for backward compatibility
    ):
        # Handle aliases for backward compatibility
        self._name = stream_name if name is None else name
        self.stream_type = stream_type
        self.channel_count = channel_count
        self._sampling_rate = sample_rate if sampling_rate is None else sampling_rate
        self._is_streaming = False
        self.outlet = None
        self._sample_buffer: List[Tuple[List[float], float]] = []
        self._buffer_lock = threading.Lock()
        
        # Create stream_info for test compatibility
        self.stream_info = LSLStreamInfo(
            name=self._name,
            stream_type=self.stream_type,
            channel_count=self.channel_count,
            sampling_rate=self._sampling_rate,
            source_id="phantomloop-sim-001",
        )
    
    @property
    def name(self) -> str:
        return self._name
    
    @property
    def sampling_rate(self) -> float:
        return self._sampling_rate
    
    @property
    def is_streaming(self) -> bool:
        return self._is_streaming
    
    @property
    def running(self) -> bool:
        """Alias for backward compatibility"""
        return self._is_streaming
    
    @running.setter
    def running(self, value: bool):
        self._is_streaming = value
    
    def get_stream_info(self) -> LSLStreamInfo:
        """Get stream information"""
        return self.stream_info
    
    def start(self):
        """Start simulated LSL outlet"""
        self._is_streaming = True
        
        if LSL_AVAILABLE:
            from pylsl import StreamOutlet, StreamInfo as PyLSLStreamInfo
            
            # Create stream info
            info = PyLSLStreamInfo(
                self._name,
                self.stream_type,
                self.channel_count,
                self._sampling_rate,
                'float32',
                'phantomloop-sim-001'
            )
            
            # Add channel descriptions
            desc = info.desc()
            channels = desc.append_child("channels")
            for i in range(self.channel_count):
                ch = channels.append_child("channel")
                ch.append_child_value("label", f"Ch{i+1}")
                ch.append_child_value("type", "EEG")
                ch.append_child_value("unit", "µV")
            
            # Add acquisition info
            acq = desc.append_child("acquisition")
            acq.append_child_value("manufacturer", "PhantomLoop")
            acq.append_child_value("model", "Simulated EEG")
            
            # Create outlet
            self.outlet = StreamOutlet(info)
            logger.info(f"Started simulated LSL outlet: {self._name}")
        
        # Start streaming thread
        thread = threading.Thread(target=self._stream_loop, daemon=True)
        thread.start()
    
    def _stream_loop(self):
        """Generate and push simulated EEG samples"""
        sample_interval = 1.0 / self._sampling_rate
        phase = np.zeros(self.channel_count)
        
        while self._is_streaming:
            # Generate simulated EEG (alpha waves + noise)
            sample = []
            for ch in range(self.channel_count):
                # Alpha rhythm (8-12 Hz) + pink noise
                alpha = 20 * np.sin(2 * np.pi * 10 * phase[ch])
                noise = np.random.randn() * 10
                sample.append(float(alpha + noise))
                phase[ch] += sample_interval
            
            timestamp = time.time()
            
            # Push to LSL outlet if available
            if self.outlet:
                self.outlet.push_sample(sample)
            
            # Also buffer for pull_sample()
            with self._buffer_lock:
                self._sample_buffer.append((sample, timestamp))
                # Keep buffer reasonable
                if len(self._sample_buffer) > 1000:
                    self._sample_buffer = self._sample_buffer[-500:]
            
            time.sleep(sample_interval)
    
    def pull_sample(self, timeout: float = 0.0) -> Tuple[Optional[List[float]], float]:
        """Pull a sample from the buffer (for testing without pylsl)"""
        with self._buffer_lock:
            if self._sample_buffer:
                return self._sample_buffer.pop(0)
        return None, 0.0
    
    def stop(self):
        """Stop the simulator"""
        self._is_streaming = False
        self.outlet = None


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="LSL to WebSocket Bridge for PhantomLoop",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Auto-discover and connect to first EEG stream
    python lsl_ws_bridge.py
    
    # Connect to specific stream by name
    python lsl_ws_bridge.py --stream "OpenBCI_EEG"
    
    # Connect to a Muse stream
    python lsl_ws_bridge.py --stream "Muse" --type EEG
    
    # Run with simulated data for testing
    python lsl_ws_bridge.py --simulate
    
    # List available streams
    python lsl_ws_bridge.py --list
    
    # Custom port
    python lsl_ws_bridge.py --port 8768
        """
    )
    
    parser.add_argument(
        '--host', 
        default='0.0.0.0',
        help='Host to bind WebSocket server (default: 0.0.0.0)'
    )
    parser.add_argument(
        '--port', '-p',
        type=int, 
        default=8767,
        help='WebSocket server port (default: 8767)'
    )
    parser.add_argument(
        '--stream', '-s',
        help='LSL stream name to connect to'
    )
    parser.add_argument(
        '--type', '-t',
        default='EEG',
        help='LSL stream type to search for (default: EEG)'
    )
    parser.add_argument(
        '--list', '-l',
        action='store_true',
        help='List available LSL streams and exit'
    )
    parser.add_argument(
        '--simulate',
        action='store_true',
        help='Start a simulated LSL stream for testing'
    )
    parser.add_argument(
        '--no-auto-connect',
        action='store_true',
        help='Do not auto-connect to streams on startup'
    )
    
    args = parser.parse_args()
    
    if not LSL_AVAILABLE:
        logger.error("pylsl is not installed. Install with: pip install pylsl")
        logger.info("On Windows, you may also need to install liblsl:")
        logger.info("  pip install pylsl")
        logger.info("  # or download from: https://github.com/sccn/liblsl/releases")
        sys.exit(1)
    
    # List streams mode
    if args.list:
        manager = LSLInletManager()
        streams = manager.discover_streams(timeout=5.0)
        
        if streams:
            print("\nAvailable LSL Streams:")
            print("-" * 60)
            for s in streams:
                print(f"  Name: {s.name}")
                print(f"  Type: {s.stream_type}")
                print(f"  Channels: {s.channel_count}")
                print(f"  Rate: {s.sampling_rate} Hz")
                print(f"  Format: {s.channel_format}")
                print(f"  Source: {s.source_id}")
                print(f"  Host: {s.hostname}")
                print("-" * 60)
        else:
            print("\nNo LSL streams found on the network.")
            print("Make sure your LSL source is running (OpenBCI GUI, muse-lsl, etc.)")
        
        return
    
    # Start simulator if requested
    simulator = None
    if args.simulate:
        logger.info("Starting LSL simulator...")
        simulator = LSLSimulator()
        simulator.start()
        # Give simulator time to start
        time.sleep(0.5)
    
    # Start bridge
    bridge = LSLWebSocketBridge(
        host=args.host,
        port=args.port,
        stream_name=args.stream,
        stream_type=args.type,
        auto_connect=not args.no_auto_connect,
    )
    
    try:
        asyncio.run(bridge.start())
    except KeyboardInterrupt:
        logger.info("\nShutting down...")
    finally:
        if simulator:
            simulator.stop()


if __name__ == "__main__":
    main()

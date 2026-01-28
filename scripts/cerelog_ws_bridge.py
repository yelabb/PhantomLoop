#!/usr/bin/env python3
"""
WebSocket-to-TCP Bridge for Cerelog ESP-EEG

This script bridges the gap between browsers (WebSocket only) and the
Cerelog ESP-EEG device (TCP on port 1112).

Based on the actual Cerelog WiFi firmware protocol from:
https://github.com/Cerelog-ESP-EEG/WiFi_Support/blob/main/Python_wifi_LSL.py

Usage:
    1. Connect your computer to the ESP-EEG WiFi AP:
       - SSID: CERELOG_EEG
       - Password: cerelog123
       
    2. Run this bridge:
       python cerelog_ws_bridge.py
       
    3. In PhantomLoop, connect to: ws://localhost:8765
       
Requirements:
    pip install websockets

Protocol:
    - ESP-EEG streams binary packets on TCP port 1112
    - Packet format: 37 bytes
      [0-1]   Start marker: 0xABCD
      [2]     Length: 31
      [3-6]   Timestamp (uint32, ms since connection)
      [7-33]  ADS1299 data: 3 status bytes + 24 bytes (8 ch × 3 bytes each)
      [34]    Checksum: sum of bytes 2-33 & 0xFF
      [35-36] End marker: 0xDCBA
"""

import asyncio
import socket
import struct
import json
import sys
from typing import Optional
import argparse

try:
    import websockets
except ImportError:
    print("Error: websockets library required. Install with: pip install websockets")
    sys.exit(1)

# Cerelog ESP-EEG Protocol Constants
ESP_EEG_IP = "192.168.4.1"
ESP_EEG_PORT = 1112
UDP_DISCOVERY_PORT = 4445
DISCOVERY_MSG = b"CERELOG_FIND_ME"
EXPECTED_RESPONSE = b"CERELOG_HERE"

# Packet structure
PACKET_SIZE = 37
START_MARKER = 0xABCD
END_MARKER = 0xDCBA
NUM_CHANNELS = 8
BYTES_PER_CHANNEL = 3
STATUS_BYTES = 3

# Hardware constants for µV conversion
VREF = 4.50
GAIN = 24


class TCPSerialReader:
    """TCP connection to ESP-EEG device (mimics serial interface)"""
    
    def __init__(self, ip: str = ESP_EEG_IP, port: int = ESP_EEG_PORT, timeout: float = 5.0):
        self.ip = ip
        self.port = port
        self.timeout = timeout
        self.sock: Optional[socket.socket] = None
        self.buffer = bytearray()
        
    def connect(self) -> bool:
        """Connect to ESP-EEG via TCP"""
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.sock.settimeout(self.timeout)
            self.sock.connect((self.ip, self.port))
            print(f"✓ Connected to ESP-EEG at {self.ip}:{self.port}")
            return True
        except socket.error as e:
            print(f"✗ Failed to connect: {e}")
            return False
    
    def disconnect(self):
        """Close TCP connection"""
        if self.sock:
            try:
                self.sock.close()
            except:
                pass
            self.sock = None
        self.buffer.clear()
        
    def read(self, size: int) -> bytes:
        """Read bytes from TCP stream"""
        if not self.sock:
            return b''
        
        try:
            # Try to read from socket
            data = self.sock.recv(size)
            return data
        except socket.timeout:
            return b''
        except socket.error:
            return b''
    
    def read_packet(self) -> Optional[bytes]:
        """Read and parse a complete 37-byte packet"""
        # Read more data into buffer
        try:
            if self.sock:
                self.sock.setblocking(False)
                try:
                    data = self.sock.recv(1024)
                    if data:
                        self.buffer.extend(data)
                except BlockingIOError:
                    pass
                finally:
                    self.sock.setblocking(True)
        except:
            pass
        
        # Look for start marker in buffer
        while len(self.buffer) >= PACKET_SIZE:
            # Find start marker
            if len(self.buffer) >= 2:
                start = (self.buffer[0] << 8) | self.buffer[1]
                if start != START_MARKER:
                    # Skip byte and continue searching
                    self.buffer.pop(0)
                    continue
            
            # Check if we have enough bytes for full packet
            if len(self.buffer) < PACKET_SIZE:
                return None
            
            # Verify end marker
            end = (self.buffer[35] << 8) | self.buffer[36]
            if end != END_MARKER:
                # Invalid packet, skip first byte and retry
                self.buffer.pop(0)
                continue
            
            # Verify checksum
            checksum = sum(self.buffer[2:34]) & 0xFF
            if checksum != self.buffer[34]:
                # Bad checksum, skip first byte and retry
                self.buffer.pop(0)
                continue
            
            # Extract valid packet
            packet = bytes(self.buffer[:PACKET_SIZE])
            del self.buffer[:PACKET_SIZE]
            return packet
        
        return None


def parse_ads1299_sample(data: bytes, offset: int) -> float:
    """Parse 24-bit signed ADS1299 value to microvolts"""
    # 24-bit big-endian signed integer
    value = (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2]
    
    # Sign extend 24-bit to 32-bit
    if value & 0x800000:
        value = value - 0x1000000
    
    # Convert to µV
    scale = (2 * VREF / GAIN) / (2**24)
    return value * scale * 1e6


def parse_packet(packet: bytes) -> dict:
    """Parse binary packet to JSON-serializable dict"""
    # Timestamp (bytes 3-6, uint32 big-endian)
    timestamp = struct.unpack('>I', packet[3:7])[0]
    
    # Status register (bytes 7-9)
    status = (packet[7] << 16) | (packet[8] << 8) | packet[9]
    
    # Parse 8 channel values
    channels = []
    for ch in range(NUM_CHANNELS):
        offset = 7 + STATUS_BYTES + (ch * BYTES_PER_CHANNEL)
        channels.append(parse_ads1299_sample(packet, offset))
    
    return {
        "type": "sample",
        "timestamp": timestamp,
        "status": status,
        "channels": channels
    }


def discover_device(timeout: float = 3.0) -> Optional[str]:
    """Discover ESP-EEG device via UDP broadcast"""
    print(f"Searching for ESP-EEG device...")
    
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.settimeout(timeout)
        
        # Send discovery message
        sock.sendto(DISCOVERY_MSG, ('255.255.255.255', UDP_DISCOVERY_PORT))
        
        # Wait for response
        data, addr = sock.recvfrom(1024)
        if data == EXPECTED_RESPONSE:
            print(f"✓ Found ESP-EEG at {addr[0]}")
            return addr[0]
    except socket.timeout:
        print("✗ No ESP-EEG device found (timeout)")
    except Exception as e:
        print(f"✗ Discovery error: {e}")
    finally:
        sock.close()
    
    return None


class ESPEEGBridge:
    """WebSocket bridge for ESP-EEG data"""
    
    def __init__(self, esp_ip: str = ESP_EEG_IP, esp_port: int = ESP_EEG_PORT, ws_port: int = 8765):
        self.esp_ip = esp_ip
        self.esp_port = esp_port
        self.ws_port = ws_port
        self.tcp_reader: Optional[TCPSerialReader] = None
        self.clients: set = set()
        self.streaming = False
        
    async def tcp_reader_task(self):
        """Background task to read TCP packets and broadcast to WebSocket clients"""
        while self.streaming:
            if self.tcp_reader:
                packet = self.tcp_reader.read_packet()
                if packet:
                    try:
                        sample = parse_packet(packet)
                        message = json.dumps(sample)
                        
                        # Broadcast to all connected WebSocket clients
                        if self.clients:
                            await asyncio.gather(
                                *[client.send(message) for client in self.clients],
                                return_exceptions=True
                            )
                    except Exception as e:
                        print(f"Parse error: {e}")
            
            # Small delay to prevent busy loop
            await asyncio.sleep(0.001)  # ~1000 checks/sec for 250 SPS stream
    
    async def handle_client(self, websocket):
        """Handle WebSocket client connection"""
        client_addr = websocket.remote_address
        print(f"→ WebSocket client connected: {client_addr}")
        self.clients.add(websocket)
        
        try:
            async for message in websocket:
                try:
                    cmd = json.loads(message)
                    
                    if cmd.get("command") == "connect":
                        # Connect to ESP-EEG
                        device_ip = cmd.get("deviceIp", self.esp_ip)
                        port = cmd.get("port", self.esp_port)
                        
                        if not self.tcp_reader or not self.streaming:
                            self.tcp_reader = TCPSerialReader(device_ip, port)
                            if self.tcp_reader.connect():
                                self.streaming = True
                                asyncio.create_task(self.tcp_reader_task())
                                await websocket.send(json.dumps({
                                    "type": "status",
                                    "connected": True,
                                    "message": f"Connected to {device_ip}:{port}"
                                }))
                            else:
                                await websocket.send(json.dumps({
                                    "type": "status",
                                    "connected": False,
                                    "error": f"Failed to connect to {device_ip}:{port}"
                                }))
                    
                    elif cmd.get("command") == "disconnect":
                        self.streaming = False
                        if self.tcp_reader:
                            self.tcp_reader.disconnect()
                            self.tcp_reader = None
                        await websocket.send(json.dumps({
                            "type": "status",
                            "connected": False,
                            "message": "Disconnected"
                        }))
                    
                    elif cmd.get("command") == "discover":
                        # Run device discovery
                        found_ip = await asyncio.to_thread(discover_device)
                        await websocket.send(json.dumps({
                            "type": "discovery",
                            "found": found_ip is not None,
                            "ip": found_ip
                        }))
                        
                except json.JSONDecodeError:
                    print(f"Invalid JSON from client: {message}")
                    
        except websockets.exceptions.ConnectionClosed:
            print(f"← Client disconnected: {client_addr}")
        finally:
            self.clients.discard(websocket)
    
    async def run(self):
        """Start the WebSocket server"""
        print(f"""
╔════════════════════════════════════════════════════════════╗
║        Cerelog ESP-EEG WebSocket Bridge                    ║
╠════════════════════════════════════════════════════════════╣
║  WebSocket Server: ws://localhost:{self.ws_port:<25}║
║  ESP-EEG Target:   {self.esp_ip}:{self.esp_port:<26}║
╠════════════════════════════════════════════════════════════╣
║  Setup:                                                    ║
║    1. Connect to WiFi "CERELOG_EEG" (pass: cerelog123)     ║
║    2. In PhantomLoop, connect to ws://localhost:{self.ws_port:<10}║
╚════════════════════════════════════════════════════════════╝
        """)
        
        async with websockets.serve(self.handle_client, "localhost", self.ws_port):
            await asyncio.Future()  # Run forever


def main():
    parser = argparse.ArgumentParser(description="WebSocket bridge for Cerelog ESP-EEG")
    parser.add_argument("--esp-ip", default=ESP_EEG_IP, help=f"ESP-EEG IP address (default: {ESP_EEG_IP})")
    parser.add_argument("--esp-port", type=int, default=ESP_EEG_PORT, help=f"ESP-EEG TCP port (default: {ESP_EEG_PORT})")
    parser.add_argument("--ws-port", type=int, default=8765, help="WebSocket server port (default: 8765)")
    parser.add_argument("--discover", action="store_true", help="Discover ESP-EEG device and exit")
    
    args = parser.parse_args()
    
    if args.discover:
        ip = discover_device()
        if ip:
            print(f"Use: python cerelog_ws_bridge.py --esp-ip {ip}")
        return
    
    bridge = ESPEEGBridge(args.esp_ip, args.esp_port, args.ws_port)
    
    try:
        asyncio.run(bridge.run())
    except KeyboardInterrupt:
        print("\nShutting down...")


if __name__ == "__main__":
    main()

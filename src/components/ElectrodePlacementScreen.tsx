/**
 * Electrode Placement Screen
 * Interactive UI for configuring electrode positions and monitoring signal quality
 * 
 * NOTE: Cerelog ESP-EEG uses TCP on port 1112 - browsers cannot connect directly.
 * A WebSocket bridge is required for browser access. For direct connection, use Python scripts.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import { useESPEEG } from '../hooks/useESPEEG';
import { downloadConfiguration, downloadBrainflowPythonCode } from '../utils/brainflowExport';
import type {
  ElectrodeConfiguration,
  MontageName,
  DataSource,
} from '../types/electrodes';
import {
  createDefaultElectrode,
  STANDARD_10_20_POSITIONS,
} from '../types/electrodes';

interface ElectrodePlacementScreenProps {
  onBack?: () => void;
  onContinue?: () => void;
}

export function ElectrodePlacementScreen({ onBack, onContinue }: ElectrodePlacementScreenProps) {
  const {
    electrodeConfig,
    setElectrodeConfig,
    setImpedanceMonitoring,
    dataSource,
    setDataSource,
    impedanceValues,
    getImpedanceQuality,
  } = useStore();

  const [configName, setConfigName] = useState('');
  const [channelCount, setChannelCount] = useState(8);
  const [montageType, setMontageType] = useState<MontageName>('10-20');
  const [selectedElectrode, setSelectedElectrode] = useState<string | null>(null);
  // Default to local WebSocket bridge (TCP bridge required for real device)
  const [espEEGUrl, setEspEEGUrl] = useState('ws://localhost:8765');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showProtocolInfo, setShowProtocolInfo] = useState(false);

  const { 
    connectionStatus, 
    connect, 
    disconnect, 
    channelStats, 
    sampleRate, 
    packetCount,
    lastError,
    protocolInfo,
    isDemoMode,
    startDemoMode,
    stopDemoMode,
  } = useESPEEG();

  // Initialize default configuration
  useEffect(() => {
    if (!electrodeConfig) {
      const defaultConfig = createDefaultConfiguration(channelCount, montageType);
      setElectrodeConfig(defaultConfig);
      setConfigName(defaultConfig.name);
    }
  }, [channelCount, electrodeConfig, montageType, setElectrodeConfig]);

  const createDefaultConfiguration = (
    channels: number,
    montage: MontageName
  ): ElectrodeConfiguration => {
    const standardLabels: Record<number, string[]> = {
      8: ['Fp1', 'Fp2', 'C3', 'Cz', 'C4', 'P3', 'Pz', 'P4'],
      16: ['Fp1', 'Fp2', 'F7', 'F3', 'Fz', 'F4', 'F8', 'C3', 'Cz', 'C4', 'T7', 'T8', 'P3', 'Pz', 'P4', 'O1'],
      32: Object.keys(STANDARD_10_20_POSITIONS).slice(0, 32),
    };

    const labels = standardLabels[channels] || Array.from({ length: channels }, (_, i) => `Ch${i}`);
    const electrodes = [];

    for (let i = 0; i < channels; i++) {
      const label = labels[i];
      const position = montage === '10-20' && STANDARD_10_20_POSITIONS[label]
        ? STANDARD_10_20_POSITIONS[label]
        : { x: 0, y: 0, z: 0 };

      electrodes.push({
        ...createDefaultElectrode(i, label, position),
        montagePosition: montage === '10-20' ? label : undefined,
      });
    }

    return {
      id: `config-${Date.now()}`,
      name: `Cerelog ESP-EEG ${channels}ch`,
      deviceType: 'esp-eeg',
      channelCount: channels,
      samplingRate: 250,
      layout: {
        name: `${montage} ${channels}-channel`,
        montage,
        electrodes,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  };

  const handleConnectESPEEG = async () => {
    setIsConnecting(true);
    try {
      const source: DataSource = {
        type: 'esp-eeg',
        url: espEEGUrl,
        protocol: 'websocket',
      };
      setDataSource(source);
      setImpedanceMonitoring(true);
      connect(espEEGUrl);
    } catch (error) {
      console.error('Failed to connect to ESP-EEG:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectESPEEG = () => {
    disconnect();
    setDataSource(null);
    setImpedanceMonitoring(false);
  };

  const handleStartDemoMode = () => {
    setImpedanceMonitoring(true);
    startDemoMode({ scenario: 'realistic' });
  };

  const handleStopDemoMode = () => {
    stopDemoMode();
    setImpedanceMonitoring(false);
  };

  const handleReconfigureChannels = () => {
    const newConfig = createDefaultConfiguration(channelCount, montageType);
    setElectrodeConfig(newConfig);
    setConfigName(newConfig.name);
  };

  const qualityStats = getImpedanceQuality();
  const hasGoodConnection = qualityStats.good > channelCount * 0.7;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            Electrode Placement Assistant
          </h1>
          <p className="text-gray-400">Configure and validate Cerelog ESP-EEG electrode positions</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Device Connection */}
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <h2 className="text-xl font-semibold mb-4">Device Connection</h2>
              
              {/* Protocol Info Toggle */}
              <button 
                onClick={() => setShowProtocolInfo(!showProtocolInfo)}
                className="text-xs text-purple-400 hover:text-purple-300 mb-3 flex items-center gap-1"
              >
                {showProtocolInfo ? '▼' : '▶'} Cerelog ESP-EEG Protocol Info
              </button>
              
              {showProtocolInfo && (
                <div className="bg-black/30 rounded-lg p-3 mb-4 text-xs text-gray-400 space-y-1">
                  <div><strong>WiFi AP:</strong> {protocolInfo.WIFI_SSID} / {protocolInfo.WIFI_PASSWORD}</div>
                  <div><strong>Device IP:</strong> {protocolInfo.DEVICE_IP}</div>
                  <div><strong>TCP Port:</strong> {protocolInfo.TCP_PORT} (binary stream)</div>
                  <div><strong>Sample Rate:</strong> {protocolInfo.SAMPLING_RATE} SPS</div>
                  <div><strong>Channels:</strong> {protocolInfo.NUM_CHANNELS} (ADS1299)</div>
                  <div className="pt-2 text-orange-400">
                    ⚠ Browsers cannot connect to TCP directly. Use a WebSocket bridge.
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">WebSocket Bridge URL</label>
                  <input
                    type="text"
                    value={espEEGUrl}
                    onChange={(e) => setEspEEGUrl(e.target.value)}
                    disabled={dataSource !== null}
                    className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2 text-white disabled:opacity-50"
                    placeholder="ws://localhost:8765"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Connects to a local bridge that proxies TCP data from the ESP-EEG
                  </p>
                </div>

                {lastError && (
                  <div className="text-red-400 text-sm bg-red-500/10 rounded-lg p-2">
                    {lastError}
                  </div>
                )}

                {(dataSource || isDemoMode) ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full animate-pulse ${
                        connectionStatus === 'connected' ? (isDemoMode ? 'bg-amber-500' : 'bg-green-500') : 'bg-yellow-500'
                      }`} />
                      <span className={`text-sm ${
                        connectionStatus === 'connected' ? (isDemoMode ? 'text-amber-400' : 'text-green-400') : 'text-yellow-400'
                      }`}>
                        {connectionStatus === 'connected' 
                          ? (isDemoMode ? '🎮 Demo Mode Active' : 'Connected')
                          : 'Connecting...'}
                      </span>
                    </div>
                    
                    {connectionStatus === 'connected' && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-black/20 rounded p-2">
                          <div className="text-gray-400">Sample Rate</div>
                          <div className="font-mono">{sampleRate} SPS</div>
                        </div>
                        <div className="bg-black/20 rounded p-2">
                          <div className="text-gray-400">Packets</div>
                          <div className="font-mono">{packetCount}</div>
                        </div>
                      </div>
                    )}
                    
                    {!isDemoMode && (
                      <button
                        onClick={handleDisconnectESPEEG}
                        className="w-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg px-4 py-2 transition-colors"
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handleConnectESPEEG}
                    disabled={isConnecting}
                    className="w-full bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect to Bridge'}
                  </button>
                )}

                {/* Demo Mode */}
                <div className="pt-4 border-t border-white/10">
                  <p className="text-xs text-gray-500 mb-2">
                    No hardware? Try demo mode with simulated EEG data:
                  </p>
                  {isDemoMode ? (
                    <button
                      onClick={handleStopDemoMode}
                      className="w-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-lg px-4 py-2 transition-colors text-amber-400"
                    >
                      🎮 Stop Demo Mode
                    </button>
                  ) : (
                    <button
                      onClick={handleStartDemoMode}
                      disabled={connectionStatus === 'connected'}
                      className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
                    >
                      🎮 Start Demo Mode
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Configuration Settings */}
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <h2 className="text-xl font-semibold mb-4">Configuration</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Configuration Name</label>
                  <input
                    type="text"
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                    className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Channel Count</label>
                  <select
                    value={channelCount}
                    onChange={(e) => setChannelCount(Number(e.target.value))}
                    className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2 text-white"
                  >
                    <option value={8}>8 channels</option>
                    <option value={16}>16 channels</option>
                    <option value={32}>32 channels</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Montage</label>
                  <select
                    value={montageType}
                    onChange={(e) => setMontageType(e.target.value as MontageName)}
                    className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="10-20">10-20 Standard</option>
                    <option value="10-10">10-10 Extended</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <button
                  onClick={handleReconfigureChannels}
                  className="w-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg px-4 py-2 transition-colors"
                >
                  Apply Configuration
                </button>
              </div>
            </div>

            {/* Quality Summary */}
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <h2 className="text-xl font-semibold mb-2">Signal Quality</h2>
              <p className="text-xs text-gray-500 mb-4">
                Estimated from signal amplitude (ADS1299 has no impedance measurement)
              </p>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                    <span className="text-sm">Good (normal amplitude)</span>
                  </div>
                  <span className="font-semibold">{qualityStats.good}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                    <span className="text-sm">Fair (elevated noise)</span>
                  </div>
                  <span className="font-semibold">{qualityStats.fair}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full" />
                    <span className="text-sm">Poor (high noise)</span>
                  </div>
                  <span className="font-semibold">{qualityStats.poor}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <span className="text-sm">Disconnected</span>
                  </div>
                  <span className="font-semibold">{qualityStats.disconnected}</span>
                </div>

                <div className="pt-4 border-t border-white/10">
                  {hasGoodConnection ? (
                    <div className="text-green-400 text-sm">✓ Ready to proceed</div>
                  ) : connectionStatus === 'connected' ? (
                    <div className="text-orange-400 text-sm">⚠ Check electrode contacts</div>
                  ) : (
                    <div className="text-gray-400 text-sm">Connect device to check quality</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Electrode Grid */}
          <div className="lg:col-span-2">
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 h-full">
              <h2 className="text-xl font-semibold mb-4">Electrode Layout</h2>
              
              {electrodeConfig && (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                  {electrodeConfig.layout.electrodes.map((electrode) => {
                    // Use real channel stats if connected, otherwise use store impedance
                    const stats = channelStats[electrode.channelIndex];
                    const quality = stats?.quality || electrode.quality || 'disconnected';
                    const signalAmplitude = stats?.std || 0;
                    const pseudoImpedance = stats?.estimatedImpedance || impedanceValues.get(electrode.channelIndex);
                    
                    const qualityColors = {
                      good: 'border-green-500 bg-green-500/20',
                      fair: 'border-yellow-500 bg-yellow-500/20',
                      poor: 'border-orange-500 bg-orange-500/20',
                      disconnected: 'border-gray-500 bg-gray-500/20',
                    };

                    return (
                      <button
                        key={electrode.id}
                        onClick={() => setSelectedElectrode(electrode.id)}
                        className={`
                          aspect-square rounded-lg border-2 p-2 transition-all
                          ${qualityColors[quality]}
                          ${selectedElectrode === electrode.id ? 'ring-2 ring-purple-500' : ''}
                          ${!electrode.isActive ? 'opacity-50' : ''}
                        `}
                        title={stats ? `Std: ${signalAmplitude.toFixed(1)}µV | P-P: ${stats.peakToPeak.toFixed(1)}µV` : 'No data'}
                      >
                        <div className="flex flex-col items-center justify-center h-full">
                          <div className="text-xs font-semibold">{electrode.label}</div>
                          {connectionStatus === 'connected' && stats ? (
                            <div className="text-xs text-gray-400 mt-1">
                              {signalAmplitude.toFixed(0)}µV
                            </div>
                          ) : pseudoImpedance !== undefined ? (
                            <div className="text-xs text-gray-400 mt-1">
                              {pseudoImpedance.toFixed(1)}kΩ
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 mt-1">--</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-between items-center">
          <div className="flex gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="px-6 py-3 bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/50 rounded-lg transition-colors"
              >
                ← Back
              </button>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => electrodeConfig && downloadConfiguration(electrodeConfig, 'json')}
                disabled={!electrodeConfig}
                className="px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg transition-colors disabled:opacity-50"
                title="Export to JSON"
              >
                📄 JSON
              </button>
              <button
                onClick={() => electrodeConfig && downloadConfiguration(electrodeConfig, 'csv')}
                disabled={!electrodeConfig}
                className="px-4 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-lg transition-colors disabled:opacity-50"
                title="Export to CSV"
              >
                📊 CSV
              </button>
              <button
                onClick={() => electrodeConfig && downloadBrainflowPythonCode(electrodeConfig)}
                disabled={!electrodeConfig}
                className="px-4 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-lg transition-colors disabled:opacity-50"
                title="Export Python Brainflow code"
              >
                🐍 Python
              </button>
            </div>
          </div>

          {onContinue && (
            <button
              onClick={onContinue}
              disabled={!hasGoodConnection}
              className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Proceed to Dashboard →
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

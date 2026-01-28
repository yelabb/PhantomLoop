/**
 * Stream Selector Component
 * 
 * UI for selecting and connecting to different stream sources.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useStream } from '../hooks/useStream';

export function StreamSelector() {
  const {
    config,
    connectionState,
    error,
    samplesReceived,
    effectiveSampleRate,
    selectAdapter,
    connect,
    disconnect,
    availableAdapters,
  } = useStream();

  const [selectedAdapterId, setSelectedAdapterId] = useState<string>('');
  const [customUrl, setCustomUrl] = useState<string>('');

  const handleAdapterChange = (adapterId: string) => {
    setSelectedAdapterId(adapterId);
    selectAdapter(adapterId);
    
    // Set default URL
    const adapter = availableAdapters.find(a => a.id === adapterId);
    if (adapter?.defaultUrl) {
      setCustomUrl(adapter.defaultUrl);
    }
  };

  const handleConnect = async () => {
    await connect(customUrl || undefined);
  };

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
      case 'reconnecting':
        return 'bg-yellow-500 animate-pulse';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10"
    >
      <h3 className="text-lg font-semibold mb-4 text-white">Stream Source</h3>

      {/* Adapter Selection */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Data Source</label>
          <select
            value={selectedAdapterId}
            onChange={(e) => handleAdapterChange(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
            disabled={connectionState === 'connected'}
          >
            <option value="">Select a source...</option>
            {availableAdapters.map((adapter) => (
              <option key={adapter.id} value={adapter.id}>
                {adapter.name}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        {selectedAdapterId && (
          <p className="text-xs text-gray-500">
            {availableAdapters.find(a => a.id === selectedAdapterId)?.description}
          </p>
        )}

        {/* URL Input */}
        {selectedAdapterId && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">Connection URL</label>
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="ws://..."
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              disabled={connectionState === 'connected'}
            />
          </div>
        )}

        {/* Connect/Disconnect Button */}
        <div className="flex gap-2">
          {connectionState !== 'connected' ? (
            <button
              onClick={handleConnect}
              disabled={!selectedAdapterId || connectionState === 'connecting'}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 font-medium transition-colors"
            >
              {connectionState === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 font-medium transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 rounded-lg p-2">
            {error}
          </div>
        )}
      </div>

      {/* Connection Status */}
      {config && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            <span className="text-sm text-gray-300 capitalize">{connectionState}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-black/20 rounded-lg p-2">
              <div className="text-gray-500">Channels</div>
              <div className="text-white font-mono">{config.channelCount}</div>
            </div>
            <div className="bg-black/20 rounded-lg p-2">
              <div className="text-gray-500">Sample Rate</div>
              <div className="text-white font-mono">{config.samplingRate} Hz</div>
            </div>
            <div className="bg-black/20 rounded-lg p-2">
              <div className="text-gray-500">Data Type</div>
              <div className="text-white font-mono capitalize">{config.dataType}</div>
            </div>
            <div className="bg-black/20 rounded-lg p-2">
              <div className="text-gray-500">Effective Rate</div>
              <div className="text-white font-mono">{effectiveSampleRate} Hz</div>
            </div>
            <div className="col-span-2 bg-black/20 rounded-lg p-2">
              <div className="text-gray-500">Samples Received</div>
              <div className="text-white font-mono">{samplesReceived.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/**
 * Add Custom Decoder Modal
 * 
 * Allows users to register their own decoders from:
 * - URL (pre-trained TensorFlow.js models)
 * - Local path (models in /models/ folder)
 */

import { memo, useState, useCallback } from 'react';
import { useStore } from '../store';
import { registerCustomDecoder } from '../decoders';
import type { Decoder } from '../types/decoders';

interface AddDecoderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddDecoderModal = memo(function AddDecoderModal({ isOpen, onClose }: AddDecoderModalProps) {
  const registerDecoder = useStore((state) => state.registerDecoder);
  
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!url.trim()) {
      setError('Model URL is required');
      return;
    }

    // Must be a valid URL or start with /models/
    const isValidUrl = url.startsWith('http://') || 
                       url.startsWith('https://') || 
                       url.startsWith('/models/');
    
    if (!isValidUrl) {
      setError('URL must start with http://, https://, or /models/');
      return;
    }

    // Create decoder config
    const id = `custom-${Date.now()}`;
    const decoder: Decoder = {
      id,
      name: name.trim(),
      type: 'tfjs',
      description: description.trim() || `Custom model from ${url}`,
      source: url.startsWith('/models/') 
        ? { type: 'local', path: url }
        : { type: 'url', url },
      architecture: 'Custom',
    };

    // Register with both the registry and store
    registerCustomDecoder(decoder);
    registerDecoder(decoder);

    console.log(`[AddDecoder] Registered: ${decoder.name}`);

    // Reset form and close
    setName('');
    setUrl('');
    setDescription('');
    onClose();
  }, [name, url, description, registerDecoder, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="glass-panel p-6 rounded-xl w-96 max-w-[90vw] animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Add Custom Decoder</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Decoder"
              className="w-full bg-gray-800/80 text-white px-3 py-2 rounded-lg text-sm border border-gray-600/50 
                focus:border-loopback focus:outline-none focus:ring-1 focus:ring-loopback/50"
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Model URL *</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/model.json"
              className="w-full bg-gray-800/80 text-white px-3 py-2 rounded-lg text-sm border border-gray-600/50 
                focus:border-loopback focus:outline-none focus:ring-1 focus:ring-loopback/50 font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              TensorFlow.js model URL (model.json) or /models/your-model/model.json
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="w-full bg-gray-800/80 text-white px-3 py-2 rounded-lg text-sm border border-gray-600/50 
                focus:border-loopback focus:outline-none focus:ring-1 focus:ring-loopback/50 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/30">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-gray-400 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm text-white bg-loopback/80 rounded-lg hover:bg-loopback transition-colors"
            >
              Add Decoder
            </button>
          </div>
        </form>

        {/* Help text */}
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong className="text-gray-400">Model Format:</strong> TensorFlow.js LayersModel format. 
            Export with <code className="text-loopback/80">model.save('...')</code> in Python or use 
            <code className="text-loopback/80"> tensorflowjs_converter</code>.
          </p>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            <strong className="text-gray-400">Expected I/O:</strong> Input shape [batch, 142] or [batch, 10, 142], 
            Output [batch, 2] for velocity (vx, vy).
          </p>
        </div>
      </div>
    </div>
  );
});

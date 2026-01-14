/**
 * Add Custom Decoder Modal
 * 
 * Allows users to register their own decoders from:
 * - JavaScript code (custom logic)
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
  
  const [decoderType, setDecoderType] = useState<'javascript' | 'tfjs'>('javascript');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
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

    const id = `custom-${Date.now()}`;
    let decoder: Decoder;

    if (decoderType === 'javascript') {
      if (!code.trim()) {
        setError('JavaScript code is required');
        return;
      }

      decoder = {
        id,
        name: name.trim(),
        type: 'javascript',
        description: description.trim() || 'Custom JavaScript decoder',
        code: code.trim(),
        architecture: 'JavaScript',
      };
    } else {
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

      decoder = {
        id,
        name: name.trim(),
        type: 'tfjs',
        description: description.trim() || `Custom model from ${url}`,
        source: url.startsWith('/models/') 
          ? { type: 'local', path: url }
          : { type: 'url', url },
        architecture: 'Custom',
      };
    }

    // Register with both the registry and store
    registerCustomDecoder(decoder);
    registerDecoder(decoder);

    console.log(`[AddDecoder] Registered: ${decoder.name}`);

    // Reset form and close
    setName('');
    setUrl('');
    setCode('');
    setDescription('');
    onClose();
  }, [decoderType, name, url, code, description, registerDecoder, onClose]);

  if (!isOpen) return null;

  return (
    <div className="p-4 rounded-xl bg-gray-800/50 border border-gray-700/30 animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-white">Add Custom Decoder</h3>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors text-lg leading-none"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Type selector */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Decoder Type *</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDecoderType('javascript')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                decoderType === 'javascript' 
                  ? 'bg-loopback text-white' 
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
              }`}
            >
              JavaScript
            </button>
            <button
              type="button"
              onClick={() => setDecoderType('tfjs')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                decoderType === 'tfjs' 
                  ? 'bg-loopback text-white' 
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
              }`}
            >
              TensorFlow.js
            </button>
          </div>
        </div>

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

        {/* JavaScript Code */}
        {decoderType === 'javascript' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">JavaScript Code *</label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={`// Available variables:\n// - input.spikes: number[]\n// - input.kinematics: { x, y, vx, vy }\n// - input.history: previous outputs\n\nconst { x, y, vx, vy } = input.kinematics;\nreturn { x, y, vx, vy };`}
              rows={8}
              className="w-full bg-gray-900/80 text-white px-3 py-2 rounded-lg text-xs border border-gray-600/50 
                focus:border-loopback focus:outline-none focus:ring-1 focus:ring-loopback/50 resize-none font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Return an object with x, y (and optionally vx, vy)
            </p>
          </div>
        )}

        {/* TensorFlow.js URL */}
        {decoderType === 'tfjs' && (
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
        )}

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
      <div className="mt-3 pt-3 border-t border-gray-700/50">
        {decoderType === 'javascript' ? (
          <>
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong className="text-gray-400">Available Input:</strong>
            </p>
            <ul className="text-xs text-gray-500 mt-1 ml-4 space-y-1">
              <li>• <code className="text-loopback/80">input.spikes</code>: number[] - Neural spike counts</li>
              <li>• <code className="text-loopback/80">input.kinematics</code>: {`{ x, y, vx, vy }`} - True position/velocity</li>
              <li>• <code className="text-loopback/80">input.history</code>: Previous decoder outputs</li>
            </ul>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong className="text-gray-400">Model Format:</strong> TensorFlow.js LayersModel format. 
              Export with <code className="text-loopback/80">model.save('...')</code> in Python or use 
              <code className="text-loopback/80"> tensorflowjs_converter</code>.
            </p>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              <strong className="text-gray-400">Expected I/O:</strong> Input shape [batch, 142] or [batch, 10, 142], 
              Output [batch, 2] for velocity (vx, vy).
            </p>
          </>
        )}
      </div>
    </div>
  );
});

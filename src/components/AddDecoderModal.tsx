/**
 * Add Custom Decoder Modal
 * 
 * Simplified decoder registration:
 * - JavaScript: Write custom decoder logic (like baselines)
 *   - Receives `input` with { spikes, kinematics, history }
 *   - Returns { x, y, vx?, vy?, confidence? }
 */

import { memo, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { registerCustomDecoder } from '../decoders';
import type { Decoder } from '../types/decoders';
import { CodeEditor } from './CodeEditor';

interface AddDecoderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MODAL_ID = 'add-decoder-modal';

// Default template for custom JavaScript decoder
const DEFAULT_JS_DECODER = `// Custom JavaScript Decoder
// Available in 'input':
//   - input.spikes: number[] (142 channels)
//   - input.kinematics: { x, y, vx, vy }
//   - input.history: previous decoder outputs

const { x, y, vx, vy } = input.kinematics;
const spikes = input.spikes;

// Example: Calculate total spike rate
const totalSpikes = spikes.reduce((sum, s) => sum + s, 0);
const avgRate = totalSpikes / spikes.length;

// Scale velocity by spike rate (naive example)
const scale = Math.min(avgRate / 10, 2);
const dt = 0.025;

return {
  x: x + vx * scale * dt,
  y: y + vy * scale * dt,
  vx: vx * scale,
  vy: vy * scale,
  confidence: Math.min(avgRate / 20, 1)
};`;

export const AddDecoderModal = memo(function AddDecoderModal({ isOpen, onClose }: AddDecoderModalProps) {
  const registerDecoder = useStore((state) => state.registerDecoder);
  const openModal = useStore((state) => state.openModal);
  const closeModal = useStore((state) => state.closeModal);
  
  const [name, setName] = useState('');
  const [code, setCode] = useState(DEFAULT_JS_DECODER);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  // Register modal state with store to prevent auto-navigation
  useEffect(() => {
    if (isOpen) {
      openModal(MODAL_ID);
    } else {
      closeModal();
    }
    return () => closeModal();
  }, [isOpen, openModal, closeModal]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!code.trim()) {
      setError('Decoder code is required');
      return;
    }

    // Validate code syntax by trying to compile it
    try {
      new Function('input', code);
    } catch (syntaxError) {
      setError(`Syntax error: ${syntaxError instanceof Error ? syntaxError.message : 'Invalid JavaScript'}`);
      return;
    }

    const id = `custom-${Date.now()}`;
    const decoder: Decoder = {
      id,
      name: name.trim(),
      type: 'javascript',
      description: description.trim() || 'Custom JavaScript decoder',
      code: code.trim(),
      architecture: 'Custom (JS)',
    };

    // Register with both the registry and store
    registerCustomDecoder(decoder);
    registerDecoder(decoder);

    console.log(`[AddDecoder] Registered: ${decoder.name}`);

    // Reset form and close
    setName('');
    setCode(DEFAULT_JS_DECODER);
    setDescription('');
    onClose();
  }, [name, code, description, registerDecoder, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-700/50">
        <div>
          <h3 className="text-sm font-semibold text-white">Add Custom Decoder</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Write JavaScript code that transforms spike data into cursor movement
          </p>
        </div>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors text-lg leading-none p-2"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        {/* Monaco Code Editor */}
        <div className="flex-1 min-h-0">
          <CodeEditor
            value={code}
            onChange={setCode}
          />
        </div>

        {/* Bottom Panel */}
        <div className="border-t border-gray-700/50 bg-gray-800/50 p-4">
          <div className="flex gap-4">
            {/* Name */}
            <div className="flex-1">
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

            {/* Description */}
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                className="w-full bg-gray-800/80 text-white px-3 py-2 rounded-lg text-sm border border-gray-600/50 
                  focus:border-loopback focus:outline-none focus:ring-1 focus:ring-loopback/50"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/30">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 mt-3">
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
        </div>
      </form>
    </div>
  );

  return createPortal(modalContent, document.body);
});

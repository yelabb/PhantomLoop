/**
 * Add Custom Decoder Modal
 * 
 * Allows users to register their own decoders:
 * - URL: Load pre-trained TensorFlow.js models
 * - Code: Write JavaScript to build/train models with TensorFlow.js
 */

import { memo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { registerCustomDecoder } from '../decoders';
import type { Decoder } from '../types/decoders';
import { CodeEditor } from './CodeEditor';
import { generateFromPrompt, generateTemplate } from '../utils/groqCodegen';

interface AddDecoderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddDecoderModal = memo(function AddDecoderModal({ isOpen, onClose }: AddDecoderModalProps) {
  const registerDecoder = useStore((state) => state.registerDecoder);
  
  const [sourceType, setSourceType] = useState<'url' | 'code'>('url');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

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

    if (sourceType === 'url') {
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
    } else {
      // Code-based model
      if (!code.trim()) {
        setError('JavaScript code is required');
        return;
      }

      decoder = {
        id,
        name: name.trim(),
        type: 'tfjs',
        description: description.trim() || 'Custom TensorFlow.js model from code',
        code: code.trim(),
        architecture: 'Custom (Code)',
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
  }, [sourceType, name, url, code, description, registerDecoder, onClose]);

  // AI Code Generation
  const handleAIGenerate = useCallback(async () => {
    if (!aiPrompt.trim() && !code.trim()) {
      setError('Enter a description of what you want to build');
      setShowAIPrompt(true);
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const result = await generateFromPrompt(
        aiPrompt.trim() || 'Generate a neural decoding model'
      );
      
      setCode(result.code);
      if (!description.trim()) {
        setDescription(result.explanation);
      }
      setShowAIPrompt(false);
      setAiPrompt('');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate code';
      setError(errorMsg);
      
      // If API key is missing, provide helpful message
      if (errorMsg.includes('API key')) {
        setError('Add VITE_GROQ_API_KEY to your .env file to enable AI generation. Get a free key at https://console.groq.com');
      }
    } finally {
      setIsGenerating(false);
    }
  }, [aiPrompt, code, description]);

  // Quick template generation
  const handleQuickTemplate = useCallback(async (templateType: 'mlp' | 'lstm' | 'cnn' | 'attention' | 'hybrid') => {
    setIsGenerating(true);
    setError('');

    try {
      const result = await generateTemplate(templateType);
      setCode(result.code);
      if (!description.trim()) {
        setDescription(result.explanation);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate template';
      setError(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  }, [description]);

  if (!isOpen) return null;

  // Full screen mode for code editor
  const isFullScreen = sourceType === 'code';

  const modalContent = (
    <div className={`${
      isFullScreen 
        ? 'fixed inset-0 z-50 bg-gray-900 flex flex-col' 
        : 'p-4 rounded-xl bg-gray-800/50 border border-gray-700/30 animate-fade-in'
    }`}>
      <div className={`flex justify-between items-center ${isFullScreen ? 'p-4 border-b border-gray-700/50' : 'mb-4'}`}>
        <h3 className="text-sm font-semibold text-white">Add Custom Decoder</h3>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors text-lg leading-none"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className={`${isFullScreen ? 'flex-1 flex flex-col overflow-hidden' : 'space-y-3'}`}>
        {/* Source type selector */}
        <div className={isFullScreen ? 'px-4 pt-2' : ''}>
          <label className="block text-xs text-gray-400 mb-1">Model Source *</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSourceType('url')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                sourceType === 'url' 
                  ? 'bg-loopback text-white' 
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
              }`}
            >
              📦 URL
            </button>
            <button
              type="button"
              onClick={() => setSourceType('code')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                sourceType === 'code' 
                  ? 'bg-loopback text-white' 
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
              }`}
            >
              💻 Code
            </button>
          </div>
        </div>

        {/* Name */}
        <div className={isFullScreen ? 'px-4' : ''}>
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

        {/* Model URL */}
        {sourceType === 'url' && (
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

        {/* TensorFlow.js Code */}
        {sourceType === 'code' && (
          <>
            {/* AI Prompt Panel */}
            {showAIPrompt && (
              <div className="mx-4 mb-2 p-3 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-500/30 animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-purple-300 font-semibold">🤖 Describe what you want to build:</label>
                  <button
                    type="button"
                    onClick={() => setShowAIPrompt(false)}
                    className="text-gray-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., Create a deep LSTM network with dropout for robust temporal decoding..."
                  rows={3}
                  className="w-full bg-gray-900/80 text-white px-3 py-2 rounded text-xs border border-purple-500/30 
                    focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400/50 resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleAIGenerate}
                    disabled={isGenerating}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 
                      rounded hover:from-purple-500 hover:to-blue-500 transition-all disabled:opacity-50"
                  >
                    {isGenerating ? 'Generating...' : '✨ Generate Code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTemplate('mlp')}
                    disabled={isGenerating}
                    className="px-3 py-1.5 text-xs text-gray-300 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50"
                  >
                    MLP
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTemplate('lstm')}
                    disabled={isGenerating}
                    className="px-3 py-1.5 text-xs text-gray-300 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50"
                  >
                    LSTM
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTemplate('attention')}
                    disabled={isGenerating}
                    className="px-3 py-1.5 text-xs text-gray-300 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50"
                  >
                    Attention
                  </button>
                </div>
              </div>
            )}

            {/* Monaco Code Editor */}
            <CodeEditor
              value={code}
              onChange={setCode}
              onGenerate={() => setShowAIPrompt(!showAIPrompt)}
              isGenerating={isGenerating}
            />
          </>
        )}

        {/* Description */}
        <div className={isFullScreen ? 'px-4' : ''}>
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
          <div className={`text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/30 ${isFullScreen ? 'mx-4' : ''}`}>
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className={`flex gap-2 ${isFullScreen ? 'px-4 pb-4 pt-2 border-t border-gray-700/50 bg-gray-800/50' : 'pt-2'}`}>
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
      {!isFullScreen && (
      <div className="mt-3 pt-3 border-t border-gray-700/50">
        {sourceType === 'code' ? (
          <>
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong className="text-gray-400">Build Custom Models:</strong> Use TensorFlow.js API to create, 
              compile, and optionally train models. The global <code className="text-loopback/80">tf</code> object 
              provides access to all TensorFlow.js functionality.
            </p>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              <strong className="text-gray-400">Example:</strong> Create sequential models with 
              <code className="text-loopback/80"> tf.sequential()</code>, add layers, compile with 
              <code className="text-loopback/80"> model.compile()</code>, and return the model.
            </p>
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
      )}
    </div>
  );

  // Use portal for full-screen mode to escape container constraints
  return isFullScreen 
    ? createPortal(modalContent, document.body)
    : modalContent;
});

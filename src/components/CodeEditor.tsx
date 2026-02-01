/**
 * Code Editor for Custom JavaScript Decoders
 * 
 * Features:
 * - Monaco Editor (VS Code engine)
 * - JavaScript IntelliSense
 * - Real-time syntax validation
 * - Code snippets for decoder patterns
 */

import { memo, useRef, useState, useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor, Position } from 'monaco-editor';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
}

// JavaScript decoder code snippets
const DECODER_SNIPPETS = [
  {
    label: 'Passthrough',
    code: `// Passthrough - returns actual cursor position
const { x, y, vx, vy } = input.kinematics;
return { x, y, vx, vy };`
  },
  {
    label: 'Velocity Predictor',
    code: `// Velocity predictor - linear extrapolation
const { x, y, vx, vy } = input.kinematics;
const dt = 0.025; // 25ms at 40Hz

return {
  x: x + vx * dt,
  y: y + vy * dt,
  vx,
  vy
};`
  },
  {
    label: 'Spike-Scaled',
    code: `// Scale velocity by spike rate
const { x, y, vx, vy } = input.kinematics;
const spikes = input.spikes;
const dt = 0.025;

const totalSpikes = spikes.reduce((sum, s) => sum + s, 0);
const avgRate = totalSpikes / spikes.length;
const scale = Math.min(avgRate / 10, 2);

return {
  x: x + vx * scale * dt,
  y: y + vy * scale * dt,
  vx: vx * scale,
  vy: vy * scale
};`
  },
  {
    label: 'Weighted Channels',
    code: `// Use specific channel weights
const { x, y, vx, vy } = input.kinematics;
const spikes = input.spikes;
const dt = 0.025;

// Example: weight first 64 channels for X, rest for Y
const xChannels = spikes.slice(0, 64);
const yChannels = spikes.slice(64, 128);

const xRate = xChannels.reduce((s, v) => s + v, 0) / 64;
const yRate = yChannels.reduce((s, v) => s + v, 0) / 64;

const scaleX = Math.tanh(xRate * 0.5);
const scaleY = Math.tanh(yRate * 0.5);

return {
  x: x + vx * scaleX * dt,
  y: y + vy * scaleY * dt,
  vx: vx * scaleX,
  vy: vy * scaleY,
  confidence: Math.max(scaleX, scaleY)
};`
  }
];

export const CodeEditor = memo(function CodeEditor({ 
  value, 
  onChange 
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [showSnippets, setShowSnippets] = useState(false);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);

  // Validate JavaScript syntax
  const validateCode = useCallback((code: string) => {
    if (!code.trim()) {
      setSyntaxError(null);
      return;
    }

    try {
      // Try to parse as a function body
      new Function('input', code);
      setSyntaxError(null);
    } catch (err) {
      setSyntaxError(err instanceof Error ? err.message : 'Invalid JavaScript');
    }
  }, []);

  // Configure Monaco Editor on mount
  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Configure JavaScript settings
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      allowJs: true,
      checkJs: true
    });

    // Add decoder input type definitions
    const decoderTypes = `
      interface DecoderInput {
        /** 142 spike count values per channel */
        spikes: number[];
        /** Current cursor state */
        kinematics: {
          x: number;
          y: number;
          vx: number;
          vy: number;
        };
        /** Previous decoder outputs */
        history?: Array<{ x: number; y: number; vx?: number; vy?: number; }>;
      }
      
      /** The input object available in your decoder */
      declare const input: DecoderInput;
    `;

    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      decoderTypes,
      'decoder-input.d.ts'
    );

    // Add code completion provider
    monaco.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems: (model: editor.ITextModel, position: Position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const suggestions = [
          {
            label: 'input.spikes',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'input.spikes',
            documentation: 'Array of 142 spike counts per channel',
            range
          },
          {
            label: 'input.kinematics',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'input.kinematics',
            documentation: 'Current cursor position and velocity { x, y, vx, vy }',
            range
          },
          {
            label: 'input.history',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'input.history',
            documentation: 'Array of previous decoder outputs',
            range
          }
        ];

        return { suggestions };
      }
    });

    // Validate code on change
    editor.onDidChangeModelContent(() => {
      validateCode(editor.getValue());
    });

    // Initial validation
    validateCode(value);
  }, [value, validateCode]);

  // Insert snippet
  const insertSnippet = useCallback((snippet: string) => {
    if (editorRef.current) {
      // Replace entire content with snippet
      const model = editorRef.current.getModel();
      if (model) {
        const fullRange = model.getFullModelRange();
        editorRef.current.executeEdits('', [{
          range: fullRange,
          text: snippet
        }]);
      }
    }
    setShowSnippets(false);
  }, []);

  // Format code
  const formatCode = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Editor Toolbar */}
      <div className="flex items-center justify-between mb-2 px-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">JavaScript Decoder Code</label>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs text-gray-400">Monaco Editor</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Snippets Button */}
          <button
            type="button"
            onClick={() => setShowSnippets(!showSnippets)}
            className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 rounded-lg 
              hover:bg-gray-600 transition-colors"
            title="Insert code template"
          >
            📝 Templates
          </button>
          
          {/* Format Button */}
          <button
            type="button"
            onClick={formatCode}
            className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 rounded-lg 
              hover:bg-gray-600 transition-colors"
            title="Format code (Shift+Alt+F)"
          >
            ✨ Format
          </button>
        </div>
      </div>

      {/* Snippets Panel */}
      {showSnippets && (
        <div className="mb-2 mx-4 p-3 bg-gray-800 rounded-lg border border-gray-700 animate-fade-in">
          <div className="text-xs text-gray-400 mb-2 font-semibold">Quick Templates:</div>
          <div className="grid grid-cols-2 gap-2">
            {DECODER_SNIPPETS.map((snippet, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => insertSnippet(snippet.code)}
                className="px-3 py-2 text-xs text-left text-gray-300 bg-gray-700/50 rounded 
                  hover:bg-gray-700 transition-colors border border-gray-600/30 hover:border-loopback/50"
              >
                {snippet.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Monaco Editor */}
      <div className="flex-1 relative min-h-0 mx-4">
        <Editor
          value={value}
          onChange={(val) => onChange(val || '')}
          onMount={handleEditorDidMount}
          language="javascript"
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            formatOnPaste: true,
            formatOnType: true,
            suggest: {
              showKeywords: true,
              showSnippets: true,
            },
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false
            },
            parameterHints: {
              enabled: true
            },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            snippetSuggestions: 'top',
            padding: { top: 16, bottom: 16 }
          }}
        />
      </div>

      {/* Syntax Error */}
      {syntaxError && (
        <div className="mt-2 mx-4 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="text-xs text-red-400">
            ❌ <strong>Syntax Error:</strong> {syntaxError}
          </div>
        </div>
      )}

      {/* Helper Info */}
      <div className="mt-2 mx-4 p-2 bg-gray-800/50 rounded-lg border border-gray-700/30">
        <div className="text-xs text-gray-400 leading-relaxed">
          <strong className="text-loopback">💡 Tips:</strong> Use <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">Ctrl+Space</kbd> for autocomplete. 
          Access <code className="text-loopback/80 bg-gray-900 px-1 rounded">input.spikes</code> (142 channels), 
          <code className="text-loopback/80 bg-gray-900 px-1 rounded">input.kinematics</code> (x, y, vx, vy), 
          and <code className="text-loopback/80 bg-gray-900 px-1 rounded">input.history</code> (previous outputs).
        </div>
      </div>
    </div>
  );
});

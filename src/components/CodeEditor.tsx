/**
 * World-Class Code Editor
 * 
 * Features:
 * - Monaco Editor (VS Code engine)
 * - AI-powered code generation via Groq
 * - TensorFlow.js IntelliSense
 * - Real-time validation
 * - Code snippets & templates
 */

import { memo, useRef, useState, useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor, Position } from 'monaco-editor';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate?: () => void;
  isGenerating?: boolean;
}

// TensorFlow.js code snippets
const TFJS_SNIPPETS = [
  {
    label: 'Sequential Model',
    code: `const model = tf.sequential();
model.add(tf.layers.dense({ 
  units: 64, 
  activation: 'relu', 
  inputShape: [142] 
}));
model.add(tf.layers.dense({ units: 2 }));
model.compile({ 
  optimizer: 'adam', 
  loss: 'meanSquaredError' 
});
return model;`
  },
  {
    label: 'LSTM Model',
    code: `const model = tf.sequential();
model.add(tf.layers.lstm({
  units: 64,
  inputShape: [10, 142],
  returnSequences: false
}));
model.add(tf.layers.dense({ units: 2 }));
model.compile({
  optimizer: 'adam',
  loss: 'meanSquaredError'
});
return model;`
  },
  {
    label: 'Functional API Model',
    code: `const input = tf.input({ shape: [142] });
const hidden = tf.layers.dense({ units: 64, activation: 'relu' }).apply(input);
const output = tf.layers.dense({ units: 2 }).apply(hidden);
const model = tf.model({ inputs: input, outputs: output });
model.compile({
  optimizer: 'adam',
  loss: 'meanSquaredError'
});
return model;`
  },
  {
    label: 'Conv1D Model',
    code: `const model = tf.sequential();
model.add(tf.layers.reshape({ 
  inputShape: [142], 
  targetShape: [142, 1] 
}));
model.add(tf.layers.conv1d({
  filters: 32,
  kernelSize: 3,
  activation: 'relu'
}));
model.add(tf.layers.flatten());
model.add(tf.layers.dense({ units: 2 }));
model.compile({
  optimizer: 'adam',
  loss: 'meanSquaredError'
});
return model;`
  }
];

export const CodeEditor = memo(function CodeEditor({ 
  value, 
  onChange, 
  onGenerate,
  isGenerating = false 
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [showSnippets, setShowSnippets] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Validate TensorFlow.js code
  const validateCode = useCallback((code: string) => {
    const errors: string[] = [];

    if (!code.trim()) {
      setValidationErrors([]);
      return;
    }

    // Check for return statement
    if (!code.includes('return')) {
      errors.push('Code must return a compiled TensorFlow.js model');
    }

    // Check for model compilation
    if (code.includes('tf.sequential()') || code.includes('tf.model(')) {
      if (!code.includes('.compile(')) {
        errors.push('Model must be compiled with .compile()');
      }
    }

    // Check for common mistakes
    if (code.includes('model.fit(') && !code.includes('await')) {
      errors.push('model.fit() is async - consider using await or .then()');
    }

    setValidationErrors(errors);
  }, []);

  // Configure Monaco Editor on mount
  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Configure TypeScript/JavaScript settings
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      esModuleInterop: true,
      allowJs: true,
      checkJs: true
    });

    // Add TensorFlow.js type definitions (simplified)
    const tfjsTypes = `
      declare namespace tf {
        function sequential(): LayersModel;
        function model(config: { inputs: any; outputs: any }): LayersModel;
        function input(config: { shape: number[] }): any;
        
        namespace layers {
          function dense(config: { units: number; activation?: string; inputShape?: number[] }): any;
          function lstm(config: { units: number; inputShape?: number[]; returnSequences?: boolean }): any;
          function gru(config: { units: number; inputShape?: number[]; returnSequences?: boolean }): any;
          function bidirectional(config: { layer: any }): any;
          function conv1d(config: { filters: number; kernelSize: number; activation?: string }): any;
          function maxPooling1d(config: { poolSize: number }): any;
          function globalMaxPooling1d(): any;
          function dropout(config: { rate: number }): any;
          function flatten(): any;
          function reshape(config: { inputShape?: number[]; targetShape: number[] }): any;
        }
        
        interface LayersModel {
          compile(config: { optimizer: string | any; loss: string; metrics?: string[] }): void;
          fit(x: any, y: any, config?: any): Promise<any>;
          predict(x: any): any;
          summary(): void;
        }
        
        namespace train {
          function adam(learningRate?: number): any;
          function sgd(learningRate?: number): any;
          function rmsprop(learningRate?: number): any;
        }
      }
    `;

    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      tfjsTypes,
      'tensorflow.d.ts'
    );

    // Add code completion provider for custom snippets
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
            label: 'tfSequential',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: TFJS_SNIPPETS[0].code,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Create a Sequential Model',
            range
          },
          {
            label: 'tfLSTM',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: TFJS_SNIPPETS[1].code,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Create an LSTM Model',
            range
          },
          {
            label: 'tfFunctional',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: TFJS_SNIPPETS[2].code,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Create a Functional API Model',
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
      const selection = editorRef.current.getSelection();
      if (selection) {
        editorRef.current.executeEdits('', [{
          range: selection,
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
          <label className="text-xs text-gray-400">TensorFlow.js Code *</label>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs text-gray-400">Monaco Editor</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* AI Generate Button */}
          {onGenerate && (
            <button
              type="button"
              onClick={onGenerate}
              disabled={isGenerating}
              className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 
                rounded-lg hover:from-purple-500 hover:to-blue-500 transition-all disabled:opacity-50 
                disabled:cursor-not-allowed flex items-center gap-1.5"
              title="Generate code with AI (Groq)"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI Generate
                </>
              )}
            </button>
          )}
          
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
            {TFJS_SNIPPETS.map((snippet, idx) => (
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

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mt-2 mx-4 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="text-xs text-yellow-400 font-semibold mb-1">⚠️ Warnings:</div>
          {validationErrors.map((error, idx) => (
            <div key={idx} className="text-xs text-yellow-300/80 ml-4">
              • {error}
            </div>
          ))}
        </div>
      )}

      {/* Helper Info */}
      <div className="mt-2 mx-4 p-2 bg-gray-800/50 rounded-lg border border-gray-700/30">
        <div className="text-xs text-gray-400 leading-relaxed">
          <strong className="text-loopback">💡 Tips:</strong> Use <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">Ctrl+Space</kbd> for autocomplete, 
          <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs ml-1">Shift+Alt+F</kbd> to format. 
          The global <code className="text-loopback/80 bg-gray-900 px-1 rounded">tf</code> object provides full TensorFlow.js API access.
        </div>
      </div>
    </div>
  );
});

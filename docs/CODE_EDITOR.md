# 🚀 World-Class Code Editor

The PhantomLoop code editor is powered by **Monaco Editor** (the same engine as VS Code) with AI-powered code generation via **Groq**.

## ✨ Features

### 1. **Monaco Editor Integration**
- Full VS Code editing experience
- Syntax highlighting for JavaScript/TypeScript
- IntelliSense autocomplete
- Real-time error detection
- Code formatting (Shift+Alt+F)
- Parameter hints
- Multi-cursor support

### 2. **TensorFlow.js IntelliSense**
- Built-in type definitions for TensorFlow.js
- Autocomplete for `tf.layers`, `tf.sequential()`, `tf.model()`
- Parameter hints for layer configurations
- Smart suggestions for model building

### 3. **AI-Powered Code Generation**
Powered by **Groq** - ultra-fast LLM inference:
- Natural language to code
- Generate complete models from descriptions
- Quick templates (MLP, LSTM, CNN, Attention, Hybrid)
- Model improvement suggestions

### 4. **Code Validation**
- Real-time syntax checking
- TensorFlow.js best practices validation
- Warns about missing `return` statements
- Detects uncompiled models
- Async/await suggestions

### 5. **Quick Templates**
Pre-built snippets for common architectures:
- Sequential Model
- LSTM Model
- Functional API Model
- Conv1D Model

### 6. **Keyboard Shortcuts**
- `Ctrl+Space` - Trigger autocomplete
- `Shift+Alt+F` - Format code
- `Ctrl+/` - Toggle comment
- `Ctrl+D` - Select next occurrence
- `Alt+Click` - Multi-cursor

## 🔧 Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Groq API (Optional)

Get a free API key at [console.groq.com](https://console.groq.com)

Create a `.env` file:
```env
VITE_GROQ_API_KEY=your_groq_api_key_here
```

> **Note**: The editor works without Groq - you just won't have AI generation features.

## 🎯 Usage

### Basic Usage

1. Click **"+ Add Decoder"** in the decoder selector
2. Select **"💻 Code"** tab
3. Start coding!

### Using AI Generation

1. Click the **"⚡ AI Generate"** button
2. Describe what you want to build
3. Click **"✨ Generate Code"** or choose a quick template
4. Edit and customize the generated code

### Using Templates

1. Click **"📝 Templates"** button
2. Select a template (Sequential, LSTM, Functional API, Conv1D)
3. Code is inserted at cursor position

### Code Validation

The editor automatically validates your code and shows warnings for:
- Missing return statements
- Uncompiled models
- Async operations without await
- Common TensorFlow.js mistakes

## 💡 Examples

### Generate from Natural Language

**Prompt:**
```
Create a deep LSTM network with dropout for robust temporal decoding
```

**Generated Code:**
```javascript
const model = tf.sequential();
model.add(tf.layers.lstm({
  units: 128,
  returnSequences: true,
  inputShape: [10, 142]
}));
model.add(tf.layers.dropout({ rate: 0.3 }));
model.add(tf.layers.lstm({
  units: 64,
  returnSequences: false
}));
model.add(tf.layers.dropout({ rate: 0.2 }));
model.add(tf.layers.dense({ units: 2 }));
model.compile({
  optimizer: tf.train.adam(0.001),
  loss: 'meanSquaredError'
});
return model;
```

### Quick Template Usage

Type `tfSequential` and press Tab to get:
```javascript
const model = tf.sequential();
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
return model;
```

## 🏗️ Architecture

```
CodeEditor.tsx
├── Monaco Editor (VS Code engine)
├── TensorFlow.js Type Definitions
├── Code Validation Engine
├── Snippet System
└── AI Integration (Groq)

groqCodegen.ts
├── Groq API Client
├── Prompt Engineering
├── Template Generation
└── Code Improvement
```

## 🔥 Groq Integration

Groq provides **ultra-fast** LLM inference (10x faster than traditional APIs):

- **Model**: Mixtral-8x7b-32768
- **Speed**: ~500 tokens/second
- **Quality**: GPT-4 class reasoning
- **Cost**: Free tier available

### Why Groq?

- ⚡ **Lightning fast** - Generate code in <2 seconds
- 🧠 **Smart** - Understands TensorFlow.js and neural decoding
- 💰 **Affordable** - Free tier for development
- 🔒 **Reliable** - High uptime and stability

## 📝 Code Requirements

All generated/written code must:

1. **Return a compiled model**
   ```javascript
   return model;  // ✅ Required
   ```

2. **Compile the model**
   ```javascript
   model.compile({
     optimizer: 'adam',
     loss: 'meanSquaredError'
   });
   ```

3. **Match input/output shapes**
   - Input: `[142]` or `[10, 142]`
   - Output: `[2]` (vx, vy)

4. **Use the global `tf` object**
   ```javascript
   const model = tf.sequential();  // ✅ Correct
   // Not: import * as tf from '@tensorflow/tfjs'
   ```

## 🐛 Troubleshooting

### Monaco Editor not loading?
- Check browser console for errors
- Ensure you're using a modern browser (Chrome, Firefox, Edge)

### AI generation not working?
- Verify `VITE_GROQ_API_KEY` is set in `.env`
- Check Groq API status at [status.groq.com](https://status.groq.com)
- Check browser console for API errors

### Autocomplete not working?
- Press `Ctrl+Space` to manually trigger
- Check that you're in JavaScript mode
- Try typing `tf.` to trigger TensorFlow.js suggestions

### Code validation false positives?
- Validation is best-effort and may have false positives
- You can ignore warnings if your code is correct
- Real errors will be caught at runtime

## 🎨 Customization

### Theme
The editor uses VS Code's dark theme by default. To customize:

```typescript
<Editor
  theme="vs-dark"  // or "vs-light", "hc-black"
  // ... other options
/>
```

### Font Size
```typescript
options={{
  fontSize: 13,  // Adjust as needed
  // ... other options
}}
```

### Minimap
```typescript
options={{
  minimap: { enabled: true },  // Show minimap
  // ... other options
}}
```

## 🚀 Future Enhancements

- [ ] Multi-file editing
- [ ] Code diff viewer
- [ ] Git integration
- [ ] Collaborative editing
- [ ] Model visualization
- [ ] Performance profiling
- [ ] Custom themes
- [ ] Vim/Emacs keybindings

## 📚 Resources

- [Monaco Editor Docs](https://microsoft.github.io/monaco-editor/)
- [TensorFlow.js Docs](https://js.tensorflow.org/)
- [Groq API Docs](https://console.groq.com/docs)
- [PhantomLoop README](../README.md)

## 💬 Support

Questions? Issues? Feature requests?

- Open an issue on GitHub
- Check the [BEGINNERS_GUIDE.md](../docs/BEGINNERS_GUIDE.md)
- Ask in Discord/Slack

---

**Built with ❤️ for the BCI community**

# 🚀 Quick Setup: World-Class Code Editor

## What You Get

✅ **Monaco Editor** - VS Code's engine  
✅ **AI Code Generation** - Powered by Groq  
✅ **IntelliSense** - TensorFlow.js autocomplete  
✅ **Real-time Validation** - Catch errors as you type  
✅ **Code Templates** - Quick starts for common models  
✅ **Full-screen Mode** - Distraction-free coding  

---

## 🎯 Quick Start (2 minutes)

### 1. Install (already done!)
```bash
npm install @monaco-editor/react
```

### 2. Enable AI Generation (Optional)

**Get a free Groq API key:**
1. Visit https://console.groq.com
2. Sign up (free)
3. Create an API key

**Add to your project:**
Create a `.env` file in the project root:
```env
VITE_GROQ_API_KEY=gsk_your_actual_key_here
```

That's it! Restart the dev server.

---

## 🎨 How to Use

### Open the Editor
1. Click **"+ Add Decoder"** button
2. Select **"💻 Code"** tab
3. Full-screen editor appears!

### Use AI Generation
1. Click **"⚡ AI Generate"** button
2. Describe your model: _"Create a deep LSTM with dropout"_
3. Click **"✨ Generate Code"** or pick a template
4. Edit and customize!

### Use Templates
- Click **"📝 Templates"** 
- Choose: Sequential, LSTM, Functional API, or Conv1D
- Code inserted instantly

### Code Like a Pro
- `Ctrl+Space` - Autocomplete
- `Shift+Alt+F` - Format code
- Type `tf.` - See all TensorFlow.js options
- Errors highlighted in real-time

---

## 💡 Try These Prompts

**Simple:**
```
Create a basic neural network for velocity prediction
```

**Advanced:**
```
Create a bidirectional LSTM with attention mechanism for temporal decoding
```

**Specific:**
```
Build a 1D CNN with 3 convolutional layers, batch normalization, and dropout
```

---

## 🎓 Example: Full Workflow

1. **Open Code Editor**
   - Click "+ Add Decoder" → "💻 Code"

2. **Generate with AI**
   ```
   Prompt: "Create a 3-layer MLP with ReLU activation and dropout"
   ```

3. **Review Generated Code**
   ```javascript
   const model = tf.sequential();
   model.add(tf.layers.dense({ 
     units: 128, 
     activation: 'relu', 
     inputShape: [142] 
   }));
   model.add(tf.layers.dropout({ rate: 0.3 }));
   model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
   model.add(tf.layers.dropout({ rate: 0.2 }));
   model.add(tf.layers.dense({ units: 2 }));
   model.compile({
     optimizer: 'adam',
     loss: 'meanSquaredError'
   });
   return model;
   ```

4. **Customize**
   - Change layer sizes
   - Adjust dropout rates
   - Try different optimizers

5. **Save & Test**
   - Click "Add Decoder"
   - Watch it decode in real-time!

---

## ❓ FAQ

**Q: Do I need a Groq API key?**  
A: No! The editor works perfectly without it. You just won't have AI generation.

**Q: Is the API key free?**  
A: Yes! Groq offers a generous free tier perfect for development.

**Q: What if AI generation fails?**  
A: Use templates or write code manually. The editor still provides full IntelliSense.

**Q: Can I use my own models?**  
A: Yes! You can also load models from URLs or write completely custom code.

**Q: Is my code validated?**  
A: Yes! Real-time validation catches common mistakes before you run the code.

---

## 🎁 Bonus Features

### Code Snippets
Type these shortcuts then press Tab:
- `tfSequential` - Sequential model template
- `tfLSTM` - LSTM model template  
- `tfFunctional` - Functional API template

### Keyboard Shortcuts
- `Ctrl+/` - Toggle comment
- `Ctrl+D` - Select next occurrence
- `Alt+Click` - Multi-cursor editing
- `Ctrl+F` - Find in code

### Smart Validation
Warns you about:
- Missing `return` statements
- Uncompiled models
- Async operations
- Common TensorFlow.js mistakes

---

## 📚 Learn More

- Full documentation: [CODE_EDITOR.md](./CODE_EDITOR.md)
- TensorFlow.js docs: https://js.tensorflow.org/
- Groq AI docs: https://console.groq.com/docs

---

## 🎉 You're Ready!

Start building world-class neural decoders with AI assistance!

**Next steps:**
1. Add your Groq API key (optional)
2. Open the code editor
3. Generate your first model
4. Test it with real neural data

Happy coding! 🚀

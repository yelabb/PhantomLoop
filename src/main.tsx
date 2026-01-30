import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import './index.css';
import App from './App.tsx';

// Initialize TensorFlow.js backends (for future ML decoders)
async function initializeTensorFlow() {
  try {
    const tf = await import('@tensorflow/tfjs');
    
    // Try WebGPU first (fastest)
    try {
      await tf.setBackend('webgpu');
      await tf.ready();
      console.log('[PhantomLoop] TensorFlow.js initialized with WebGPU backend');
      return;
    } catch {
      console.log('[PhantomLoop] WebGPU not available, trying WebGL...');
    }

    // Fallback to WebGL
    try {
      await tf.setBackend('webgl');
      await tf.ready();
      console.log('[PhantomLoop] TensorFlow.js initialized with WebGL backend');
      return;
    } catch {
      console.log('[PhantomLoop] WebGL not available, using CPU backend');
    }

    // Final fallback to CPU
    await tf.setBackend('cpu');
    await tf.ready();
    console.log('[PhantomLoop] TensorFlow.js initialized with CPU backend');
  } catch (error) {
    console.error('[PhantomLoop] Failed to initialize TensorFlow.js:', error);
  }
}

// Initialize TensorFlow.js before rendering
initializeTensorFlow().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <Analytics />
    </StrictMode>
  );
});

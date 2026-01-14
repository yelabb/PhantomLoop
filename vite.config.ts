import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  define: {
    // Fix for CommonJS modules in ESM context
    'global': 'globalThis',
  },
  optimizeDeps: {
    include: [
      '@tensorflow/tfjs',
      '@tensorflow/tfjs-core',
      '@tensorflow/tfjs-backend-cpu',
      '@tensorflow/tfjs-backend-webgl',
      'long',
      'seedrandom',
    ],
    esbuildOptions: {
      target: 'esnext',
      // Handle CommonJS modules
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    target: 'esnext',
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
})

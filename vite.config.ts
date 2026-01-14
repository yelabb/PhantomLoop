import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Enable Buffer polyfill
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  worker: {
    format: 'es',
  },
  resolve: {
    alias: {
      buffer: 'buffer/',
    },
  },
  define: {
    // Fix for CommonJS modules in ESM context
    'global': 'globalThis',
    'process.env': '{}',
  },
  optimizeDeps: {
    include: [
      '@tensorflow/tfjs',
      '@tensorflow/tfjs-core',
      '@tensorflow/tfjs-backend-cpu',
      '@tensorflow/tfjs-backend-webgl',
      'long',
      'seedrandom',
      'buffer',
      'msgpack-lite',
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

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // VITE_BASE is set by the GitHub Pages workflow to "/<repo>/" so all
  // relative URLs resolve under the Pages subpath. Local dev uses "./".
  base: process.env.VITE_BASE ?? './',
  plugins: [react()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  server: {
    headers: {
      // transformers.js WebGPU + cross-origin isolation for SharedArrayBuffer (WASM fallback)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});

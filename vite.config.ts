import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {NodeGlobalsPolyfillPlugin} from '@esbuild-plugins/node-globals-polyfill'
// import { fileURLToPath } from 'url';
// import { dirname } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: true,
        }),
      ],
    },
    include: ['buffer'],
    exclude: ['lucide-react'],
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
});

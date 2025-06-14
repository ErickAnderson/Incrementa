import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  server: {
    port: 3000,
    open: true,
    cors: true
  },
  resolve: {
    alias: {
      // Resolve the incrementa import to the built dist file
      'incrementa': resolve(__dirname, '../../dist/incrementa.js')
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  }
});
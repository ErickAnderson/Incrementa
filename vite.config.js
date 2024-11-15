import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      name: 'Incrementa',
      entry: resolve(__dirname, 'src/main.ts'),
      fileName: 'incrementa'
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      }
    }
  }
})
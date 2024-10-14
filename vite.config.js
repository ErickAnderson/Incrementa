import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      name: 'Incrementa',
      entry: resolve(__dirname, 'src/main.ts'),
      fileName: 'incrementa'
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/main.ts'),
      }
    }
  }
})
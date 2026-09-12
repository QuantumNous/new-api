import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = path.resolve(import.meta.dirname)

export default defineConfig({
  root,
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      },
    }),
  ],
  build: {
    emptyOutDir: false,
    rollupOptions: {
      input: {
        'react-compiler': path.resolve(root, 'react-compiler/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@tanstack/react-virtual': path.resolve(root, '../../src/index'),
      '@tanstack/virtual-core': path.resolve(
        root,
        '../../../virtual-core/src/index',
      ),
    },
  },
})

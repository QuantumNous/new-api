import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    strictPort: true,
  },
  build: {
    target: 'esnext',
  },
})

import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'

const outDir = process.env.E2E_DIST_DIR ?? 'dist'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  build: {
    outDir,
  },
  server: {
    port: 3000,
  },
  plugins: [
    tanstackStart({
      rsc: {
        enabled: true,
      },
    }),
    rsc(),
    viteReact(),
  ],
})

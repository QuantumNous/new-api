import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

const outDir = process.env.E2E_DIST_DIR ?? 'dist-vite-ssr'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  build: {
    outDir,
  },
  server: { port: 3000 },
  plugins: [tanstackStart(), viteReact()],
})

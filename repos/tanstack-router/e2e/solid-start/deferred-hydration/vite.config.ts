import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/solid-start/plugin/vite'
import viteSolid from 'vite-plugin-solid'

const outDir = process.env.E2E_DIST_DIR ?? 'dist-vite-ssr'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  build: {
    outDir,
  },
  server: { port: 3000 },
  plugins: [tanstackStart(), viteSolid({ ssr: true })],
})

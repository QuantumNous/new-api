import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'

const outDir = process.env.E2E_DIST_DIR ?? 'dist'
const bundledDev = process.env.E2E_VITE_BUNDLED_DEV === 'true'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  experimental: bundledDev ? { bundledDev: true } : undefined,
  build: {
    outDir,
  },
  server: {
    port: 3000,
  },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
})

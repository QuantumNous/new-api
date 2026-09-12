import url from 'node:url'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import type { BuildEnvironmentOptions } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Client Build Configuration
const clientBuildConfig: BuildEnvironmentOptions = {
  outDir: 'dist/client',
  emitAssets: true,
  copyPublicDir: true,
  emptyOutDir: true,
}

// Server Build Configuration
const serverBuildConfig: BuildEnvironmentOptions = {
  ssr: true,
  outDir: 'dist/server',
  copyPublicDir: false,
  emptyOutDir: true,
  rolldownOptions: {
    input: path.resolve(__dirname, 'src/server/server.ts'),
    output: {
      entryFileNames: '[name].js',
      chunkFileNames: 'assets/[name]-[hash].js',
      assetFileNames: 'assets/[name]-[hash][extname]',
    },
  },
}

// https://vitejs.dev/config/
export default defineConfig((configEnv) => {
  return {
    plugins: [
      tailwindcss(),
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
      }),
      react(),
    ],
    build: configEnv.mode === 'server' ? serverBuildConfig : clientBuildConfig,
  }
})

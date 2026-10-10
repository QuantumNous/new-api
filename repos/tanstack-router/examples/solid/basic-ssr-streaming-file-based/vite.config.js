import url from 'node:url'
import path from 'node:path'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// SSR configuration
const ssrBuildConfig = {
  ssr: true,
  outDir: 'dist/server',
  ssrEmitAssets: true,
  copyPublicDir: false,
  emptyOutDir: true,
  rolldownOptions: {
    input: path.resolve(__dirname, 'src/entry-server.tsx'),
    output: {
      entryFileNames: 'static/[name].js',
      chunkFileNames: 'static/assets/[name]-[hash].js',
      assetFileNames: 'static/assets/[name]-[hash][extname]',
    },
  },
}

// Client-specific configuration
const clientBuildConfig = {
  outDir: 'dist/client',
  emitAssets: true,
  copyPublicDir: true,
  emptyOutDir: true,
  rolldownOptions: {
    input: path.resolve(__dirname, 'src/entry-client.tsx'),
    output: {
      entryFileNames: 'static/[name].js',
      chunkFileNames: 'static/assets/[name]-[hash].js',
      assetFileNames: 'static/assets/[name]-[hash][extname]',
    },
  },
}

// https://vitejs.dev/config/
export default defineConfig((configEnv) => {
  return {
    plugins: [
      tailwindcss(),
      tanstackRouter({ target: 'solid', autoCodeSplitting: true }),
      solid({ ssr: true }),
    ],
    build: configEnv.isSsrBuild ? ssrBuildConfig : clientBuildConfig,
  }
})

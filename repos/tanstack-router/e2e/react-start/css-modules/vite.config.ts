import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

// Environment variables for different test configurations:
// - VITE_BASE_PATH: Set to '/my-app' for basepath testing
// - VITE_USE_NITRO: Set to 'true' to enable Nitro server
// - VITE_CSS_CODE_SPLIT: Set to 'false' to disable CSS code splitting in prod
const basePath = process.env.VITE_BASE_PATH
const useNitro = process.env.VITE_USE_NITRO === 'true'
const cssCodeSplit = process.env.VITE_CSS_CODE_SPLIT !== 'false'

export default defineConfig(async () => {
  // Dynamically import nitro only when needed to avoid loading it when not used
  const nitroPlugin = useNitro ? [(await import('nitro/vite')).nitro()] : []

  return {
    resolve: { tsconfigPaths: true },
    base: basePath,
    server: {
      port: 3000,
    },
    build: {
      cssCodeSplit,
    },
    plugins: [
      // Nitro is placed BEFORE tanstackStart to test that our CSS middleware
      // works regardless of plugin order (nitro has a catch-all middleware)
      ...nitroPlugin,
      tanstackStart(),
      viteReact(),
    ],
  }
})

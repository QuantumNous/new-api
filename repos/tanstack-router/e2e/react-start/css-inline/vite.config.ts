import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

const outDir = process.env.E2E_DIST_DIR ?? 'dist-vite-ssr'
const transformInlineCssAssets =
  process.env.CSS_INLINE_TRANSFORM_ASSETS === 'true'

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
      server: {
        build: {
          inlineCss: transformInlineCssAssets
            ? { enabled: true, transformAssets: true }
            : true,
        },
      },
    }),
    viteReact(),
  ],
})

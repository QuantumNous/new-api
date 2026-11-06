import { fileURLToPath } from 'node:url'
import * as path from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/router',
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.json'),
    }),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: 'router',
      fileName: 'index',
      formats: ['es'],
    },
    rolldownOptions: {
      // External packages that should not be bundled into your library.
      external: [
        'solid-js',
        'solid-js/web',
        '@tanstack/solid-query',
        'redaxios',
      ],
    },
  },
})

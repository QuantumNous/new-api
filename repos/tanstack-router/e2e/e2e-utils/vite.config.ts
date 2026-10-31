import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  build: {
    ssr: true,
    emptyOutDir: true,
    rolldownOptions: {
      input: 'src/index.ts',
      output: [
        {
          format: 'esm',
          dir: './dist/esm',
          entryFileNames: '[name].js',
          preserveModules: true,
          preserveModulesRoot: path.resolve(__dirname, 'src'),
        },
        {
          format: 'cjs',
          dir: './dist/cjs',
          entryFileNames: '[name].cjs',
          preserveModules: true,
          preserveModulesRoot: path.resolve(__dirname, 'src'),
        },
      ],
    },
  },
  plugins: [
    dts({
      copyDtsFiles: true,
      entryRoot: './src',
      outDir: './dist/types',
    }),
  ],
})

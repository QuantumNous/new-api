// @ts-check

import { defineConfig } from 'rollup'
import { buildConfigs } from '../../scripts/getRollupConfig.js'

export default defineConfig(
  buildConfigs({
    name: 'react-table-devtools',
    jsName: 'ReactTableDevtools',
    outputFile: 'index',
    entryFile: 'src/index.tsx',
    external: ['react', '@tanstack/react-table'],
    globals: {
      react: 'React',
      '@tanstack/react-table': 'ReactTable',
    },
  })
)

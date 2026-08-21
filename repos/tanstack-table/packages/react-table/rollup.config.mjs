// @ts-check

import { defineConfig } from 'rollup'
import { buildConfigs } from '../../scripts/getRollupConfig.js'

export default defineConfig(
  buildConfigs({
    name: 'react-table',
    jsName: 'ReactTable',
    outputFile: 'index',
    entryFile: 'src/index.tsx',
    external: ['react', '@tanstack/table-core'],
    globals: {
      react: 'React',
    },
  })
)

// @ts-check

import { defineConfig } from 'rollup'
import { buildConfigs } from '../../scripts/getRollupConfig.js'

export default defineConfig(
  buildConfigs({
    name: 'solid-table',
    jsName: 'SolidTable',
    outputFile: 'index',
    entryFile: 'src/index.tsx',
    external: ['solid-js', 'solid-js/store', '@tanstack/table-core'],
    globals: {
      'solid-js': 'Solid',
      'solid-js/store': 'SolidStore',
    },
  })
)

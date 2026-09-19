// @ts-check

import { defineConfig } from 'rollup'
import { buildConfigs } from '../../scripts/getRollupConfig.js'

export default defineConfig(
  buildConfigs({
    name: 'vue-table',
    jsName: 'VueTable',
    outputFile: 'index',
    entryFile: 'src/index.ts',
    external: ['vue', '@tanstack/table-core'],
    globals: {
      vue: 'Vue',
    },
  })
)

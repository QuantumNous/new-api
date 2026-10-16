// @ts-check

import { defineConfig } from 'rollup'
import { buildConfigs } from '../../scripts/getRollupConfig.js'

export default defineConfig(
  buildConfigs({
    name: 'qwik-table',
    jsName: 'QwikTable',
    outputFile: 'index',
    entryFile: 'src/index.tsx',
    external: ['@tanstack/table-core', '@builder.io/qwik'],
    globals: {
      '@builder.io/qwik': 'Qwik',
    },
  })
)

// @ts-check

import { defineConfig } from 'rollup'
import { buildConfigs } from '../../scripts/getRollupConfig.js'

export default defineConfig(
  buildConfigs({
    name: 'svelte-table',
    jsName: 'SvelteTable',
    outputFile: 'index',
    entryFile: 'src/index.ts',
    external: [
      'svelte',
      'svelte/internal',
      'svelte/store',
      '@tanstack/table-core',
    ],
    globals: {
      svelte: 'Svelte',
      'svelte/internal': 'SvelteInternal',
      'svelte/store': 'SvelteStore',
    },
  })
)

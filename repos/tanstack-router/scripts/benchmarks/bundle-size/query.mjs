#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  allowPositionals: false,
  options: {
    current: {
      type: 'string',
      default: 'benchmarks/bundle-size/results/current.json',
    },
    id: { type: 'string' },
    json: { type: 'boolean' },
  },
})

const currentPath = path.resolve(values.current)
const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'))
const metrics = values.id
  ? (current.metrics || []).filter((metric) => metric.id === values.id)
  : current.metrics || []

if (values.id && metrics.length === 0) {
  throw new Error(`Unknown bundle-size metric: ${values.id}`)
}

if (values.json) {
  process.stdout.write(JSON.stringify(metrics, null, 2) + '\n')
} else {
  for (const metric of metrics) {
    process.stdout.write(
      [
        metric.id,
        `gzip=${metric.gzipBytes}`,
        `initial=${metric.initialGzipBytes}`,
        `raw=${metric.rawBytes}`,
        `brotli=${metric.brotliBytes}`,
        `dist=${metric.outDir || metric.scenarioDir}`,
        `files=${(metric.jsFiles || []).join(',')}`,
      ].join(' ') + '\n',
    )
  }
}

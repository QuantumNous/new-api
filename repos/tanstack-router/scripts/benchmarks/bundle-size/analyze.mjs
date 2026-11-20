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
    'top-sources': { type: 'string', default: '30' },
    json: { type: 'boolean' },
  },
})

if (!values.id) {
  throw new Error('Missing required argument: --id')
}

const current = JSON.parse(
  fs.readFileSync(path.resolve(values.current), 'utf8'),
)
const metric = (current.metrics || []).find((item) => item.id === values.id)

if (!metric) {
  throw new Error(`Unknown bundle-size metric: ${values.id}`)
}

if (!metric.sources) {
  throw new Error(
    `No source attribution found for ${values.id}. Re-run measure with --analysis.`,
  )
}

const sourceBytes = new Map()
for (const chunk of metric.sources) {
  for (const source of chunk.sources || []) {
    sourceBytes.set(
      source.source,
      (sourceBytes.get(source.source) || 0) + source.estimatedBytes,
    )
  }
}

const rows = [...sourceBytes]
  .map(([source, estimatedBytes]) => ({ source, estimatedBytes }))
  .sort((a, b) => b.estimatedBytes - a.estimatedBytes)
  .slice(0, Number.parseInt(values['top-sources'], 10))

if (values.json) {
  process.stdout.write(JSON.stringify(rows, null, 2) + '\n')
} else {
  for (const row of rows) {
    process.stdout.write(`${row.estimatedBytes} ${row.source}\n`)
  }
}

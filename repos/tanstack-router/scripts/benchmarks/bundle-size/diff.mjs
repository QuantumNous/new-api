#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  allowPositionals: false,
  options: {
    baseline: { type: 'string' },
    current: {
      type: 'string',
      default: 'benchmarks/bundle-size/results/current.json',
    },
    id: { type: 'string' },
    json: { type: 'boolean' },
  },
})

if (!values.baseline) {
  throw new Error('Missing required argument: --baseline')
}

function readCurrent(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'))
}

function byId(current) {
  return new Map((current.metrics || []).map((metric) => [metric.id, metric]))
}

const baselineById = byId(readCurrent(values.baseline))
const currentById = byId(readCurrent(values.current))
const ids = values.id
  ? [values.id]
  : [...new Set([...baselineById.keys(), ...currentById.keys()])].sort()

const rows = ids.map((id) => {
  const baseline = baselineById.get(id)
  const current = currentById.get(id)
  return {
    id,
    baseline: baseline?.gzipBytes,
    current: current?.gzipBytes,
    delta:
      Number.isFinite(baseline?.gzipBytes) &&
      Number.isFinite(current?.gzipBytes)
        ? current.gzipBytes - baseline.gzipBytes
        : undefined,
    initialDelta:
      Number.isFinite(baseline?.initialGzipBytes) &&
      Number.isFinite(current?.initialGzipBytes)
        ? current.initialGzipBytes - baseline.initialGzipBytes
        : undefined,
    rawDelta:
      Number.isFinite(baseline?.rawBytes) && Number.isFinite(current?.rawBytes)
        ? current.rawBytes - baseline.rawBytes
        : undefined,
    brotliDelta:
      Number.isFinite(baseline?.brotliBytes) &&
      Number.isFinite(current?.brotliBytes)
        ? current.brotliBytes - baseline.brotliBytes
        : undefined,
  }
})

if (values.json) {
  process.stdout.write(JSON.stringify(rows, null, 2) + '\n')
} else {
  for (const row of rows) {
    const delta = Number.isFinite(row.delta)
      ? `${row.delta >= 0 ? '+' : ''}${row.delta}`
      : 'n/a'
    process.stdout.write(
      `${row.id} ${row.baseline ?? 'n/a'} -> ${row.current ?? 'n/a'} (${delta}) initial=${row.initialDelta ?? 'n/a'} raw=${row.rawDelta ?? 'n/a'} brotli=${row.brotliDelta ?? 'n/a'}\n`,
    )
  }
}

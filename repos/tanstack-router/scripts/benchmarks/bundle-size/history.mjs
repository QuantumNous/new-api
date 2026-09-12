#!/usr/bin/env node

import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import vm from 'node:vm'
import { parseArgs } from 'node:util'

const HISTORY_PATH = 'benchmarks/bundle-size/data.js'

const { values } = parseArgs({
  allowPositionals: false,
  options: {
    history: { type: 'string' },
    id: { type: 'string' },
    'top-deltas': { type: 'string', default: '20' },
    json: { type: 'boolean' },
  },
})

function parseHistory(raw) {
  const trimmed = raw.trim()
  if (trimmed.startsWith('window.BENCHMARK_DATA')) {
    const sandbox = { window: {} }
    vm.runInNewContext(trimmed, sandbox, { timeout: 1000 })
    return sandbox.window.BENCHMARK_DATA
  }
  return JSON.parse(trimmed)
}

function readHistoryFromGit() {
  for (const ref of ['origin/gh-pages', 'gh-pages']) {
    try {
      return execFileSync('git', ['show', `${ref}:${HISTORY_PATH}`], {
        encoding: 'utf8',
      })
    } catch {}
  }

  throw new Error(
    `Could not read ${HISTORY_PATH} from origin/gh-pages or gh-pages. Run: git fetch origin gh-pages`,
  )
}

const raw = values.history
  ? fs.readFileSync(values.history, 'utf8')
  : readHistoryFromGit()
const history = parseHistory(raw)
const entries = history.entries?.['Bundle Size (gzip)'] || []
const previous = new Map()
const deltas = []

for (const entry of entries) {
  for (const bench of entry.benches || []) {
    if (values.id && bench.name !== values.id) {
      continue
    }

    const prior = previous.get(bench.name)
    if (prior !== undefined && prior !== bench.value) {
      deltas.push({
        id: bench.name,
        delta: bench.value - prior,
        value: bench.value,
        sha: entry.commit?.id,
        message: String(entry.commit?.message || '').split('\n')[0],
        timestamp: entry.commit?.timestamp,
      })
    }

    previous.set(bench.name, bench.value)
  }
}

deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
const rows = deltas.slice(0, Number.parseInt(values['top-deltas'], 10))

if (values.json) {
  process.stdout.write(JSON.stringify(rows, null, 2) + '\n')
} else {
  for (const row of rows) {
    process.stdout.write(
      `${row.id} ${row.delta >= 0 ? '+' : ''}${row.delta} => ${row.value} ${row.sha?.slice(0, 12)} ${row.message}\n`,
    )
  }
}

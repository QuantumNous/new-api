#!/usr/bin/env node

import fs from 'node:fs'
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { parseArgs as parseNodeArgs } from 'node:util'
import vm from 'node:vm'

const DEFAULT_MARKER = '<!-- bundle-size-benchmark -->'
const INT_FORMAT = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})
const FIXED_2_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const PERCENT_FORMAT = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function parseArgs(argv) {
  const { values } = parseNodeArgs({
    args: argv,
    allowPositionals: false,
    strict: true,
    options: {
      current: { type: 'string' },
      baseline: { type: 'string' },
      history: { type: 'string' },
      output: { type: 'string' },
      'dashboard-url': { type: 'string' },
      'base-sha': { type: 'string' },
      marker: { type: 'string' },
      'trend-points': { type: 'string' },
    },
  })

  const args = {
    current: values.current,
    baseline: values.baseline,
    history: values.history,
    output: values.output,
    dashboardUrl: values['dashboard-url'],
    baseSha: values['base-sha'],
    marker: values.marker ?? DEFAULT_MARKER,
    trendPoints: values['trend-points']
      ? Number.parseInt(values['trend-points'], 10)
      : 12,
  }

  if (!Number.isFinite(args.trendPoints) || args.trendPoints < 2) {
    throw new Error(`Invalid trend points: ${values['trend-points']}`)
  }

  if (!args.current) {
    throw new Error('Missing required argument: --current')
  }

  if (!args.output) {
    throw new Error('Missing required argument: --output')
  }

  return args
}

function parseMaybeDataJs(raw) {
  const trimmed = raw.trim()

  if (trimmed.startsWith('window.BENCHMARK_DATA')) {
    const sandbox = { window: {} }
    vm.runInNewContext(trimmed, sandbox, { timeout: 1000 })
    return sandbox.window.BENCHMARK_DATA
  }

  return JSON.parse(trimmed)
}

function readJsonMaybeData(filePath) {
  return parseMaybeDataJs(fs.readFileSync(filePath, 'utf8'))
}

function readOptionalJsonMaybeData(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return undefined
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  if (!raw.trim()) {
    return undefined
  }

  return parseMaybeDataJs(raw)
}

function formatBytes(bytes, opts = {}) {
  const signed = opts.signed === true

  if (!Number.isFinite(bytes)) {
    return 'n/a'
  }

  const sign = signed && bytes !== 0 ? (bytes > 0 ? '+' : '-') : ''
  const absBytes = Math.abs(bytes)

  let value
  if (absBytes < 1024) {
    value = `${INT_FORMAT.format(absBytes)} B`
  } else {
    const kib = absBytes / 1024
    if (kib < 1024) {
      value = `${FIXED_2_FORMAT.format(kib)} KiB`
    } else {
      const mib = kib / 1024
      value = `${FIXED_2_FORMAT.format(mib)} MiB`
    }
  }

  return `${sign}${value}`
}

function formatDelta(current, baseline) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) {
    return 'n/a'
  }

  const delta = current - baseline
  const ratio = baseline === 0 ? 0 : Math.abs(delta / baseline)
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : ''
  return `${formatBytes(delta, { signed: true })} (${sign}${PERCENT_FORMAT.format(ratio)})`
}

function sparkline(values) {
  if (!values.length) {
    return 'n/a'
  }

  const blocks = '▁▂▃▄▅▆▇█'
  const min = Math.min(...values)
  const max = Math.max(...values)

  if (max === min) {
    return '▅'.repeat(values.length)
  }

  return values
    .map((value) => {
      const normalized = (value - min) / (max - min)
      const idx = Math.min(
        blocks.length - 1,
        Math.max(0, Math.round(normalized * (blocks.length - 1))),
      )
      return blocks[idx]
    })
    .join('')
}

function normalizeHistoryEntries(history, benchmarkName) {
  if (!history || typeof history !== 'object' || !history.entries) {
    return []
  }

  const byName = history.entries[benchmarkName]
  if (Array.isArray(byName)) {
    return byName
  }

  const firstEntry = Object.values(history.entries).find((value) =>
    Array.isArray(value),
  )
  return Array.isArray(firstEntry) ? firstEntry : []
}

function buildSeriesByScenario(historyEntries) {
  const map = new Map()

  for (const entry of historyEntries) {
    for (const bench of entry?.benches || []) {
      if (typeof bench?.name !== 'string' || !Number.isFinite(bench?.value)) {
        continue
      }

      if (!map.has(bench.name)) {
        map.set(bench.name, [])
      }

      map.get(bench.name).push(Number(bench.value))
    }
  }

  return map
}

function resolveBaselineFromHistory(historyEntries, baseSha) {
  if (!historyEntries.length) {
    return {
      source: 'none',
      benchesByName: new Map(),
    }
  }

  const baseEntry =
    (baseSha &&
      historyEntries.find(
        (entry) =>
          entry?.commit?.id === baseSha ||
          entry?.commit?.id?.startsWith(baseSha),
      )) ||
    historyEntries[historyEntries.length - 1]

  const benchesByName = new Map()
  for (const bench of baseEntry?.benches || []) {
    if (typeof bench?.name === 'string' && Number.isFinite(bench?.value)) {
      benchesByName.set(bench.name, Number(bench.value))
    }
  }

  const commitId = baseEntry?.commit?.id || 'unknown'

  return {
    source: `history:${commitId.slice(0, 12)}`,
    benchesByName,
  }
}

function resolveBaselineFromCurrentJson(currentJson) {
  const benchesByName = new Map()
  for (const metric of currentJson?.metrics || []) {
    if (typeof metric?.id === 'string' && Number.isFinite(metric?.gzipBytes)) {
      benchesByName.set(metric.id, Number(metric.gzipBytes))
    }
  }

  const sourceSha =
    typeof currentJson?.sha === 'string' ? currentJson.sha : 'unknown'

  return {
    source: `current:${sourceSha.slice(0, 12)}`,
    benchesByName,
  }
}

function formatShortSha(value) {
  if (!value || typeof value !== 'string') {
    return 'unknown'
  }

  return value.slice(0, 12)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const currentPath = path.resolve(args.current)
  const outputPath = path.resolve(args.output)
  const baselinePath = args.baseline ? path.resolve(args.baseline) : undefined
  const historyPath = args.history ? path.resolve(args.history) : undefined

  const current = readJsonMaybeData(currentPath)
  const history = readOptionalJsonMaybeData(historyPath)
  const baselineCurrent = readOptionalJsonMaybeData(baselinePath)

  const historyEntries = normalizeHistoryEntries(history, current.benchmarkName)
  const seriesByScenario = buildSeriesByScenario(historyEntries)

  const baseline =
    baselineCurrent != null
      ? resolveBaselineFromCurrentJson(baselineCurrent)
      : resolveBaselineFromHistory(historyEntries, args.baseSha)

  const rows = []

  for (const metric of current.metrics || []) {
    const baselineValue = baseline.benchesByName.get(metric.id)
    const historySeries = (seriesByScenario.get(metric.id) || []).slice(
      // Reserve one slot for the current metric so the sparkline stays at trendPoints.
      -args.trendPoints + 1,
    )

    if (
      !historySeries.length ||
      historySeries[historySeries.length - 1] !== metric.gzipBytes
    ) {
      historySeries.push(metric.gzipBytes)
    }

    rows.push({
      id: metric.id,
      current: metric.gzipBytes,
      raw: metric.rawBytes,
      brotli: metric.brotliBytes,
      initial: metric.initialGzipBytes,
      deltaCell: formatDelta(metric.gzipBytes, baselineValue),
      trendCell: sparkline(historySeries.slice(-args.trendPoints)),
    })
  }

  const lines = []
  lines.push(args.marker)
  lines.push('## Bundle Size Benchmarks')
  lines.push('')
  lines.push(`- Commit: \`${formatShortSha(current.sha)}\``)
  lines.push(
    `- Measured at: \`${current.measuredAt || current.generatedAt || 'unknown'}\``,
  )
  lines.push(`- Baseline source: \`${baseline.source}\``)
  if (args.dashboardUrl) {
    lines.push(`- Dashboard: [bundle-size history](${args.dashboardUrl})`)
  }
  lines.push('')
  lines.push(
    '| Scenario | Current (gzip) | Delta vs baseline | Initial gzip | Raw | Brotli | Trend |',
  )
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | --- |')

  for (const row of rows) {
    lines.push(
      `| \`${row.id}\` | ${formatBytes(row.current)} | ${row.deltaCell} | ${formatBytes(row.initial)} | ${formatBytes(row.raw)} | ${formatBytes(row.brotli)} | ${row.trendCell} |`,
    )
  }

  lines.push('')
  lines.push(
    '_Current gzip tracks all emitted client JS chunks. Initial gzip tracks only the entry/import graph. Trend sparkline is historical current gzip ending with this PR measurement; lower is better._',
  )

  const markdown = lines.join('\n') + '\n'
  await fsp.mkdir(path.dirname(outputPath), { recursive: true })
  await fsp.writeFile(outputPath, markdown, 'utf8')

  process.stdout.write(`Wrote PR benchmark report: ${outputPath}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

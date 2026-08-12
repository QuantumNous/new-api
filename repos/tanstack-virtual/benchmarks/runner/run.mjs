// Reproducible cross-library benchmark runner.
// Usage:
//   pnpm bench            # headless
//   pnpm bench:headed     # with browser window for debugging
//   pnpm bench -- --runs 5 --libs tanstack,virtua  # subset

import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const BENCH_DIR = path.resolve(__dirname, '..')
const PORT = 4173
const BASE = `http://localhost:${PORT}`

const ALL_LIBS = ['tanstack', 'virtua', 'virtuoso', 'window']
const ALL_SCENARIOS = [
  'mount-fixed-1k',
  'mount-fixed-10k',
  'mount-fixed-100k',
  'mount-dynamic-1k',
  'mount-dynamic-10k',
  'scroll-to-bottom-10k',
  'fast-scroll-dynamic-10k',
  'jump-to-end-dynamic-10k',
  'jump-to-middle-accuracy-dynamic-10k',
  'jump-to-last-accuracy-dynamic-10k',
  'jump-while-measuring-accuracy-dynamic-10k',
  'jump-wide-variance-accuracy-10k',
]

function parseArgs() {
  const args = process.argv.slice(2)
  const out = {
    headed: false,
    runs: 3,
    libs: ALL_LIBS,
    scenarios: ALL_SCENARIOS,
    useDev: false,
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--headed') out.headed = true
    else if (a === '--runs') out.runs = Number(args[++i])
    else if (a === '--libs') out.libs = args[++i].split(',')
    else if (a === '--scenarios') out.scenarios = args[++i].split(',')
    else if (a === '--dev') out.useDev = true
  }
  return out
}

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url)
      if (r.ok) return true
    } catch {}
    await sleep(200)
  }
  throw new Error(`server never came up at ${url}`)
}

function spawnDevServer(useDev = false) {
  const child = spawn('pnpm', [useDev ? 'dev' : 'preview'], {
    cwd: BENCH_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout?.on('data', (d) =>
    process.stderr.write(`[server] ${d.toString()}`),
  )
  child.stderr?.on('data', (d) =>
    process.stderr.write(`[server-err] ${d.toString()}`),
  )
  return child
}

async function runScenario(page, lib, scenarioId) {
  const url = `${BASE}/?lib=${lib}&scenario=${scenarioId}`
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  // Wait until the harness reports ready (means React mounted and registered).
  await page.waitForFunction(() => !!window.bench?.ready?.(), null, {
    timeout: 15_000,
  })
  // Pull the scenario object back from the page so we run with the exact same
  // shape the page is using. We read from window.bench.scenarios (populated
  // at mount) rather than a runtime `import('/src/scenarios/types.ts')`,
  // since `vite preview` only serves the built dist, not source files.
  const result = await page.evaluate(async (id) => {
    const scenario = window.bench?.scenarios.find((s) => s.id === id)
    if (!scenario) throw new Error('unknown scenario: ' + id)
    // Force GC where supported so memory readings aren't poisoned by previous run.
    if ('gc' in globalThis) {
      try {
        globalThis.gc()
      } catch {}
    }
    const metrics = await window.bench.run(scenario)
    return { scenario, metrics }
  }, scenarioId)
  return result
}

function fmt(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return '—'
  if (Math.abs(n) >= 1000)
    return n.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })
  return n.toFixed(digits)
}

function median(xs) {
  const ys = xs
    .filter((x) => x != null && !Number.isNaN(x))
    .sort((a, b) => a - b)
  if (ys.length === 0) return null
  const mid = Math.floor(ys.length / 2)
  return ys.length % 2 ? ys[mid] : (ys[mid - 1] + ys[mid]) / 2
}

function p95(xs) {
  const ys = xs
    .filter((x) => x != null && !Number.isNaN(x))
    .sort((a, b) => a - b)
  if (ys.length === 0) return null
  return ys[Math.min(ys.length - 1, Math.floor(ys.length * 0.95))]
}

function makeTable(results, libs, scenarios) {
  // For each (lib, scenario) we have N runs; pick median for table.
  const cell = (lib, scenarioId, key) => {
    const runs = results
      .filter((r) => r.library === lib && r.scenario.id === scenarioId)
      .map((r) => r.metrics[key])
    return median(runs)
  }

  const sections = [
    {
      title: 'Mount time — React.render → commit (lower is better, ms)',
      key: 'mountMs',
      scenarios: [
        'mount-fixed-1k',
        'mount-fixed-10k',
        'mount-fixed-100k',
        'mount-dynamic-1k',
        'mount-dynamic-10k',
      ],
    },
    {
      title:
        'Dynamic measurement — commit → stable total size (lower is better, ms)',
      key: 'actionMs',
      scenarios: ['mount-dynamic-1k', 'mount-dynamic-10k'],
    },
    {
      title: 'First paint (lower is better, ms)',
      key: 'firstPaintMs',
      scenarios: ['mount-fixed-1k', 'mount-fixed-10k', 'mount-fixed-100k'],
    },
    {
      title: 'Scroll perf — fps (higher is better)',
      key: 'scrollFps',
      scenarios: ['scroll-to-bottom-10k', 'fast-scroll-dynamic-10k'],
    },
    {
      title: 'Scroll jank — long frames count (lower is better)',
      key: 'longFrames',
      scenarios: ['scroll-to-bottom-10k', 'fast-scroll-dynamic-10k'],
    },
    {
      title: 'Jump-to-end settle time (lower is better, ms)',
      key: 'actionMs',
      scenarios: ['jump-to-end-dynamic-10k'],
    },
    {
      title:
        'scrollToIndex landing accuracy — px offset from target (lower is better)',
      key: 'landingErrorPx',
      scenarios: [
        'jump-to-middle-accuracy-dynamic-10k',
        'jump-to-last-accuracy-dynamic-10k',
        'jump-while-measuring-accuracy-dynamic-10k',
        'jump-wide-variance-accuracy-10k',
      ],
    },
    {
      title: 'Memory after mount (lower is better, MB)',
      key: 'memoryBytes',
      scenarios: ['mount-fixed-10k', 'mount-fixed-100k', 'mount-dynamic-10k'],
    },
  ]

  const lines = []
  for (const sec of sections) {
    lines.push(`\n### ${sec.title}\n`)
    lines.push(`| Scenario | ${libs.map((l) => l).join(' | ')} |`)
    lines.push(`|---|${libs.map(() => '---:').join('|')}|`)
    for (const s of sec.scenarios) {
      const cells = libs.map((l) => {
        const v = cell(l, s, sec.key)
        if (v == null) return '—'
        if (sec.key === 'memoryBytes') return fmt(v / 1024 / 1024)
        if (sec.key === 'scrollFps') return fmt(v)
        return fmt(v)
      })
      lines.push(`| \`${s}\` | ${cells.join(' | ')} |`)
    }
  }
  return lines.join('\n')
}

async function main() {
  const opts = parseArgs()
  console.error(`config: ${JSON.stringify(opts)}`)

  if (!opts.useDev) {
    // Build the app once for the preview server (production code paths).
    await new Promise((resolve, reject) => {
      const c = spawn('pnpm', ['build'], { cwd: BENCH_DIR, stdio: 'inherit' })
      c.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error('build failed')),
      )
    })
  }

  let server = null
  // If a server is already listening on PORT, skip starting one.
  let needsServer = true
  try {
    const r = await fetch(BASE)
    if (r.ok) needsServer = false
  } catch {}
  if (needsServer) {
    server = spawnDevServer(opts.useDev)
  } else {
    console.error('using already-running server at ' + BASE)
  }
  try {
    await waitForServer(BASE)
    const browser = await chromium.launch({
      headless: !opts.headed,
      args: [
        // Precise memory reporting (otherwise bucketed to ~10MB granularity).
        '--enable-precise-memory-info',
        '--js-flags=--expose-gc',
        // Disable network throttling and other interference.
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
      ],
    })
    const context = await browser.newContext({
      viewport: { width: 800, height: 700 },
    })
    const page = await context.newPage()

    const results = []
    for (const lib of opts.libs) {
      for (const scenarioId of opts.scenarios) {
        for (let r = 0; r < opts.runs; r++) {
          process.stderr.write(
            `\n  ${lib.padEnd(9)} ${scenarioId.padEnd(28)} run ${r + 1}/${opts.runs} ... `,
          )
          try {
            const { scenario, metrics } = await runScenario(
              page,
              lib,
              scenarioId,
            )
            results.push({
              library: lib,
              scenario,
              metrics,
              ranAt: new Date().toISOString(),
            })
            process.stderr.write(
              `mount=${fmt(metrics.mountMs)}ms action=${fmt(metrics.actionMs)}ms`,
            )
          } catch (e) {
            process.stderr.write(`ERROR: ${e.message}`)
            results.push({
              library: lib,
              scenario: { id: scenarioId },
              metrics: {
                mountMs: NaN,
                firstPaintMs: NaN,
                actionMs: NaN,
                scrollFps: null,
                longFrames: null,
                jankMs: null,
                memoryBytes: null,
                landingErrorPx: null,
              },
              ranAt: new Date().toISOString(),
              notes: 'error: ' + e.message,
            })
          }
        }
      }
    }

    await browser.close()

    mkdirSync(path.join(BENCH_DIR, 'results'), { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    writeFileSync(
      path.join(BENCH_DIR, 'results', `${stamp}.json`),
      JSON.stringify({ opts, results }, null, 2),
    )

    const md = makeTable(results, opts.libs, opts.scenarios)
    console.log(`# Virtualization benchmarks — ${new Date().toISOString()}\n`)
    console.log(`runs per cell: ${opts.runs} (table shows medians)\n`)
    console.log(`libraries: ${opts.libs.join(', ')}\n`)
    console.log(md)

    writeFileSync(
      path.join(BENCH_DIR, 'results', 'LATEST.md'),
      `# Virtualization benchmarks — ${new Date().toISOString()}\n\nruns per cell: ${opts.runs}\n${md}\n`,
    )
  } finally {
    server?.kill('SIGTERM')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

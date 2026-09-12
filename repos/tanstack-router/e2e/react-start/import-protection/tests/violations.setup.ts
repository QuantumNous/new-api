import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { chromium } from '@playwright/test'
import { getTestServerPort } from '@tanstack/router-e2e-utils'
import packageJson from '../package.json' with { type: 'json' }

import { extractViolationsFromLog } from './violations.utils'
import type { FullConfig } from '@playwright/test'
import type { Violation } from './violations.utils'

const toolchain = process.env.E2E_TOOLCHAIN ?? 'vite'
const viteBundledDev = process.env.E2E_VITE_BUNDLED_DEV === 'true'
const e2ePortKey =
  process.env.E2E_PORT_KEY ??
  `${packageJson.name}-${toolchain}${viteBundledDev ? '-bundled-dev' : ''}`

async function waitForHttpOk(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now()

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${url}`)
    }

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(1000),
      })
      if (res.ok) return
    } catch {
      // ignore
    }

    await new Promise((r) => setTimeout(r, 200))
  }
}

function startDevServer(cwd: string, port: number): ReturnType<typeof spawn> {
  const toolchain = process.env.E2E_TOOLCHAIN ?? 'vite'
  const command =
    toolchain === 'rsbuild'
      ? ['exec', 'rsbuild', 'dev', '--port', String(port)]
      : ['exec', 'vite', 'dev', '--port', String(port)]

  return spawn('pnpm', command, {
    cwd,
    env: {
      ...process.env,
      PORT: String(port),
      VITE_SERVER_PORT: String(port),
      VITE_NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

async function killChild(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null || child.killed) return
  await new Promise<void>((resolve) => {
    let resolved = false
    const done = () => {
      if (resolved) return
      resolved = true
      resolve()
    }
    child.once('exit', done)
    child.once('error', done)
    try {
      child.kill('SIGTERM')
    } catch {
      done()
      return
    }
    setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        // ignore
      }
      // Resolve after a grace period even if 'exit' never fires.
      setTimeout(done, 500)
    }, 3000)
  })
}

type ViolationExpectation = (violations: Array<Violation>) => boolean

type RouteDefinition = readonly [
  route: string,
  testId: string,
  expectedViolation?: ViolationExpectation,
]

function hasClientSecretServerFileViolation(
  importerFragment: string,
): ViolationExpectation {
  return (violations) =>
    violations.some(
      (v) =>
        v.envType === 'client' &&
        v.type === 'file' &&
        v.importer.includes(importerFragment) &&
        (v.specifier.includes('secret.server') ||
          v.resolved?.includes('secret.server')),
    )
}

const routeDefinitions: Array<RouteDefinition> = [
  ['/', 'heading', hasClientSecretServerFileViolation('edge-a')],
  ['/leaky-server-import', 'leaky-heading'],
  ['/client-only-violations', 'client-only-heading'],
  ['/client-only-jsx', 'client-only-jsx-heading'],
  ['/beforeload-leak', 'beforeload-leak-heading'],
  [
    '/component-server-leak',
    'component-leak-heading',
    hasClientSecretServerFileViolation('component-server-leak'),
  ],
  [
    '/alias-path-leak',
    'alias-path-leak-heading',
    hasClientSecretServerFileViolation('alias-path-leak'),
  ],
  [
    '/alias-path-namespace-leak',
    'alias-path-namespace-leak-heading',
    hasClientSecretServerFileViolation('alias-path-namespace-leak'),
  ],
  [
    '/non-alias-namespace-leak',
    'non-alias-namespace-leak-heading',
    hasClientSecretServerFileViolation('non-alias-namespace-leak'),
  ],
  ['/barrel-false-positive', 'barrel-heading'],
  ['/type-only-protected-import', 'type-only-protected-import-heading'],
]

const outputPollMs = 250
const outputIdleMs = viteBundledDev ? 750 : 350
const outputTimeoutMs = viteBundledDev ? 10_000 : 3_000

async function waitForOutput(
  getLogText: () => string,
  expectedViolation?: ViolationExpectation,
): Promise<void> {
  const start = Date.now()
  let lastLength = getLogText().length
  let lastChange = Date.now()

  while (Date.now() - start < outputTimeoutMs) {
    const text = getLogText()
    if (expectedViolation?.(extractViolationsFromLog(text))) {
      return
    }

    if (text.length !== lastLength) {
      lastLength = text.length
      lastChange = Date.now()
    } else if (!expectedViolation && Date.now() - lastChange >= outputIdleMs) {
      return
    }

    await new Promise((r) => setTimeout(r, outputPollMs))
  }
}

async function navigateAllRoutes(
  baseURL: string,
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  getLogText: () => string,
): Promise<void> {
  const context = await browser.newContext()
  const page = await context.newPage()

  for (const [route, testId, expectedViolation] of routeDefinitions) {
    try {
      // Prefer 'networkidle' (ensures route chunks are actually fetched), but
      // fall back if it hangs in certain CI environments.
      try {
        await page.goto(`${baseURL}${route}`, {
          waitUntil: 'networkidle',
          timeout: 15_000,
        })
      } catch {
        await page.goto(`${baseURL}${route}`, {
          waitUntil: 'load',
          timeout: 30_000,
        })
      }

      await page.getByTestId(testId).waitFor({ timeout: 10_000 })
    } catch {
      // ignore navigation errors — we only care about server logs
    } finally {
      // Poll the captured logs so delayed bundled-dev warnings can flush
      // without sleeping longer than necessary on every route.
      await waitForOutput(getLogText, expectedViolation)
    }
  }

  await context.close()
}

/**
 * Starts a dev server, navigates all routes, captures violations.
 * Returns the extracted violations array.
 */
async function runDevPass(
  cwd: string,
  port: number,
): Promise<Array<Violation>> {
  const baseURL = `http://localhost:${port}`
  const logChunks: Array<string> = []
  const child = startDevServer(cwd, port)

  child.stdout?.on('data', (d: Buffer) => logChunks.push(d.toString()))
  child.stderr?.on('data', (d: Buffer) => logChunks.push(d.toString()))

  try {
    await waitForHttpOk(baseURL, 30_000)

    const browser = await chromium.launch()
    try {
      await navigateAllRoutes(baseURL, browser, () => logChunks.join(''))
    } finally {
      await browser.close()
    }

    await waitForOutput(() => logChunks.join(''))
  } finally {
    await killChild(child)
  }

  const text = logChunks.join('')
  return extractViolationsFromLog(text)
}

/**
 * Captures dev violations in two passes:
 *   1. Cold — fresh dev server, Vite compiles all modules from scratch.
 *   2. Warm — restart dev server (Vite's .vite cache persists on disk),
 *      modules are pre-transformed so resolveId/transform paths differ.
 */
async function captureDevViolations(cwd: string): Promise<void> {
  const coldViolations = await runDevPass(
    cwd,
    await getTestServerPort(`${e2ePortKey}-violations-cold`),
  )

  fs.writeFileSync(
    path.resolve(cwd, 'violations.dev.json'),
    JSON.stringify(coldViolations, null, 2),
  )
  fs.writeFileSync(
    path.resolve(cwd, 'violations.dev.cold.json'),
    JSON.stringify(coldViolations, null, 2),
  )

  // Warm pass: the .vite cache from the cold run is still on disk.
  const warmViolations = await runDevPass(
    cwd,
    await getTestServerPort(`${e2ePortKey}-violations-warm`),
  )

  fs.writeFileSync(
    path.resolve(cwd, 'violations.dev.warm.json'),
    JSON.stringify(warmViolations, null, 2),
  )
}

export default async function globalSetup(config: FullConfig) {
  void config
  // This file lives in ./tests; fixture root is one directory up.
  const cwd = path.resolve(import.meta.dirname, '..')

  // webServer.command writes build output to this file.
  const logFile = path.resolve(cwd, 'webserver-build.log')

  if (!fs.existsSync(logFile)) {
    // If the log doesn't exist, leave an empty violations file.
    fs.writeFileSync(path.resolve(cwd, 'violations.build.json'), '[]')
    return
  }

  const text = fs.readFileSync(logFile, 'utf-8')
  const violations = extractViolationsFromLog(text)
  fs.writeFileSync(
    path.resolve(cwd, 'violations.build.json'),
    JSON.stringify(violations, null, 2),
  )

  await captureDevViolations(cwd)
}

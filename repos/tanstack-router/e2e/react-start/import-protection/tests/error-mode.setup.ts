import fs from 'node:fs'
import path from 'node:path'
import { execSync, spawn } from 'node:child_process'
import { chromium } from '@playwright/test'
import { getTestServerPort } from '@tanstack/router-e2e-utils'
import packageJson from '../package.json' with { type: 'json' }
import type { FullConfig } from '@playwright/test'

/**
 * Global setup for error-mode E2E tests.
 *
 * 1. Runs `BEHAVIOR=error pnpm build` — expected to fail because the plugin
 *    calls `this.error()` on the first violation, aborting the Rollup build.
 *    Output is written to `error-build-result.json`.
 *
 * 2. Starts a dev server with `BEHAVIOR=error`, navigates all violation
 *    routes, then captures the server log.  In dev mode `this.error()` causes
 *    a module-level 500 (the server stays up).  Output is written to
 *    `error-dev-result.json`.
 */

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
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) })
      if (res.ok) return
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 200))
  }
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
      setTimeout(done, 500)
    }, 3000)
  })
}

function captureBuild(cwd: string): void {
  const buildCommand =
    toolchain === 'rsbuild' ? 'pnpm build:rsbuild' : 'pnpm build:vite'
  const outFile = path.resolve(cwd, 'error-build-result.json')
  for (const f of ['error-build-result.json', 'error-build.log']) {
    const p = path.resolve(cwd, f)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }

  let stdout = ''
  let stderr = ''
  let exitCode = 0

  try {
    const output = execSync(buildCommand, {
      cwd,
      env: { ...process.env, BEHAVIOR: 'error' },
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    })
    stdout = output
  } catch (err: any) {
    exitCode = err.status ?? 1
    stdout = err.stdout ?? ''
    stderr = err.stderr ?? ''
  }

  const combined = `${stdout}\n${stderr}`
  fs.writeFileSync(path.resolve(cwd, 'error-build.log'), combined)
  fs.writeFileSync(
    outFile,
    JSON.stringify({ exitCode, stdout, stderr, combined }, null, 2),
  )
}

const routes = [
  '/',
  '/leaky-server-import',
  '/client-only-violations',
  '/client-only-jsx',
  '/beforeload-leak',
  '/barrel-false-positive',
]

async function captureDev(cwd: string): Promise<void> {
  const outFile = path.resolve(cwd, 'error-dev-result.json')
  for (const f of ['error-dev-result.json', 'error-dev.log']) {
    const p = path.resolve(cwd, f)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }

  const port = await getTestServerPort(`${e2ePortKey}-error-dev`)
  const baseURL = `http://localhost:${port}`
  const logFile = path.resolve(cwd, 'error-dev.log')

  const out = fs.createWriteStream(logFile)
  const toolchain = process.env.E2E_TOOLCHAIN ?? 'vite'
  const command =
    toolchain === 'rsbuild'
      ? ['exec', 'rsbuild', 'dev', '--port', String(port)]
      : ['exec', 'vite', 'dev', '--port', String(port)]

  const child = spawn('pnpm', command, {
    cwd,
    env: {
      ...process.env,
      BEHAVIOR: 'error',
      PORT: String(port),
      VITE_SERVER_PORT: String(port),
      VITE_NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout?.on('data', (d: Buffer) => out.write(d))
  child.stderr?.on('data', (d: Buffer) => out.write(d))

  try {
    await waitForHttpOk(baseURL, 30_000)

    const browser = await chromium.launch()
    try {
      const context = await browser.newContext()
      const page = await context.newPage()
      for (const route of routes) {
        try {
          await page.goto(`${baseURL}${route}`, {
            // Vite dev keeps long-lived connections; 'networkidle' can hang.
            waitUntil: 'load',
            timeout: 30_000,
          })
        } catch {
          // expected — modules fail with 500 in error mode
        }
      }
      await context.close()
    } finally {
      await browser.close()
    }

    await new Promise((r) => setTimeout(r, 750))
  } finally {
    await killChild(child)
    await new Promise<void>((resolve) => out.end(resolve))
  }

  const combined = fs.existsSync(logFile)
    ? fs.readFileSync(logFile, 'utf-8')
    : ''
  fs.writeFileSync(outFile, JSON.stringify({ combined }, null, 2))
}

export default async function globalSetup(config: FullConfig) {
  void config
  const cwd = path.resolve(import.meta.dirname, '..')

  captureBuild(cwd)
  await captureDev(cwd)
}

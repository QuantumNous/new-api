import fs from 'node:fs'
import path from 'node:path'
import { execSync, spawn } from 'node:child_process'
import { chromium } from '@playwright/test'
import { getTestServerPort } from '@tanstack/router-e2e-utils'
import packageJson from '../package.json' with { type: 'json' }
import type { FullConfig } from '@playwright/test'

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
  const outFile = path.resolve(cwd, 'error-build-result.json')
  for (const f of ['error-build-result.json', 'error-build.log']) {
    const p = path.resolve(cwd, f)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }

  let stdout = ''
  let stderr = ''
  let exitCode = 0

  try {
    const output = execSync('pnpm build', {
      cwd,
      env: { ...process.env, BEHAVIOR: 'error' },
      timeout: 120_000,
      maxBuffer: 50 * 1024 * 1024,
    })
    stdout = output.toString()
  } catch (err: any) {
    exitCode = err.status ?? 1
    stdout = err.stdout?.toString() ?? ''
    stderr = err.stderr?.toString() ?? ''
  }

  const combined = stdout + '\n' + stderr
  fs.writeFileSync(
    outFile,
    JSON.stringify({ exitCode, stdout, stderr, combined }, null, 2),
  )
}

async function captureDevErrors(cwd: string): Promise<void> {
  const port = await getTestServerPort(`${packageJson.name}_error_dev`)
  const baseURL = `http://localhost:${port}`
  const logChunks: Array<string> = []

  const child = spawn('pnpm', ['exec', 'vite', 'dev', '--port', String(port)], {
    cwd,
    env: {
      ...process.env,
      PORT: String(port),
      VITE_SERVER_PORT: String(port),
      BEHAVIOR: 'error',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout?.on('data', (d: Buffer) => logChunks.push(d.toString()))
  child.stderr?.on('data', (d: Buffer) => logChunks.push(d.toString()))

  try {
    await waitForHttpOk(baseURL, 30_000)

    const browser = await chromium.launch()
    try {
      const context = await browser.newContext()
      const page = await context.newPage()
      for (const route of ['/', '/backend-leak', '/frontend-leak']) {
        try {
          await page.goto(`${baseURL}${route}`, {
            waitUntil: 'load',
            timeout: 15_000,
          })
        } catch {
          // ignore
        }
        await new Promise((r) => setTimeout(r, 750))
      }
      await context.close()
    } finally {
      await browser.close()
    }

    await new Promise((r) => setTimeout(r, 750))
  } finally {
    await killChild(child)
  }

  const combined = logChunks.join('')
  fs.writeFileSync(
    path.resolve(cwd, 'error-dev-result.json'),
    JSON.stringify(
      { exitCode: 0, stdout: combined, stderr: '', combined },
      null,
      2,
    ),
  )
}

export default async function globalSetup(config: FullConfig) {
  void config
  const cwd = path.resolve(import.meta.dirname, '..')

  captureBuild(cwd)
  await captureDevErrors(cwd)
}

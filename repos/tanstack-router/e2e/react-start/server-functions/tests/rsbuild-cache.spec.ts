import { spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import type { ChildProcess } from 'node:child_process'
import type { Page, Request } from '@playwright/test'

const appDir = resolve(import.meta.dirname, '..')
const cacheDir = resolve(appDir, 'node_modules/.cache/rspack')
const consistentRoutePath = resolve(appDir, 'src/routes/consistent.tsx')
const noServerFunctionsConsistentRouteSource = `import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/consistent')({
  component: ConsistentServerFnCalls,
})

function ConsistentServerFnCalls() {
  return (
    <div data-testid="watch-no-server-functions">
      Server functions removed by watch test
    </div>
  )
}
`

interface ServerFnRequest {
  method: string
  url: string
}

interface DevServer {
  child: ChildProcess
  logs: Array<string>
  port: number
}

let navigationId = 0

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function getAvailablePort(): Promise<number> {
  return await new Promise((resolvePromise, reject) => {
    const server = createServer()

    server.unref()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()

      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Could not allocate a port')))
        return
      }

      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolvePromise(port)
      })
    })
  })
}

async function canListen(port: number): Promise<boolean> {
  return await new Promise((resolvePromise) => {
    const server = createServer()

    const finish = (value: boolean) => {
      server.removeAllListeners()
      resolvePromise(value)
    }

    server.unref()
    server.once('error', () => finish(false))
    server.listen(port, '127.0.0.1', () => {
      server.close((error) => finish(!error))
    })
  })
}

async function waitForPortAvailable(port: number): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < 10_000) {
    if (await canListen(port)) {
      return
    }

    await delay(100)
  }

  throw new Error(`Timed out waiting for port ${port} to be released`)
}

function startRsbuildDevServer(
  port: number,
  buildCacheEnabled = true,
): DevServer {
  const logs: Array<string> = []
  const child = spawn(
    'pnpm',
    ['exec', 'rsbuild', 'dev', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: appDir,
      detached: true,
      env: {
        ...process.env,
        PORT: String(port),
        VITE_SERVER_PORT: String(port),
        VITE_NODE_ENV: 'test',
        E2E_RSBUILD_BUILD_CACHE: buildCacheEnabled ? 'true' : 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  child.stdout?.on('data', (chunk: Buffer) => logs.push(chunk.toString()))
  child.stderr?.on('data', (chunk: Buffer) => logs.push(chunk.toString()))

  return { child, logs, port }
}

function killDevServer(devServer: DevServer, signal: NodeJS.Signals) {
  const pid = devServer.child.pid

  try {
    if (pid) {
      process.kill(-pid, signal)
      return
    }
  } catch {
    // Fall back to killing the direct child below.
  }

  devServer.child.kill(signal)
}

async function waitForHttpOk(devServer: DevServer, url: string): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < 60_000) {
    if (devServer.child.exitCode !== null) {
      throw new Error(
        `Rsbuild dev server exited before ${url} was ready.\n${devServer.logs.join('')}`,
      )
    }

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(1000),
      })

      if (response.status >= 200 && response.status < 400) {
        return
      }
    } catch {
      // Wait until the dev server starts accepting requests.
    }

    await delay(250)
  }

  throw new Error(
    `Timed out waiting for Rsbuild dev server at ${url}.\n${devServer.logs.join('')}`,
  )
}

async function stopDevServer(devServer: DevServer): Promise<void> {
  if (devServer.child.exitCode !== null || devServer.child.killed) {
    return
  }

  await new Promise<void>((resolve) => {
    let settled = false
    let killTimer: ReturnType<typeof setTimeout> | undefined
    let doneTimer: ReturnType<typeof setTimeout> | undefined

    const done = () => {
      if (settled) {
        return
      }
      settled = true
      if (killTimer) {
        clearTimeout(killTimer)
      }
      if (doneTimer) {
        clearTimeout(doneTimer)
      }
      resolve()
    }

    devServer.child.once('exit', done)
    devServer.child.once('error', done)

    try {
      killDevServer(devServer, 'SIGTERM')
    } catch {
      done()
      return
    }

    killTimer = setTimeout(() => {
      try {
        killDevServer(devServer, 'SIGKILL')
      } catch {
        // The process may have already exited.
      }

      doneTimer = setTimeout(done, 500)
    }, 3000)
  })

  await waitForPortAvailable(devServer.port)
}

async function waitForRetry<T>(
  devServer: DevServer,
  description: string,
  action: () => Promise<T>,
): Promise<T> {
  const start = Date.now()
  let lastError: unknown

  while (Date.now() - start < 30_000) {
    if (devServer.child.exitCode !== null) {
      throw new Error(
        `Rsbuild dev server exited while waiting for ${description}.\n${devServer.logs.join('')}`,
      )
    }

    try {
      return await action()
    } catch (error) {
      lastError = error
      await delay(500)
    }
  }

  throw new Error(
    `Timed out waiting for ${description}.\n${lastError instanceof Error ? lastError.stack || lastError.message : String(lastError)}\n\nRsbuild logs:\n${devServer.logs.join('')}`,
  )
}

async function captureServerFnRequests(
  page: Page,
  action: () => Promise<void>,
): Promise<Array<ServerFnRequest>> {
  const requests: Array<ServerFnRequest> = []
  const listener = (request: Request) => {
    if (request.url().includes('/_serverFn/')) {
      requests.push({
        method: request.method(),
        url: request.url(),
      })
    }
  }

  page.on('request', listener)
  try {
    await action()
  } finally {
    page.off('request', listener)
  }

  return requests
}

async function exerciseServerFunctions(
  page: Page,
  baseURL: string,
  expectedUsername = 'TEST',
) {
  const response = await page.goto(
    `${baseURL}/consistent?testRun=${navigationId++}`,
    {
      waitUntil: 'networkidle',
    },
  )
  expect(response?.ok()).toBe(true)

  const expectedLocator = page.getByTestId(
    'expected-consistent-server-fns-result',
  )
  await expect(expectedLocator).toContainText(
    JSON.stringify({ payload: { username: expectedUsername } }),
  )
  const expected = (await expectedLocator.textContent()) || ''

  await expect(page.getByTestId('consistent-client-hydrated')).toBeAttached()

  await page.getByTestId('test-consistent-server-fn-calls-btn').click()
  await page.waitForLoadState('networkidle')

  await expect(page.getByTestId('cons_serverGetFn1-response')).toContainText(
    expected,
  )
  await expect(page.getByTestId('cons_getFn1-response')).toContainText(expected)
  await expect(page.getByTestId('cons_serverPostFn1-response')).toContainText(
    expected,
  )
  await expect(page.getByTestId('cons_postFn1-response')).toContainText(
    expected,
  )
}

async function exerciseServerFunctionsWithLogs(
  page: Page,
  baseURL: string,
  devServer: DevServer,
  expectedUsername = 'TEST',
) {
  try {
    await exerciseServerFunctions(page, baseURL, expectedUsername)
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.stack || error.message : String(error)}\n\nRsbuild logs:\n${devServer.logs.join('')}`,
    )
  }
}

async function waitForStaticConsistentRoute(
  page: Page,
  baseURL: string,
  devServer: DevServer,
) {
  await waitForRetry(devServer, 'static consistent route update', async () => {
    const response = await page.goto(
      `${baseURL}/consistent?watch=${Date.now()}`,
      {
        waitUntil: 'networkidle',
      },
    )
    expect(response?.ok()).toBe(true)
    await expect(page.getByTestId('watch-no-server-functions')).toContainText(
      'Server functions removed by watch test',
      { timeout: 1000 },
    )
  })
}

test('rsbuild build cache warm restart keeps server function registry', async ({
  page,
}) => {
  test.setTimeout(120_000)

  rmSync(cacheDir, { recursive: true, force: true })

  const port = await getAvailablePort()
  const baseURL = `http://127.0.0.1:${port}`
  let devServer = startRsbuildDevServer(port)

  try {
    await waitForHttpOk(devServer, baseURL)
    await exerciseServerFunctionsWithLogs(page, baseURL, devServer)
  } finally {
    await stopDevServer(devServer)
  }

  expect(existsSync(cacheDir)).toBe(true)

  devServer = startRsbuildDevServer(port)

  try {
    await waitForHttpOk(devServer, baseURL)
    await exerciseServerFunctionsWithLogs(page, baseURL, devServer)

    expect(devServer.logs.join('')).not.toContain(
      'Server function info not found',
    )
  } finally {
    await stopDevServer(devServer)
  }
})

test('rsbuild without build cache keeps server function registry', async ({
  page,
}) => {
  test.setTimeout(120_000)

  rmSync(cacheDir, { recursive: true, force: true })

  const port = await getAvailablePort()
  const baseURL = `http://127.0.0.1:${port}`
  const devServer = startRsbuildDevServer(port, false)

  try {
    await waitForHttpOk(devServer, baseURL)
    await exerciseServerFunctionsWithLogs(page, baseURL, devServer)

    expect(devServer.logs.join('')).not.toContain(
      'Server function info not found',
    )
  } finally {
    await stopDevServer(devServer)
  }
})

test('rsbuild watch updates and removes server function metadata', async ({
  page,
}) => {
  test.setTimeout(120_000)

  const originalSource = readFileSync(consistentRoutePath, 'utf8')
  const updatedSource = originalSource.replaceAll("'TEST'", "'WATCH'")
  rmSync(cacheDir, { recursive: true, force: true })

  const port = await getAvailablePort()
  const baseURL = `http://127.0.0.1:${port}`
  const devServer = startRsbuildDevServer(port)

  try {
    await waitForHttpOk(devServer, baseURL)
    await exerciseServerFunctionsWithLogs(page, baseURL, devServer)

    writeFileSync(consistentRoutePath, updatedSource)
    const serverFnRequests = await waitForRetry(
      devServer,
      'updated server function metadata',
      async () => {
        return await captureServerFnRequests(page, async () => {
          await exerciseServerFunctionsWithLogs(
            page,
            baseURL,
            devServer,
            'WATCH',
          )
        })
      },
    )
    const staleGetRequest = serverFnRequests.find(
      (request) => request.method === 'GET',
    )
    expect(staleGetRequest).toBeDefined()

    writeFileSync(consistentRoutePath, noServerFunctionsConsistentRouteSource)
    await waitForStaticConsistentRoute(page, baseURL, devServer)

    const staleResult = await page.evaluate(async (url) => {
      const response = await fetch(url)
      return {
        ok: response.ok,
        status: response.status,
        text: await response.text(),
      }
    }, staleGetRequest!.url)

    expect(staleResult.ok).toBe(false)
    expect(staleResult.status).toBeGreaterThanOrEqual(400)
    expect(staleResult.text).not.toContain('WATCH')
  } finally {
    writeFileSync(consistentRoutePath, originalSource)
    await stopDevServer(devServer)
  }
})

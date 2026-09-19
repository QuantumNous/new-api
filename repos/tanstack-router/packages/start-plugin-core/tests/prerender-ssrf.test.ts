import { describe, expect, it, vi } from 'vitest'
import { prerender } from '../src/prerender'

vi.mock('../src/utils', async () => {
  const actual = await vi.importActual<any>('../src/utils')
  return {
    ...actual,
    createLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
  }
})

// Mock fs to prevent actual file system operations
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<any>('node:fs')
  return {
    ...actual,
    promises: {
      ...actual.promises,
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    },
  }
})

const fetchMock = vi.fn(
  async () =>
    new Response('<html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }),
)

vi.stubGlobal('fetch', fetchMock)

const handler = {
  getClientOutputDirectory: () => '/client',
  request: fetchMock,
}

function resetFetch() {
  fetchMock.mockClear()
}

function makeStartConfig(pagePath: string) {
  return {
    prerender: {
      enabled: true,
      autoStaticPathsDiscovery: false,
      concurrency: 1,
    },
    pages: [{ path: pagePath }],
    router: { basepath: '' },
    spa: {
      enabled: false,
      prerender: {
        outputPath: '/_shell',
        crawlLinks: false,
        retryCount: 0,
        enabled: true,
      },
    },
  } as any
}

describe('prerender pages validation', () => {
  it('rejects absolute external page paths to avoid SSRF', async () => {
    resetFetch()
    const startConfig = makeStartConfig('https://attacker.test/leak')

    await expect(prerender({ startConfig, handler })).rejects.toThrow(
      /prerender page path must be relative/i,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('allows relative paths', async () => {
    resetFetch()
    const startConfig = makeStartConfig('/about')

    await expect(prerender({ startConfig, handler })).resolves.not.toThrow()
  })

  it('resolves when prerender filter matches no pages', async () => {
    resetFetch()
    const startConfig = makeStartConfig('/about')
    startConfig.prerender.filter = () => false

    await expect(prerender({ startConfig, handler })).resolves.not.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

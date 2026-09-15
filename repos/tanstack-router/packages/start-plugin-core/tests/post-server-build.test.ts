import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/start-server-core', () => ({
  HEADERS: {
    TSS_SHELL: 'x-tss-shell',
  },
}))

vi.mock('../src/build-sitemap', () => ({
  buildSitemap: vi.fn(),
}))

describe('postServerBuild', () => {
  it('rejects absolute SPA maskPath URLs to avoid external prerendering', async () => {
    const prerender = vi.fn(async () => {})
    const { postBuild } = await import('../src/post-build')

    const startConfig = {
      spa: {
        enabled: true,
        maskPath: 'https://attacker.test/collect',
        prerender: {},
      },
      pages: [],
      router: { basepath: '' },
      serverFns: { base: '' },
      prerender: { enabled: true },
      sitemap: { enabled: false },
    } as any

    await expect(
      postBuild({
        startConfig,
        adapter: {
          getClientOutputDirectory: () => '/client',
          prerender,
        },
      }),
    ).rejects.toThrow(/maskPath/i)

    expect(prerender).not.toHaveBeenCalled()
  })
})

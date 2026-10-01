import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'

vi.mock('@tanstack/start-server-core', () => ({
  HEADERS: {
    TSS_SHELL: 'x-tss-shell',
  },
}))

describe('postBuildWithRsbuild', () => {
  it('imports server/index.js and accepts object fetch handlers', async () => {
    const serverOutputDirectory = await mkdtemp(join(tmpdir(), 'tss-rsbuild-'))
    const prerenderSpy = vi.fn(async ({ handler }: any) => {
      const response = await handler.request('/posts')
      expect(await response.text()).toBe('ok')
    })

    vi.doMock('../../src/prerender', async () => {
      const actual = await vi.importActual<any>('../../src/prerender')
      return {
        ...actual,
        prerender: prerenderSpy,
      }
    })

    await writeFile(
      join(serverOutputDirectory, 'index.js'),
      [
        'export default {',
        '  fetch() {',
        "    return new Response('ok')",
        '  },',
        '}',
      ].join('\n'),
    )

    const { postBuildWithRsbuild } =
      await import('../../src/rsbuild/post-build')

    try {
      await postBuildWithRsbuild({
        startConfig: {
          prerender: { enabled: true, autoStaticPathsDiscovery: false },
          pages: [{ path: '/posts' }],
          router: { basepath: '' },
          spa: { enabled: false, prerender: { outputPath: '/_shell' } },
          sitemap: { enabled: false },
        } as any,
        clientOutputDirectory: '/client',
        serverOutputDirectory,
      })

      expect(prerenderSpy).toHaveBeenCalledOnce()
    } finally {
      await rm(serverOutputDirectory, { recursive: true, force: true })
    }
  })
})

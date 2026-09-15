import { HEADERS } from '@tanstack/start-server-core'
import { buildSitemap } from './build-sitemap'
import type { TanStackStartOutputConfig } from './schema'

export interface StartPostBuildAdapter {
  getClientOutputDirectory: () => string
  prerender: (startConfig: TanStackStartOutputConfig) => Promise<void>
}

export async function postBuild({
  startConfig,
  adapter,
}: {
  startConfig: TanStackStartOutputConfig
  adapter: StartPostBuildAdapter
}) {
  if (startConfig.prerender?.enabled !== false) {
    startConfig.prerender = {
      ...startConfig.prerender,
      enabled:
        startConfig.prerender?.enabled ??
        startConfig.pages.some((d) =>
          typeof d === 'string' ? false : !!d.prerender?.enabled,
        ),
    }
  }

  if (startConfig.spa?.enabled) {
    startConfig.prerender = {
      ...startConfig.prerender,
      enabled: true,
    }

    const maskUrl = new URL(startConfig.spa.maskPath, 'http://localhost')
    if (maskUrl.origin !== 'http://localhost') {
      throw new Error('spa.maskPath must be a path (no protocol/host)')
    }

    startConfig.pages.push({
      path: maskUrl.toString().replace('http://localhost', ''),
      prerender: {
        ...startConfig.spa.prerender,
        headers: {
          ...startConfig.spa.prerender.headers,
          [HEADERS.TSS_SHELL]: 'true',
        },
      },
      sitemap: {
        exclude: true,
      },
    })
  }

  if (startConfig.prerender.enabled) {
    await adapter.prerender(startConfig)
  }

  if (startConfig.sitemap?.enabled) {
    buildSitemap({
      startConfig,
      publicDir: adapter.getClientOutputDirectory(),
    })
  }
}

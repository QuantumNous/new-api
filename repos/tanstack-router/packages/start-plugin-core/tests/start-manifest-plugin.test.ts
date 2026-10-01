import { VIRTUAL_MODULES } from '@tanstack/start-server-core'
import { describe, expect, test, vi } from 'vitest'
import { DEV_CLIENT_ENTRY, START_ENVIRONMENT_NAMES } from '../src/constants'
import { startManifestPlugin } from '../src/vite/start-manifest-plugin/plugin'

vi.mock('@tanstack/start-server-core', () => ({
  VIRTUAL_MODULES: {
    startManifest: 'tanstack-start-manifest:v',
  },
}))

describe('startManifestPlugin', () => {
  test('uses the virtual client entry during unbundled dev', () => {
    expect(loadDevManifest({ bundledDev: false })).toContain(
      `src: '/@id/${DEV_CLIENT_ENTRY}'`,
    )
  })

  test('uses the bundled client entry during bundled dev', () => {
    expect(loadDevManifest({ bundledDev: true })).toContain(
      `src: '/assets/index.js'`,
    )
  })
})

function loadDevManifest(opts: { bundledDev: boolean }) {
  const plugins = startManifestPlugin({
    getConfig: () =>
      ({
        resolvedStartConfig: {
          basePaths: {
            publicBase: '/',
          },
        },
      }) as any,
  }) as Array<any>
  const plugin = plugins.find(
    (item) => item.name === 'tanstack-start:start-manifest-plugin',
  )!
  const resolvedId = plugin.resolveId.handler(VIRTUAL_MODULES.startManifest)

  return plugin.load.handler.call(
    {
      environment: {
        name: START_ENVIRONMENT_NAMES.server,
        config: {
          command: 'serve',
          environments: {
            [START_ENVIRONMENT_NAMES.client]: {
              isBundled: opts.bundledDev,
            },
          },
        },
      },
    },
    resolvedId,
  )
}

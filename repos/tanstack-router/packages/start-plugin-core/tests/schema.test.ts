import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { parseStartConfig as parseViteStartConfig } from '../src/vite/schema'
import { parseStartConfig as parseRsbuildStartConfig } from '../src/rsbuild/schema'

const root = process.cwd()
const corePluginOpts = { framework: 'react' as const }

describe('start config schema', () => {
  test('uses Start route defaults relative to srcDirectory', () => {
    const config = parseViteStartConfig({}, corePluginOpts, root)

    expect(config.router.routesDirectory).toBe(
      path.resolve(root, 'src', 'routes'),
    )
    expect(config.router.generatedRouteTree).toBe(
      path.resolve(root, 'src', 'routeTree.gen.ts'),
    )
  })

  test('uses router path overrides relative to srcDirectory', () => {
    const config = parseRsbuildStartConfig(
      {
        srcDirectory: 'app',
        router: {
          routesDirectory: 'pages',
          generatedRouteTree: 'routes.gen.ts',
        },
      },
      corePluginOpts,
      root,
    )

    expect(config.router.routesDirectory).toBe(
      path.resolve(root, 'app', 'pages'),
    )
    expect(config.router.generatedRouteTree).toBe(
      path.resolve(root, 'app', 'routes.gen.ts'),
    )
  })
})

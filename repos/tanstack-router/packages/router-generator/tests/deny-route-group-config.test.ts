import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { Generator, getConfig } from '../src'
import type { Config } from '../src'

function makeFolderDir(folder: string) {
  return join(process.cwd(), 'tests', 'deny-route-group-config', folder)
}

function setupConfig(
  folder: string,
  inlineConfig: Partial<Omit<Config, 'routesDirectory'>> = {},
) {
  const { generatedRouteTree = `/routeTree.gen.ts`, ...rest } = inlineConfig
  const dir = makeFolderDir(folder)

  const config = getConfig({
    disableLogging: true,
    routesDirectory: dir,
    generatedRouteTree: dir + generatedRouteTree,
    ...rest,
  })
  return config
}

type TestCases = Array<{
  folder: string
  expectedError: string
}>

describe('deny-route-group-config throws', () => {
  const testCases = [
    {
      folder: 'flat-flat',
      expectedError:
        'A route configuration for a route group was found at `(group).tsx`. This is not supported. Did you mean to use a layout/pathless route instead?',
    },
    {
      folder: 'nested-flat',
      expectedError:
        'A route configuration for a route group was found at `(group).tsx`. This is not supported. Did you mean to use a layout/pathless route instead?',
    },
    {
      folder: 'flat-nested',
      expectedError:
        'A route configuration for a route group was found at `nested/(group).tsx`. This is not supported. Did you mean to use a layout/pathless route instead?',
    },
    {
      folder: 'nested-nested',
      expectedError:
        'A route configuration for a route group was found at `nested/(group).tsx`. This is not supported. Did you mean to use a layout/pathless route instead?',
    },
  ]

  it.each(testCases)(
    'should throw an error for the folder: $folder',
    async ({ folder, expectedError }) => {
      const config = setupConfig(folder)
      const folderRoot = makeFolderDir(folder)

      const generator = new Generator({ config, root: folderRoot })
      try {
        await generator.run()
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message.startsWith(expectedError)).toBeTruthy()
      }
    },
  )
})

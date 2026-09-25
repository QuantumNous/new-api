import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { getConfig } from '../src'

function makeFolderDir(folder: string) {
  return join(process.cwd(), 'tests', 'config', folder)
}

type TestCases = Array<{
  folder: string
}>

describe('load config tests', () => {
  it.each([
    {
      folder: 'json-config',
    },
  ] satisfies TestCases)(
    'should load config correctly: $folder',
    async ({ folder }) => {
      const absPath = makeFolderDir(folder)
      const resolvedConfig = getConfig({}, absPath)
      expect(resolvedConfig).toEqual(
        expect.objectContaining({
          disableLogging: true,
          routesDirectory: join(absPath, './configured-routes-path'),
          generatedRouteTree: join(absPath, './routeTree.gen.ts'),
        }),
      )
    },
  )
})

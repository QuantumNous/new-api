import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

import {
  detectKindsInCode,
  StartCompiler,
} from '../../src/start-compiler/compiler'

// Default test options for StartCompiler
function getDefaultTestOptions(env: 'client' | 'server') {
  const envName = env === 'client' ? 'client' : 'ssr'
  return {
    envName,
    root: '/test',
    framework: 'react' as const,
    providerEnvName: 'ssr',
  }
}

async function compile(opts: {
  env: 'client' | 'server'
  code: string
  id: string
}) {
  const compiler = new StartCompiler({
    ...opts,
    ...getDefaultTestOptions(opts.env),
    loadModule: async () => {
      // do nothing in test
    },
    lookupKinds: new Set(['ClientOnlyJSX']),
    lookupConfigurations: [
      // ClientOnly JSX component from TanStack router packages
      {
        libName: '@tanstack/react-router',
        rootExport: 'ClientOnly',
        kind: 'ClientOnlyJSX',
      },
    ],
    getKnownServerFns: () => ({}),
    resolveId: async (id) => {
      return id
    },
  })
  const result = await compiler.compile({
    code: opts.code,
    id: opts.id,
  })
  return result
}

async function getFilenames() {
  return await readdir(path.resolve(import.meta.dirname, './test-files'))
}

describe('ClientOnlyJSX compiles correctly', async () => {
  const filenames = await getFilenames()

  describe.each(filenames)('should handle "%s"', async (filename) => {
    const file = await readFile(
      path.resolve(import.meta.dirname, `./test-files/${filename}`),
    )
    const code = file.toString()

    // ClientOnlyJSX is only transformed on server
    test(`should compile for ${filename} server`, async () => {
      const compiledResult = await compile({
        env: 'server',
        code,
        id: filename,
      })

      if (compiledResult) {
        await expect(compiledResult.code).toMatchFileSnapshot(
          `./snapshots/server/${filename}`,
        )
      } else {
        // No transformation - for files where ClientOnly is not from TanStack
        await expect('no-transform').toMatchFileSnapshot(
          `./snapshots/server/${filename}`,
        )
      }
    })
  })

  test('ClientOnlyJSX should not be detected on client', () => {
    const code = `
      import { ClientOnly } from '@tanstack/react-router'
      <ClientOnly>test</ClientOnly>
    `
    const detectedKinds = detectKindsInCode(code, 'client')
    expect(detectedKinds.has('ClientOnlyJSX')).toBe(false)
  })

  test('ClientOnlyJSX should be detected on server', () => {
    const code = `
      import { ClientOnly } from '@tanstack/react-router'
      <ClientOnly>test</ClientOnly>
    `
    const detectedKinds = detectKindsInCode(code, 'server')
    expect(detectedKinds.has('ClientOnlyJSX')).toBe(true)
  })
})

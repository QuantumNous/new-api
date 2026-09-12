import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

import { StartCompiler } from '../../src/start-compiler/compiler'

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
    lookupKinds: new Set(['IsomorphicFn']),
    lookupConfigurations: [
      {
        libName: `@tanstack/react-start`,
        rootExport: 'createIsomorphicFn',
        kind: 'IsomorphicFn',
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

describe('createIsomorphicFn compiles correctly', async () => {
  const filenames = await getFilenames()

  describe.each(filenames)('should handle "%s"', async (filename) => {
    const file = await readFile(
      path.resolve(import.meta.dirname, `./test-files/${filename}`),
    )
    const code = file.toString()

    test.each(['client', 'server'] as const)(
      `should compile for ${filename} %s`,
      async (env) => {
        const compiledResult = await compile({
          env,
          code,
          id: filename,
        })

        await expect(compiledResult!.code).toMatchFileSnapshot(
          `./snapshots/${env}/${filename}`,
        )
      },
    )
  })

  test('should error if implementation not provided', async () => {
    await expect(
      compile({
        env: 'client',
        code: `
        import { createIsomorphicFn } from '@tanstack/react-start'
        const clientOnly = createIsomorphicFn().client()`,
        id: 'no-fn.ts',
      }),
    ).rejects.toThrowError()

    await expect(
      compile({
        env: 'server',
        code: `
        import { createIsomorphicFn } from '@tanstack/react-start'
        const serverOnly = createIsomorphicFn().server()`,
        id: 'no-fn.ts',
      }),
    ).rejects.toThrowError()
  })
})

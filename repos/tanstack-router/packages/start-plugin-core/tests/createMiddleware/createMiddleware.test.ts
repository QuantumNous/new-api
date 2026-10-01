import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, test, vi } from 'vitest'
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

async function getFilenames() {
  return await readdir(path.resolve(import.meta.dirname, './test-files'))
}

async function compile(opts: {
  env: 'client' | 'server'
  code: string
  id: string
  warn?: (message: string) => void
}) {
  const compiler = new StartCompiler({
    ...opts,
    ...getDefaultTestOptions(opts.env),
    loadModule: async () => {
      // do nothing in test
    },
    lookupKinds: new Set(['Middleware']),
    lookupConfigurations: [
      {
        libName: `@tanstack/react-start`,
        rootExport: 'createMiddleware',
        kind: 'Root',
      },
      {
        libName: `@tanstack/react-start`,
        rootExport: 'createStart',
        kind: 'Root',
      },
    ],
    warn: opts.warn,
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

describe('createMiddleware compiles correctly', async () => {
  const filenames = await getFilenames()

  describe.each(filenames)('should handle "%s"', async (filename) => {
    const file = await readFile(
      path.resolve(import.meta.dirname, `./test-files/${filename}`),
    )
    const code = file.toString()

    // Note: Middleware compilation only happens on the client
    test(`should compile for ${filename} client`, async () => {
      const result = await compile({ env: 'client', code, id: filename })

      await expect(result!.code).toMatchFileSnapshot(
        `./snapshots/client/${filename}`,
      )
    })
  })

  test('should compile validator method', async () => {
    const code = `
      import { createMiddleware } from '@tanstack/react-start'
      const myMiddleware = createMiddleware({ type: 'function' })
        .validator((input: string) => input)
        .server(async ({ next }) => {
          return next()
        })`

    const result = await compile({
      env: 'client',
      code,
      id: 'test.ts',
    })

    expect(result!.code).toMatchInlineSnapshot(`
      "import { createMiddleware } from '@tanstack/react-start';
      const myMiddleware = createMiddleware({
        type: 'function'
      });"
    `)
  })

  // TODO remove upon stable
  test('should warn for deprecated inputValidator method', async () => {
    const warn = vi.fn()
    const code = `
      import { createMiddleware } from '@tanstack/react-start'
      const myMiddleware = createMiddleware({ type: 'function' })
        .inputValidator((input: string) => input)
        .server(async ({ next }) => {
          return next()
        })`

    await compile({
      env: 'client',
      code,
      id: 'test.ts',
      warn,
    })

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'createMiddleware().inputValidator() is deprecated. Use createMiddleware().validator() instead.',
      ),
    )
  })

  test('should use fast path for direct imports from known library (no extra resolveId calls)', async () => {
    const code = `
      import { createMiddleware } from '@tanstack/react-start'
      const myMiddleware = createMiddleware().server(async ({ next }) => {
        return next()
      })`

    const resolveIdMock = vi.fn(async (id: string) => id)

    const compiler = new StartCompiler({
      env: 'client',
      ...getDefaultTestOptions('client'),
      loadModule: async () => {},
      lookupKinds: new Set(['Middleware']),
      lookupConfigurations: [
        {
          libName: '@tanstack/react-start',
          rootExport: 'createMiddleware',
          kind: 'Root',
        },
      ],
      getKnownServerFns: () => ({}),
      resolveId: resolveIdMock,
    })

    await compiler.compile({
      code,
      id: 'test.ts',
    })

    // Direct known-library imports use the knownRootImports fast path, so they
    // do not need resolveId.
    expect(resolveIdMock).not.toHaveBeenCalled()
  })

  test('should use slow path for factory pattern (resolveId called for import resolution)', async () => {
    // This simulates a factory pattern where createMiddleware is re-exported from a local file
    const factoryCode = `
      import { createFooMiddleware } from './factory'
      const myMiddleware = createFooMiddleware().server(async ({ next }) => {
        return next()
      })`

    const resolveIdMock = vi.fn(async (id: string) => id)

    const compiler = new StartCompiler({
      env: 'client',
      ...getDefaultTestOptions('client'),
      loadModule: async (id) => {
        // Simulate the factory module being loaded
        if (id === './factory') {
          compiler.ingestModule({
            code: `
              import { createMiddleware } from '@tanstack/react-start'
              export const createFooMiddleware = createMiddleware
            `,
            id: './factory',
          })
        }
      },
      lookupKinds: new Set(['Middleware']),
      lookupConfigurations: [
        {
          libName: '@tanstack/react-start',
          rootExport: 'createMiddleware',
          kind: 'Root',
        },
      ],
      getKnownServerFns: () => ({}),
      resolveId: resolveIdMock,
    })

    await compiler.compile({
      code: factoryCode,
      id: 'test.ts',
    })

    // resolveId should only be called for './factory'. Direct known-library
    // imports use the knownRootImports fast path.
    //
    // Note: The factory module's import from '@tanstack/react-start' ALSO uses
    // the fast path (knownRootImports), so no additional resolveId call is needed there.
    expect(resolveIdMock).toHaveBeenCalledTimes(1)
    expect(resolveIdMock).toHaveBeenNthCalledWith(1, './factory', 'test.ts')
  })

  test('should resolve createMiddleware from start-client-core implementation file', async () => {
    const virtualModules: Record<string, string> = {
      '@tanstack/start-client-core': `
        export { createMiddleware } from './createMiddleware'
        export { createIsomorphicFn } from '@tanstack/start-fn-stubs'
      `,
      '/virtual/compiler-known/middleware-factory.ts': `
        export const createMiddleware = () => ({
          server: () => createMiddleware(),
        })
      `,
    }

    const compiler = new StartCompiler({
      env: 'client',
      ...getDefaultTestOptions('client'),
      loadModule: async (id) => {
        const code = virtualModules[id]
        if (code) {
          compiler.ingestModule({ code, id })
        }
      },
      lookupKinds: new Set(['Middleware', 'IsomorphicFn']),
      lookupConfigurations: [],
      getKnownServerFns: () => ({}),
      resolveId: async (source) => {
        if (source === '@tanstack/start-client-core') {
          return '@tanstack/start-client-core'
        }

        if (source === './createMiddleware') {
          return '/virtual/compiler-known/middleware-factory.ts'
        }

        return null
      },
    })

    const result = await compiler.compile({
      id: '/repo/packages/start-client-core/src/createCsrfMiddleware.ts',
      code: `
        import { createIsomorphicFn } from '@tanstack/start-fn-stubs'
        import { createMiddleware } from './createMiddleware'

        const innerCreateCsrfMiddleware = () => {
          return createMiddleware().server(() => 'server-only-middleware')
        }

        export const createCsrfMiddleware = createIsomorphicFn()
          .server(innerCreateCsrfMiddleware)
      `,
    })

    expect(result).not.toBeNull()
    expect(result!.code).not.toContain('server-only-middleware')
    expect(result!.code).not.toContain('createIsomorphicFn')
  })

  test('should resolve namespace createMiddleware from start-client-core implementation file', async () => {
    const virtualModules: Record<string, string> = {
      '@tanstack/start-client-core': `
        export { createMiddleware } from './createMiddleware'
      `,
      '/virtual/compiler-known/middleware-factory.ts': `
        export const createMiddleware = () => ({
          server: () => createMiddleware(),
        })
      `,
    }

    const compiler = new StartCompiler({
      env: 'client',
      ...getDefaultTestOptions('client'),
      loadModule: async (id) => {
        const code = virtualModules[id]
        if (code) {
          compiler.ingestModule({ code, id })
        }
      },
      lookupKinds: new Set(['Middleware']),
      lookupConfigurations: [],
      getKnownServerFns: () => ({}),
      resolveId: async (source) => {
        if (source === '@tanstack/start-client-core') {
          return '@tanstack/start-client-core'
        }

        if (source === './createMiddleware') {
          return '/virtual/compiler-known/middleware-factory.ts'
        }

        return null
      },
    })

    const result = await compiler.compile({
      id: '/repo/packages/start-client-core/src/internal.ts',
      code: `
        import * as middlewareModule from './createMiddleware'

        export const middleware = middlewareModule.createMiddleware().server(() => {
          return 'server-only-middleware'
        })
      `,
    })

    expect(result).not.toBeNull()
    expect(result!.code).not.toContain('server-only-middleware')
  })
})

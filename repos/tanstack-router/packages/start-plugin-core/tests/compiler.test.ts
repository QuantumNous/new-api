import { describe, expect, test } from 'vitest'
import {
  StartCompiler,
  detectKindsInCode,
  getLookupKindsForEnv,
} from '../src/start-compiler/compiler'
import { getLookupConfigurationsForEnv } from '../src/start-compiler/config'
import type { LookupConfig, LookupKind } from '../src/start-compiler/compiler'
import type { StartCompilerImportTransform } from '../src/types'

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

// Helper to create a compiler with all kinds enabled
function createFullCompiler(
  env: 'client' | 'server',
  opts?: {
    serverFnProviderModuleDirectives?: ReadonlyArray<string> | undefined
  },
) {
  const lookupKinds: Set<LookupKind> =
    env === 'client'
      ? new Set([
          'ServerFn',
          'Middleware',
          'IsomorphicFn',
          'ServerOnlyFn',
          'ClientOnlyFn',
        ])
      : new Set(['ServerFn', 'IsomorphicFn', 'ServerOnlyFn', 'ClientOnlyFn'])

  const lookupConfigurations: Array<LookupConfig> = [
    {
      libName: '@tanstack/react-start',
      rootExport: 'createServerFn',
      kind: 'Root',
    },
    {
      libName: '@tanstack/react-start',
      rootExport: 'createMiddleware',
      kind: 'Root',
    },
    {
      libName: '@tanstack/react-start',
      rootExport: 'createIsomorphicFn',
      kind: 'IsomorphicFn',
    },
    {
      libName: '@tanstack/react-start',
      rootExport: 'createServerOnlyFn',
      kind: 'ServerOnlyFn',
    },
    {
      libName: '@tanstack/react-start',
      rootExport: 'createClientOnlyFn',
      kind: 'ClientOnlyFn',
    },
  ]

  return new StartCompiler({
    env,
    ...getDefaultTestOptions(env),
    lookupKinds,
    lookupConfigurations,
    getKnownServerFns: () => ({}),
    loadModule: async () => {},
    resolveId: async (id) => id,
    mode: 'build',
    serverFnProviderModuleDirectives: opts?.serverFnProviderModuleDirectives,
  })
}

function createExternalTransformCompiler() {
  const compilerTransforms: Array<StartCompilerImportTransform> = [
    {
      name: 'test-render-option-injection',
      environment: 'server',
      imports: [
        {
          libName: '@example/runtime',
          rootExport: 'renderThing',
        },
      ],
      detect: /\brenderThing\b/,
      transform: (candidates, context) => {
        const t = context.types
        for (const candidate of candidates) {
          const args = candidate.path.node.arguments
          if (args.length !== 1) continue
          args.push(
            t.objectExpression([
              t.objectProperty(
                t.identifier('injected'),
                context.parseExpression('loadThing()'),
              ),
            ]),
          )
        }
      },
    },
  ]

  return new StartCompiler({
    env: 'server',
    envName: 'server',
    root: '/test',
    framework: 'react',
    providerEnvName: 'server',
    lookupKinds: getLookupKindsForEnv('server', { compilerTransforms }),
    lookupConfigurations: getLookupConfigurationsForEnv('server', 'react', {
      compilerTransforms,
    }),
    getKnownServerFns: () => ({}),
    loadModule: async () => {},
    resolveId: async (id) => id,
    mode: 'build',
    compilerTransforms,
  })
}

describe('detectKindsInCode', () => {
  describe('detects individual kinds correctly', () => {
    test('detects ServerFn via .handler(', () => {
      const code = `
        import { createServerFn } from '@tanstack/react-start'
        const fn = createServerFn().handler(() => 'hello')
      `
      expect(detectKindsInCode(code, 'client')).toEqual(new Set(['ServerFn']))
      expect(detectKindsInCode(code, 'server')).toEqual(new Set(['ServerFn']))
    })

    test('detects Middleware', () => {
      const code = `
        import { createMiddleware } from '@tanstack/react-start'
        const mw = createMiddleware().server(({ next }) => next())
      `
      // Middleware is only valid on client
      expect(detectKindsInCode(code, 'client')).toEqual(new Set(['Middleware']))
      expect(detectKindsInCode(code, 'server')).toEqual(new Set())
    })

    test('detects IsomorphicFn', () => {
      const code = `
        import { createIsomorphicFn } from '@tanstack/react-start'
        const fn = createIsomorphicFn().client(() => 'c').server(() => 's')
      `
      expect(detectKindsInCode(code, 'client')).toEqual(
        new Set(['IsomorphicFn']),
      )
      expect(detectKindsInCode(code, 'server')).toEqual(
        new Set(['IsomorphicFn']),
      )
    })

    test('detects ServerOnlyFn', () => {
      const code = `
        import { createServerOnlyFn } from '@tanstack/react-start'
        const fn = createServerOnlyFn(() => 'server only')
      `
      expect(detectKindsInCode(code, 'client')).toEqual(
        new Set(['ServerOnlyFn']),
      )
      expect(detectKindsInCode(code, 'server')).toEqual(
        new Set(['ServerOnlyFn']),
      )
    })

    test('detects ClientOnlyFn', () => {
      const code = `
        import { createClientOnlyFn } from '@tanstack/react-start'
        const fn = createClientOnlyFn(() => 'client only')
      `
      expect(detectKindsInCode(code, 'client')).toEqual(
        new Set(['ClientOnlyFn']),
      )
      expect(detectKindsInCode(code, 'server')).toEqual(
        new Set(['ClientOnlyFn']),
      )
    })

    test('resets external transform regex state between detections', () => {
      const compilerTransforms: Array<StartCompilerImportTransform> = [
        {
          name: 'global-detect',
          environment: 'server',
          imports: [{ libName: '@example/runtime', rootExport: 'renderThing' }],
          detect: /\brenderThing\b/g,
          transform: () => {},
        },
      ]
      const code = `
        import { renderThing } from '@example/runtime'
        renderThing()
      `

      expect(detectKindsInCode(code, 'server', { compilerTransforms })).toEqual(
        new Set(['External:global-detect']),
      )
      expect(detectKindsInCode(code, 'server', { compilerTransforms })).toEqual(
        new Set(['External:global-detect']),
      )
    })
  })

  describe('detects multiple kinds in same file', () => {
    test('detects ServerFn and IsomorphicFn', () => {
      const code = `
        import { createServerFn, createIsomorphicFn } from '@tanstack/react-start'
        const serverFn = createServerFn().handler(() => 'hello')
        const isoFn = createIsomorphicFn().client(() => 'client')
      `
      expect(detectKindsInCode(code, 'client')).toEqual(
        new Set(['ServerFn', 'IsomorphicFn']),
      )
    })

    test('detects all kinds on client', () => {
      const code = `
        import { createServerFn, createMiddleware, createIsomorphicFn, createServerOnlyFn, createClientOnlyFn } from '@tanstack/react-start'
        const a = createServerFn().handler(() => {})
        const b = createMiddleware().server(({ next }) => next())
        const c = createIsomorphicFn()
        const d = createServerOnlyFn(() => {})
        const e = createClientOnlyFn(() => {})
      `
      expect(detectKindsInCode(code, 'client')).toEqual(
        new Set([
          'ServerFn',
          'Middleware',
          'IsomorphicFn',
          'ServerOnlyFn',
          'ClientOnlyFn',
        ]),
      )
    })

    test('detects all valid kinds on server (excludes Middleware)', () => {
      const code = `
        import { createServerFn, createMiddleware, createIsomorphicFn, createServerOnlyFn, createClientOnlyFn } from '@tanstack/react-start'
        const a = createServerFn().handler(() => {})
        const b = createMiddleware().server(({ next }) => next())
        const c = createIsomorphicFn()
        const d = createServerOnlyFn(() => {})
        const e = createClientOnlyFn(() => {})
      `
      // Middleware should NOT be detected on server
      expect(detectKindsInCode(code, 'server')).toEqual(
        new Set(['ServerFn', 'IsomorphicFn', 'ServerOnlyFn', 'ClientOnlyFn']),
      )
    })
  })

  describe('handles edge cases', () => {
    test('returns empty set for code with no matching patterns', () => {
      const code = `
        const foo = 'bar'
        function hello() { return 'world' }
      `
      expect(detectKindsInCode(code, 'client')).toEqual(new Set())
      expect(detectKindsInCode(code, 'server')).toEqual(new Set())
    })

    test('handles .handler with whitespace variations', () => {
      const code1 = `fn.handler(() => {})`
      const code2 = `fn.handler  (() => {})`
      const code3 = `fn.handler\n(() => {})`
      const code4 = `fn.handler\t(() => {})`

      expect(detectKindsInCode(code1, 'client')).toEqual(new Set(['ServerFn']))
      expect(detectKindsInCode(code2, 'client')).toEqual(new Set(['ServerFn']))
      expect(detectKindsInCode(code3, 'client')).toEqual(new Set(['ServerFn']))
      expect(detectKindsInCode(code4, 'client')).toEqual(new Set(['ServerFn']))
    })

    test('handles whitespace between . and handler (reformatted code)', () => {
      // When Vite/Babel reformats code, the dot can end up on a previous line
      const code1 = `fn.\nhandler(() => {})`
      const code2 = `fn.\n  handler(() => {})`
      const code3 = `fn.  \n  handler(() => {})`

      expect(detectKindsInCode(code1, 'client')).toEqual(new Set(['ServerFn']))
      expect(detectKindsInCode(code2, 'client')).toEqual(new Set(['ServerFn']))
      expect(detectKindsInCode(code3, 'client')).toEqual(new Set(['ServerFn']))
    })

    test('detects createServerFn() call directly', () => {
      // The pattern should match createServerFn() calls, not just .handler()
      const code = `
        import { createServerFn } from '@tanstack/react-start'
        const fn = createServerFn()
      `
      expect(detectKindsInCode(code, 'client')).toEqual(new Set(['ServerFn']))
    })

    test('does not false positive on similar function names', () => {
      // Only exact createServerFn( should match, not variations
      const code = `
        const fn = createServerFnExample()
        const fn2 = createServerFnLike()
        const fn3 = mycreateServerFn()
        const fn4 = _createServerFn()
      `
      expect(detectKindsInCode(code, 'client')).toEqual(new Set())
    })

    test('does not false positive on similar names', () => {
      const code = `
        const myCreateServerFn = () => {}
        const createServerFnLike = () => {}
        // But this should match:
        createServerFn().handler(() => {})
      `
      // Should only match because of .handler(, not because of variable names
      expect(detectKindsInCode(code, 'client')).toEqual(new Set(['ServerFn']))
    })
  })
})

describe('compiler handles multiple files with different kinds', () => {
  test('single compiler instance correctly processes files with different kinds in succession', async () => {
    const compiler = createFullCompiler('client')

    // File 1: ServerFn only
    const result1 = await compiler.compile({
      code: `
        import { createServerFn } from '@tanstack/react-start'
        export const fn = createServerFn().handler(() => 'hello')
      `,
      id: 'file1.ts',

      detectedKinds: new Set(['ServerFn']),
    })
    expect(result1).not.toBeNull()
    expect(result1!.code).toContain('createClientRpc') // Client should have RPC stub
    expect(result1!.code).not.toContain('createMiddleware')
    expect(result1!.code).not.toContain('createIsomorphicFn')

    // File 2: Middleware only
    const result2 = await compiler.compile({
      code: `
        import { createMiddleware } from '@tanstack/react-start'
        export const mw = createMiddleware().server(({ next }) => {
          console.log('server only')
          return next()
        })
      `,
      id: 'file2.ts',

      detectedKinds: new Set(['Middleware']),
    })
    expect(result2).not.toBeNull()
    // .server() should be stripped on client
    expect(result2!.code).not.toContain('console.log')
    expect(result2!.code).not.toContain('createServerFn')

    // File 3: IsomorphicFn only
    const result3 = await compiler.compile({
      code: `
        import { createIsomorphicFn } from '@tanstack/react-start'
        export const fn = createIsomorphicFn()
          .client(() => 'client-value')
          .server(() => 'server-value')
      `,
      id: 'file3.ts',

      detectedKinds: new Set(['IsomorphicFn']),
    })
    expect(result3).not.toBeNull()
    // Client should have client implementation
    expect(result3!.code).toContain('client-value')
    expect(result3!.code).not.toContain('server-value')

    // File 4: ServerOnlyFn only
    const result4 = await compiler.compile({
      code: `
        import { createServerOnlyFn } from '@tanstack/react-start'
        export const fn = createServerOnlyFn(() => 'server only value')
      `,
      id: 'file4.ts',

      detectedKinds: new Set(['ServerOnlyFn']),
    })
    expect(result4).not.toBeNull()
    // Client should have error throw
    expect(result4!.code).toContain('throw new Error')
    expect(result4!.code).not.toContain('server only value')

    // File 5: Mix of ServerFn and IsomorphicFn
    const result5 = await compiler.compile({
      code: `
        import { createServerFn, createIsomorphicFn } from '@tanstack/react-start'
        export const serverFn = createServerFn().handler(() => 'hello')
        export const isoFn = createIsomorphicFn().client(() => 'client-iso')
      `,
      id: 'file5.ts',

      detectedKinds: new Set(['ServerFn', 'IsomorphicFn']),
    })
    expect(result5).not.toBeNull()
    expect(result5!.code).toContain('createClientRpc') // ServerFn RPC
    expect(result5!.code).toContain('client-iso') // IsomorphicFn client impl
  })

  test('compiler works correctly when processing same kind multiple times', async () => {
    const compiler = createFullCompiler('client')

    // First file with IsomorphicFn
    const result1 = await compiler.compile({
      code: `
        import { createIsomorphicFn } from '@tanstack/react-start'
        export const fn1 = createIsomorphicFn().client(() => 'first')
      `,
      id: 'first.ts',

      detectedKinds: new Set(['IsomorphicFn']),
    })
    expect(result1!.code).toContain('first')

    // Second file with different IsomorphicFn
    const result2 = await compiler.compile({
      code: `
        import { createIsomorphicFn } from '@tanstack/react-start'
        export const fn2 = createIsomorphicFn().client(() => 'second')
      `,
      id: 'second.ts',

      detectedKinds: new Set(['IsomorphicFn']),
    })
    expect(result2!.code).toContain('second')
    expect(result2!.code).not.toContain('first') // Should not leak from previous file
  })

  test('server environment excludes Middleware from detected kinds', async () => {
    const compiler = createFullCompiler('server')

    // Even if Middleware is in detectedKinds, server env should ignore it
    const result = await compiler.compile({
      code: `
        import { createMiddleware } from '@tanstack/react-start'
        export const mw = createMiddleware().server(({ next }) => next())
      `,
      id: 'middleware.ts',

      // Intentionally including Middleware even though it's server env
      detectedKinds: new Set(['Middleware']),
    })
    // Should return null since Middleware is not valid on server
    expect(result).toBeNull()
  })
})

describe('compiler handles external import transforms', () => {
  test('runs configured direct-call transforms before server function extraction', async () => {
    const compiler = createExternalTransformCompiler()

    const result = await compiler.compile({
      code: `
        import { createServerFn } from '@tanstack/react-start'
        import { renderThing as renderAlias } from '@example/runtime'

        export const getComponent = createServerFn({ method: 'GET' }).handler(async () => {
          return renderAlias(<ServerCard />)
        })
      `,
      id: '/test/src/routes/card.tsx?tss-serverfn-split',
    })

    expect(result).not.toBeNull()
    expect(result!.code).toContain('injected: loadThing()')
    expect(result!.code).toContain('renderAlias(<ServerCard />,')
  })

  test('runs configured direct-call transforms for namespace imports', async () => {
    const compiler = createExternalTransformCompiler()

    const result = await compiler.compile({
      code: `
        import * as runtime from '@example/runtime'

        export const component = runtime.renderThing(<ServerCard />)
      `,
      id: '/test/src/routes/card.tsx',
    })

    expect(result).not.toBeNull()
    expect(result!.code).toContain('injected: loadThing()')
    expect(result!.code).toContain('runtime.renderThing(<ServerCard />,')
  })

  test('does not run external transforms for shadowed import names', async () => {
    const compiler = createExternalTransformCompiler()

    const result = await compiler.compile({
      code: `
        import { renderThing } from '@example/runtime'

        export function component() {
          const renderThing = (node: React.ReactNode) => node
          return renderThing(<LocalCard />)
        }
      `,
      id: '/test/src/routes/card.tsx',
    })

    expect(result).toBeNull()
  })
})

describe('server function provider module directives', () => {
  const code = `
    import { createServerFn } from '@tanstack/react-start'

    export const getMessage = createServerFn({ method: 'GET' }).handler(() => {
      return 'hello'
    })
  `

  test('does not add module directives without compiler configuration', async () => {
    const compiler = createFullCompiler('server')

    const result = await compiler.compile({
      code,
      id: '/test/src/routes/message.tsx?tss-serverfn-split',
    })

    expect(result).not.toBeNull()
    expect(result!.code).not.toContain('"use server-entry"')
  })

  test('adds configured module directives to provider files only', async () => {
    const compiler = createFullCompiler('server', {
      serverFnProviderModuleDirectives: ['use server-entry'],
    })

    const providerResult = await compiler.compile({
      code,
      id: '/test/src/routes/message.tsx?tss-serverfn-split',
    })
    const callerResult = await compiler.compile({
      code,
      id: '/test/src/routes/message.tsx',
    })

    expect(providerResult).not.toBeNull()
    expect(providerResult!.code).toContain('"use server-entry";')
    expect(callerResult).not.toBeNull()
    expect(callerResult!.code).not.toContain('"use server-entry"')
  })
})

describe('edge cases for detectedKinds', () => {
  test('empty detectedKinds returns null (no candidates to process)', async () => {
    const compiler = createFullCompiler('client')

    const result = await compiler.compile({
      code: `
        // This file somehow passed Vite filter but has no actual kinds
        const foo = 'bar'
        // Maybe a false positive match like "handler(" in a comment
        // .handler( in string
      `,
      id: 'empty.ts',

      detectedKinds: new Set(), // Empty set
    })

    expect(result).toBeNull()
  })

  test('detectedKinds not provided falls back to all valid kinds', async () => {
    const compiler = createFullCompiler('client')

    // When detectedKinds is not provided, should check all valid kinds
    const result = await compiler.compile({
      code: `
        import { createIsomorphicFn } from '@tanstack/react-start'
        export const fn = createIsomorphicFn().client(() => 'works')
      `,
      id: 'no-detected.ts',

      // No detectedKinds provided
    })

    expect(result).not.toBeNull()
    expect(result!.code).toContain('works')
  })

  test('detectedKinds with invalid kinds for env are filtered out', async () => {
    const compiler = createFullCompiler('server')

    // Passing Middleware (invalid for server) along with valid kind
    const result = await compiler.compile({
      code: `
        import { createIsomorphicFn } from '@tanstack/react-start'
        export const fn = createIsomorphicFn().server(() => 'server-impl')
      `,
      id: 'filtered.ts',

      detectedKinds: new Set(['Middleware', 'IsomorphicFn']), // Middleware should be filtered
    })

    expect(result).not.toBeNull()
    expect(result!.code).toContain('server-impl')
  })
})

test('ingestModule handles empty code gracefully', () => {
  const compiler = new StartCompiler({
    env: 'client',
    ...getDefaultTestOptions('client'),
    lookupKinds: new Set(['ServerFn']),
    lookupConfigurations: [],
    getKnownServerFns: () => ({}),
    loadModule: async () => {},
    resolveId: async (id) => id,
  })

  // Should not throw when ingesting empty module
  expect(() => {
    compiler.ingestModule({ code: '', id: 'empty-types.ts' })
  }).not.toThrow()

  // Should also handle whitespace-only modules
  expect(() => {
    compiler.ingestModule({ code: '   \n\t  ', id: 'whitespace.ts' })
  }).not.toThrow()
})

test('compile caches modules without detected candidates for transitive importer traversal', async () => {
  const compiler = new StartCompiler({
    env: 'client',
    ...getDefaultTestOptions('client'),
    lookupKinds: new Set(['ServerFn']),
    lookupConfigurations: [],
    getKnownServerFns: () => ({}),
    loadModule: async () => {},
    resolveId: async (source, importer) => {
      if (source === './leaf' && importer === '/src/plain.ts') {
        return '/src/leaf.ts'
      }

      if (source === './plain' && importer === '/src/parent.ts') {
        return '/src/plain.ts'
      }

      return null
    },
  })

  await compiler.compile({
    id: '/src/plain.ts',
    code: `
      import { value } from './leaf'
      export const plain = value
    `,
    detectedKinds: new Set(),
  })

  await compiler.compile({
    id: '/src/parent.ts',
    code: `
      import { plain } from './plain'
      export const parent = plain
    `,
    detectedKinds: new Set(),
  })

  expect(await compiler.getTransitiveImporters('/src/leaf.ts')).toEqual(
    new Set(['/src/plain.ts', '/src/parent.ts']),
  )
  expect(await compiler.getTransitiveImporters(['/src/leaf.ts'])).toEqual(
    new Set(['/src/plain.ts', '/src/parent.ts']),
  )
})

describe('calling result of createServerOnlyFn/createClientOnlyFn', () => {
  // This tests the fix for https://github.com/TanStack/router/issues/6643
  // When a file has both createServerFn and createServerOnlyFn, and the result
  // of createServerOnlyFn is invoked (e.g., `const result = myServerOnlyFn()`),
  // the compiler should NOT treat that invocation as a ServerOnlyFn candidate.
  // The var binding holds the RESULT of the factory, not the factory itself.

  test('invocation of createServerOnlyFn result is not treated as a candidate', async () => {
    const compiler = createFullCompiler('server')

    const code = `
      import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'

      const createRandomNumber = createServerOnlyFn(() => Math.floor(Math.random() * 100))
      const randomNumber = createRandomNumber()

      export const personServerFn = createServerFn({ method: 'GET' })
        .handler(({ data: name }) => {
          return { name, randomNumber }
        })
    `

    // Should NOT throw "createServerOnlyFn() must be called with a function!"
    // The main file output is the split-file version (createServerFn splits the handler),
    // so we just verify it compiles without error and produces valid output.
    const result = await compiler.compile({ code, id: 'test-6643.ts' })
    expect(result).not.toBeNull()
    // The output should contain the personServerFn export (with SSR RPC reference)
    expect(result!.code).toContain('personServerFn')
  })

  test('invocation of createClientOnlyFn result is not treated as a candidate', async () => {
    const compiler = createFullCompiler('client')

    const code = `
      import { createClientOnlyFn, createServerFn } from '@tanstack/react-start'

      const getWindowWidth = createClientOnlyFn(() => window.innerWidth)
      const width = getWindowWidth()

       export const personServerFn = createServerFn({ method: 'GET' })
        .handler(({ data: name }) => {
          return { name }
        })
    `

    const result = await compiler.compile({ code, id: 'test-6643-client.ts' })
    expect(result).not.toBeNull()
    expect(result!.code).toContain('window.innerWidth')
    expect(result!.code).toContain('getWindowWidth()')
  })

  test('re-exported createServerOnlyFn still resolves correctly', async () => {
    // Ensure the fix doesn't break re-export chain resolution (issue #6583)
    const virtualModules: Record<string, string> = {
      '@tanstack/start-client-core': `
        export { createServerOnlyFn } from '@tanstack/start-fn-stubs'
      `,
    }

    const compiler: StartCompiler = new StartCompiler({
      env: 'server',
      envName: 'ssr',
      root: '/test',
      framework: 'react' as const,
      providerEnvName: 'ssr',
      lookupKinds: new Set(['ServerOnlyFn', 'ClientOnlyFn']),
      lookupConfigurations: [],
      getKnownServerFns: () => ({}),
      loadModule: async (id) => {
        const code = virtualModules[id]
        if (code) {
          compiler.ingestModule({ code, id })
        }
      },
      resolveId: async (id) => {
        return virtualModules[id] ? id : null
      },
    })

    const code = `
      import { createServerOnlyFn } from '@tanstack/start-client-core'
      const myFn = createServerOnlyFn(() => 'server-only-value')
    `

    const result = await compiler.compile({ code, id: 'reexport-test.ts' })
    expect(result).not.toBeNull()
    expect(result!.code).toContain('server-only-value')
  })

  test('aliased factory is still detected as a candidate', async () => {
    // `const createSO = createServerOnlyFn` is an alias, not an invocation.
    // `createSO(() => ...)` should still be treated as ServerOnlyFn.
    const compiler = createFullCompiler('server')

    const code = `
      import { createServerOnlyFn } from '@tanstack/react-start'

      const createSO = createServerOnlyFn
      const myFn = createSO(() => 'aliased-server-only')
    `

    const result = await compiler.compile({ code, id: 'alias-test.ts' })
    expect(result).not.toBeNull()
    // The factory should be unwrapped on server env
    expect(result!.code).toContain('aliased-server-only')
  })
})

describe('re-export chain resolution', () => {
  // This tests the fix for https://github.com/TanStack/router/issues/6583
  // Third-party packages may import from @tanstack/start-client-core (which re-exports
  // from @tanstack/start-fn-stubs) rather than directly from @tanstack/react-start.
  // The compiler should correctly resolve these imports via the slow path.

  // Virtual module contents for simulating the re-export chain:
  // @third-party/lib -> @tanstack/start-client-core -> @tanstack/start-fn-stubs
  //
  // Note: We don't need a virtual module for @tanstack/start-fn-stubs because
  // init() hardcodes it in knownRootImports. When the slow path resolution reaches
  // that package, it uses the fast path lookup and never needs to parse the module.
  const virtualModules: Record<string, string> = {
    // The client-core package that re-exports from stubs
    '@tanstack/start-client-core': `
      export { createIsomorphicFn, createServerOnlyFn, createClientOnlyFn } from '@tanstack/start-fn-stubs'
    `,
    // A third-party package that imports from start-client-core
    '@third-party/lib': `
      import { createIsomorphicFn, createClientOnlyFn } from '@tanstack/start-client-core'

      export const getThemeData = createIsomorphicFn()
        .client(() => 'client-theme')
        .server(() => 'server-theme')

      export const initClientFeature = createClientOnlyFn(() => {
        console.log('client only initialization')
        return 'initialized'
      })
    `,
  }

  function createCompilerWithVirtualModules(env: 'client' | 'server') {
    const envName = env === 'client' ? 'client' : 'ssr'
    const lookupKinds: Set<LookupKind> = new Set([
      'IsomorphicFn',
      'ServerOnlyFn',
      'ClientOnlyFn',
    ])

    // Note: We use empty lookupConfigurations because this test is specifically
    // testing the slow path resolution through re-export chains. The compiler
    // should still work because @tanstack/start-fn-stubs is hardcoded in
    // knownRootImports during init().
    const compiler: StartCompiler = new StartCompiler({
      env,
      envName,
      root: '/test',
      framework: 'react' as const,
      providerEnvName: 'ssr',
      lookupKinds,
      lookupConfigurations: [],
      getKnownServerFns: () => ({}),
      loadModule: async (id) => {
        const code = virtualModules[id]
        if (code) {
          compiler.ingestModule({ code, id })
        }
      },
      resolveId: async (id) => {
        return virtualModules[id] ? id : null
      },
    })

    return compiler
  }

  const testCases: Array<{
    env: 'client' | 'server'
    fn: string
    shouldContain: Array<string>
    shouldNotContain: Array<string>
  }> = [
    {
      env: 'client',
      fn: 'createIsomorphicFn',
      shouldContain: ['client-theme'],
      shouldNotContain: ['server-theme'],
    },
    {
      env: 'server',
      fn: 'createIsomorphicFn',
      shouldContain: ['server-theme'],
      shouldNotContain: ['client-theme'],
    },
    {
      env: 'client',
      fn: 'createClientOnlyFn',
      shouldContain: ['client only initialization'],
      shouldNotContain: [],
    },
    {
      env: 'server',
      fn: 'createClientOnlyFn',
      shouldContain: ['throw new Error'],
      shouldNotContain: ['client only initialization'],
    },
  ]

  test.each(testCases)(
    'resolves $fn via re-export chain on $env',
    async ({ env, shouldContain, shouldNotContain }) => {
      const compiler = createCompilerWithVirtualModules(env)
      const code = virtualModules['@third-party/lib']!

      const result = await compiler.compile({
        code,
        id: '@third-party/lib',
      })

      expect(result).not.toBeNull()
      for (const str of shouldContain) {
        expect(result!.code).toContain(str)
      }
      for (const str of shouldNotContain) {
        expect(result!.code).not.toContain(str)
      }
    },
  )

  test('handles deeper re-export chains', async () => {
    // Add another level to the chain
    const deeperVirtualModules: Record<string, string> = {
      ...virtualModules,
      // Another intermediate package
      '@another-intermediate/pkg': `
        export { createIsomorphicFn } from '@tanstack/start-client-core'
      `,
      '@deep-third-party/lib': `
        import { createIsomorphicFn } from '@another-intermediate/pkg'
        export const deepFn = createIsomorphicFn()
          .client(() => 'deep-client')
          .server(() => 'deep-server')
      `,
    }

    const compiler: StartCompiler = new StartCompiler({
      env: 'client',
      envName: 'client',
      root: '/test',
      framework: 'react' as const,
      providerEnvName: 'ssr',
      lookupKinds: new Set(['IsomorphicFn', 'ServerOnlyFn', 'ClientOnlyFn']),
      lookupConfigurations: [],
      getKnownServerFns: () => ({}),
      loadModule: async (id) => {
        const code = deeperVirtualModules[id]
        if (code) {
          compiler.ingestModule({ code, id })
        }
      },
      resolveId: async (id) => {
        return deeperVirtualModules[id] ? id : null
      },
    })

    const result = await compiler.compile({
      code: deeperVirtualModules['@deep-third-party/lib']!,
      id: '@deep-third-party/lib',
    })

    expect(result).not.toBeNull()
    expect(result!.code).toContain('deep-client')
    expect(result!.code).not.toContain('deep-server')
  })

  test.each([
    {
      name: 'named re-export cycle',
      virtualModules: {
        './factory-a': `
          export { createServerOnlyFn } from './factory-b'
        `,
        './factory-b': `
          export { createServerOnlyFn } from './factory-a'
        `,
      },
    },
    {
      name: 'import alias cycle',
      virtualModules: {
        './factory-a': `
          import { createServerOnlyFn } from './factory-b'
          export { createServerOnlyFn }
        `,
        './factory-b': `
          import { createServerOnlyFn } from './factory-a'
          export { createServerOnlyFn }
        `,
      },
    },
    {
      name: 'export-star cycle',
      virtualModules: {
        './factory-a': `
          export * from './factory-b'
        `,
        './factory-b': `
          export * from './factory-a'
        `,
      },
    },
  ])('handles circular import chain: $name', async ({ virtualModules }) => {
    const compiler: StartCompiler = new StartCompiler({
      env: 'server',
      envName: 'ssr',
      root: '/test',
      framework: 'react' as const,
      providerEnvName: 'ssr',
      lookupKinds: new Set(['ServerOnlyFn']),
      lookupConfigurations: [],
      getKnownServerFns: () => ({}),
      loadModule: async (id) => {
        const code = virtualModules[id as keyof typeof virtualModules]
        if (code) {
          compiler.ingestModule({ code, id })
        }
      },
      resolveId: async (id) => {
        return id in virtualModules ? id : null
      },
      mode: 'build',
    })

    const result = await compiler.compile({
      id: 'circular-import-test.ts',
      code: `
        import { createServerOnlyFn } from './factory-a'
        const myFn = createServerOnlyFn(() => 'server-only-value')
      `,
    })

    expect(result).toBeNull()
  })

  test('ingestModule populates module metadata for later resolution', async () => {
    const compiler: StartCompiler = new StartCompiler({
      env: 'server',
      envName: 'ssr',
      root: '/test',
      framework: 'react' as const,
      providerEnvName: 'ssr',
      lookupKinds: new Set(['ServerOnlyFn']),
      lookupConfigurations: [],
      getKnownServerFns: () => ({}),
      loadModule: async () => {},
      resolveId: async (id) => {
        return id === '@tanstack/start-client-core' ? id : null
      },
      mode: 'build',
    })

    compiler.ingestModule({
      id: '@tanstack/start-client-core',
      code: `
        export { createServerOnlyFn } from '@tanstack/start-fn-stubs'
      `,
    })

    const result = await compiler.compile({
      id: 'cached-module-test.ts',
      code: `
        import { createServerOnlyFn } from '@tanstack/start-client-core'
        const myFn = createServerOnlyFn(() => 'cached-server-only-value')
      `,
    })

    expect(result).not.toBeNull()
    expect(result!.code).toContain('cached-server-only-value')
  })

  test('invalidateModule clears cached module resolution state', async () => {
    const virtualModules: Record<string, string> = {
      './factory': `
        export { createServerOnlyFn } from './factory-inner'
      `,
      './factory-inner': `
        export { createServerOnlyFn } from '@tanstack/start-fn-stubs'
      `,
    }

    const compiler: StartCompiler = new StartCompiler({
      env: 'server',
      envName: 'ssr',
      root: '/test',
      framework: 'react' as const,
      providerEnvName: 'ssr',
      lookupKinds: new Set(['ServerOnlyFn', 'ClientOnlyFn']),
      lookupConfigurations: [],
      getKnownServerFns: () => ({}),
      loadModule: async (id) => {
        const code = virtualModules[id]
        if (code) {
          compiler.ingestModule({ code, id })
        }
      },
      resolveId: async (id) => {
        return virtualModules[id] ? id : null
      },
      mode: 'build',
    })

    const source = `
      import { createServerOnlyFn } from './factory'
      const myFn = createServerOnlyFn(() => 'server-only-value')
    `

    const initialResult = await compiler.compile({
      id: 'transitive-invalidation-test.ts',
      code: source,
    })

    expect(initialResult).not.toBeNull()
    expect(initialResult!.code).toContain('server-only-value')
    expect(initialResult!.code).not.toContain('throw new Error')

    virtualModules['./factory-inner'] = `
      export { createClientOnlyFn as createServerOnlyFn } from '@tanstack/start-fn-stubs'
    `

    expect(compiler.invalidateModule('./factory-inner')).toBe(true)

    const updatedResult = await compiler.compile({
      id: 'transitive-invalidation-test.ts',
      code: source,
    })

    expect(updatedResult).not.toBeNull()
    expect(updatedResult!.code).toContain('throw new Error')
    expect(updatedResult!.code).not.toContain('server-only-value')
  })

  test('invalidateModule preserves root lookup metadata while clearing importer memoization', async () => {
    const virtualModules: Record<string, string> = {
      './factory': `
        export { createServerOnlyFn } from './factory-inner'
      `,
      './factory-inner': `
        export { createServerOnlyFn } from '@tanstack/start-fn-stubs'
      `,
    }

    const compiler: StartCompiler = new StartCompiler({
      env: 'server',
      envName: 'ssr',
      root: '/test',
      framework: 'react' as const,
      providerEnvName: 'ssr',
      lookupKinds: new Set(['ServerOnlyFn', 'ClientOnlyFn']),
      lookupConfigurations: [
        {
          libName: '@tanstack/react-start',
          rootExport: 'createServerOnlyFn',
          kind: 'ServerOnlyFn',
        },
        {
          libName: '@tanstack/react-start',
          rootExport: 'createClientOnlyFn',
          kind: 'ClientOnlyFn',
        },
      ],
      getKnownServerFns: () => ({}),
      loadModule: async (id) => {
        const code = virtualModules[id]
        if (code) {
          compiler.ingestModule({ code, id })
        }
      },
      resolveId: async (id) => {
        return virtualModules[id] ? id : null
      },
    })

    const source = `
      import { createServerOnlyFn } from './factory'
      const myFn = createServerOnlyFn(() => 'server-only-value')
    `

    const initialResult = await compiler.compile({
      id: 'memoized-invalidation-test.ts',
      code: source,
    })

    expect(initialResult).not.toBeNull()
    expect(initialResult!.code).toContain('server-only-value')

    virtualModules['./factory-inner'] = `
      export { createClientOnlyFn as createServerOnlyFn } from '@tanstack/start-fn-stubs'
    `

    expect(compiler.invalidateModule('./factory-inner')).toBe(true)

    const updatedResult = await compiler.compile({
      id: 'memoized-invalidation-test.ts',
      code: source,
    })

    expect(updatedResult).not.toBeNull()
    expect(updatedResult!.code).toContain('throw new Error')
    expect(updatedResult!.code).not.toContain('server-only-value')
  })

  test('recompiles aliased env-only direct calls when only server function syntax is detected', async () => {
    const virtualModules: Record<string, string> = {
      './factory': `
        export { createServerOnlyFn } from '@tanstack/start-fn-stubs'
      `,
    }

    const compiler: StartCompiler = new StartCompiler({
      env: 'server',
      envName: 'ssr',
      root: '/test',
      framework: 'react' as const,
      providerEnvName: 'ssr',
      mode: 'build',
      lookupKinds: new Set(['ServerFn', 'ServerOnlyFn', 'ClientOnlyFn']),
      lookupConfigurations: [
        {
          libName: '@tanstack/react-start',
          rootExport: 'createServerFn',
          kind: 'Root',
        },
      ],
      getKnownServerFns: () => ({}),
      loadModule: async (id) => {
        const code = virtualModules[id]
        if (code) {
          compiler.ingestModule({ code, id })
        }
      },
      resolveId: async (id) => {
        return virtualModules[id] ? id : null
      },
    })

    const source = `
      import { createServerFn } from '@tanstack/react-start'
      import { createServerOnlyFn as createServerFnHmrFactory } from './factory'

      const serverOnlyImpl = createServerFnHmrFactory(() => 'server-only-value')

      export const serverFn = createServerFn().handler(async () => {
        return serverOnlyImpl()
      })
    `

    const providerId = 'aliased-env-only-server-fn.ts?tss-serverfn-split'

    const initialResult = await compiler.compile({
      id: providerId,
      code: source,
      detectedKinds: new Set(['ServerFn']),
    })

    expect(initialResult).not.toBeNull()
    expect(initialResult!.code).toContain('server-only-value')
    expect(initialResult!.code).not.toContain('throw new Error')

    virtualModules['./factory'] = `
      export { createClientOnlyFn as createServerOnlyFn } from '@tanstack/start-fn-stubs'
    `

    expect(compiler.invalidateModule('./factory')).toBe(true)

    const updatedResult = await compiler.compile({
      id: providerId,
      code: source,
      detectedKinds: new Set(['ServerFn']),
    })

    expect(updatedResult).not.toBeNull()
    expect(updatedResult!.code).toContain('throw new Error')
    expect(updatedResult!.code).not.toContain('server-only-value')
  })
})

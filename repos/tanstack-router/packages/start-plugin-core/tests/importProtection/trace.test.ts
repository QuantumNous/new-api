import { describe, expect, test } from 'vitest'
import {
  ImportGraph,
  buildTrace,
  formatViolation,
} from '../../src/import-protection/trace'
import type { ViolationInfo } from '../../src/import-protection/trace'

describe('ImportGraph', () => {
  test('addEdge and reverse lookup', () => {
    const graph = new ImportGraph()
    graph.addEdge('/src/secret.server.ts', '/src/edge-a.ts', './secret.server')
    graph.addEdge(
      '/src/edge-a.ts',
      '/src/routes/index.tsx',
      './violations/edge-a',
    )

    const edges = graph.getEdges('/src/secret.server.ts')
    expect(edges).toBeDefined()
    expect(edges!.size).toBe(1)

    const firstEdge = [...edges!][0]!
    expect(firstEdge.importer).toBe('/src/edge-a.ts')
    expect(firstEdge.specifier).toBe('./secret.server')
  })

  test('addEntry marks entries', () => {
    const graph = new ImportGraph()
    graph.addEntry('/src/main.tsx')
    expect(graph.entries.has('/src/main.tsx')).toBe(true)
  })

  test('clear resets everything', () => {
    const graph = new ImportGraph()
    graph.addEdge('/a', '/b', './a')
    graph.addEntry('/b')
    graph.clear()
    expect(graph.reverseEdges.size).toBe(0)
    expect(graph.entries.size).toBe(0)
  })

  test('invalidate removes edges involving a module', () => {
    const graph = new ImportGraph()
    graph.addEdge('/a', '/b', './a')
    graph.addEdge('/c', '/b', './c')
    graph.addEdge('/d', '/a', './d')

    graph.invalidate('/b')

    // Edges where /b is importer should be removed
    const edgesForA = graph.getEdges('/a')
    expect(edgesForA).toBeDefined()
    expect(edgesForA!.size).toBe(0)

    const edgesForC = graph.getEdges('/c')
    expect(edgesForC).toBeDefined()
    expect(edgesForC!.size).toBe(0)

    const edgesForD = graph.getEdges('/d')
    expect(edgesForD).toBeDefined()
    expect(edgesForD!.size).toBe(1)
  })

  test('getEdges returns undefined for unknown ID', () => {
    const graph = new ImportGraph()
    expect(graph.getEdges('/nonexistent')).toBeUndefined()
  })

  test('invalidate also removes reverseEdges entry for the invalidated module', () => {
    const graph = new ImportGraph()
    graph.addEdge('/a', '/b', './a')
    graph.invalidate('/a')
    // /a's own reverse-edge map should be gone
    expect(graph.reverseEdges.has('/a')).toBe(false)
  })

  test('invalidate is safe on unknown ID', () => {
    const graph = new ImportGraph()
    graph.addEdge('/a', '/b', './a')
    graph.invalidate('/unknown')
    expect(graph.getEdges('/a')!.size).toBe(1)
  })

  test('addEdge overwrites specifier for same importer→resolved pair', () => {
    const graph = new ImportGraph()
    graph.addEdge('/a', '/b', './a-old')
    graph.addEdge('/a', '/b', './a-new')
    const edges = graph.getEdges('/a')
    expect(edges!.size).toBe(1)
    expect([...edges!][0]!.specifier).toBe('./a-new')
  })
})

describe('buildTrace', () => {
  test('builds a trace from entry to denied module', () => {
    const graph = new ImportGraph()
    graph.addEntry('/src/main.tsx')

    // main.tsx -> routes/index.tsx -> violations/edge-a.ts -> violations/secret.server.ts
    graph.addEdge('/src/routes/index.tsx', '/src/main.tsx', './routes/index')
    graph.addEdge(
      '/src/violations/edge-a.ts',
      '/src/routes/index.tsx',
      './violations/edge-a',
    )
    graph.addEdge(
      '/src/violations/secret.server.ts',
      '/src/violations/edge-a.ts',
      './secret.server',
    )

    // Build trace starting from edge-a (the importer of the denied module)
    const trace = buildTrace(graph, '/src/violations/edge-a.ts')

    expect(trace.length).toBeGreaterThanOrEqual(2)
    expect(trace[0]!.file).toBe('/src/main.tsx')
    expect(trace[trace.length - 1]!.file).toBe('/src/violations/edge-a.ts')
  })

  test('respects maxDepth', () => {
    const graph = new ImportGraph()
    graph.addEntry('/entry')

    // Chain: /entry -> /a -> /b -> /c -> /d -> /e
    graph.addEdge('/a', '/entry', './a')
    graph.addEdge('/b', '/a', './b')
    graph.addEdge('/c', '/b', './c')
    graph.addEdge('/d', '/c', './d')
    graph.addEdge('/e', '/d', './e')

    const trace = buildTrace(graph, '/e', 2)
    expect(trace.length).toBeLessThanOrEqual(4)
  })

  test('handles single node with no importers', () => {
    const graph = new ImportGraph()
    const trace = buildTrace(graph, '/orphan')
    expect(trace.length).toBe(1)
    expect(trace[0]!.file).toBe('/orphan')
  })

  test('treats node with no reverse-edge map entry as entry', () => {
    const graph = new ImportGraph()
    graph.addEdge('/b', '/a', './b')

    const trace = buildTrace(graph, '/b')
    expect(trace[0]!.file).toBe('/a')
    expect(trace[trace.length - 1]!.file).toBe('/b')
  })

  test('treats node with empty importers map as entry', () => {
    const graph = new ImportGraph()
    graph.addEdge('/a', '/b', './a')
    graph.addEdge('/b', '/a', './b')
    graph.invalidate('/a')

    graph.addEdge('/b', '/a', './b')

    const trace = buildTrace(graph, '/b')
    expect(trace[0]!.file).toBe('/a')
    expect(trace[trace.length - 1]!.file).toBe('/b')
  })

  test('prefers explicit entry over implicit no-importers entry', () => {
    const graph = new ImportGraph()
    graph.addEntry('/entry') // /entry -> /mid -> /leaf
    graph.addEdge('/mid', '/entry', './mid')
    graph.addEdge('/leaf', '/mid', './leaf')

    const trace = buildTrace(graph, '/leaf')
    expect(trace[0]!.file).toBe('/entry')
    expect(trace[trace.length - 1]!.file).toBe('/leaf')
  })

  test('handles cycles without infinite loop', () => {
    const graph = new ImportGraph()
    graph.addEntry('/entry')
    graph.addEdge('/a', '/entry', './a')
    graph.addEdge('/b', '/a', './b')
    graph.addEdge('/a', '/b', './a') // cycle: /a -> /b -> /a

    const trace = buildTrace(graph, '/b')
    // Should terminate and produce a trace ending at /b
    expect(trace[trace.length - 1]!.file).toBe('/b')
    expect(trace.length).toBeGreaterThanOrEqual(2)
  })

  test('handles fully disconnected node (no edges at all)', () => {
    const graph = new ImportGraph()
    const trace = buildTrace(graph, '/island')
    expect(trace).toEqual([{ file: '/island', specifier: undefined }])
  })
})

describe('formatViolation', () => {
  test('formats specifier violation correctly', () => {
    const info: ViolationInfo = {
      env: 'client',
      envType: 'client',
      type: 'specifier',
      behavior: 'error',
      pattern: '@tanstack/react-start/server',
      specifier: '@tanstack/react-start/server',
      importer: '/project/src/routes/index.tsx',
      trace: [
        { file: '/project/src/main.tsx' },
        { file: '/project/src/routes/index.tsx', specifier: './routes/index' },
      ],
    }

    const formatted = formatViolation(info, '/project')

    expect(formatted).toContain('Import denied in client environment')
    expect(formatted).toContain('specifier pattern')
    expect(formatted).toContain('@tanstack/react-start/server')
    expect(formatted).toContain('src/routes/index.tsx')
    expect(formatted).toContain('Trace:')
    expect(formatted).toContain('(entry)')
  })

  test('formats file violation correctly', () => {
    const info: ViolationInfo = {
      env: 'client',
      envType: 'client',
      type: 'file',
      behavior: 'mock',
      pattern: '**/*.server.*',
      specifier: './secret.server',
      importer: '/project/src/edge-a.ts',
      resolved: '/project/src/secret.server.ts',
      trace: [],
    }

    const formatted = formatViolation(info, '/project')

    expect(formatted).toContain('file pattern')
    expect(formatted).toContain('**/*.server.*')
    expect(formatted).toContain('src/secret.server.ts')
    expect(formatted).toContain('Suggestions:')
    expect(formatted).toContain('createServerFn().handler')
    expect(formatted).toContain('createServerOnlyFn')
    expect(formatted).toContain('createIsomorphicFn')
    expect(formatted).toContain('Move the server-only import')
  })

  test('formats marker violation correctly', () => {
    const info: ViolationInfo = {
      env: 'client',
      envType: 'client',
      type: 'marker',
      behavior: 'error',
      specifier: '@tanstack/react-start/server-only',
      importer: '/project/src/routes/index.tsx',
      trace: [],
    }

    const formatted = formatViolation(info, '/project')

    expect(formatted).toContain('marker')
    expect(formatted).toContain('restricted to the opposite environment')
    expect(formatted).toContain('Suggestions:')
    expect(formatted).toContain('createServerFn')
  })

  test('client-in-server violation includes client-only suggestions', () => {
    const info: ViolationInfo = {
      env: 'ssr',
      envType: 'server',
      type: 'file',
      behavior: 'mock',
      pattern: '**/*.client.*',
      specifier: './browser-api.client',
      importer: '/project/src/routes/page.tsx',
      resolved: '/project/src/browser-api.client.ts',
      trace: [],
    }

    const formatted = formatViolation(info, '/project')

    expect(formatted).toContain('Suggestions:')
    expect(formatted).toContain('createClientOnlyFn')
    expect(formatted).toContain('createIsomorphicFn')
    expect(formatted).toContain('Move the client-only import')
    expect(formatted).not.toContain('<ClientOnly')
  })

  test('env is printed with env type suffix', () => {
    const info: ViolationInfo = {
      env: 'ssr',
      envType: 'server',
      type: 'specifier',
      behavior: 'error',
      pattern: /^node:/,
      specifier: 'node:fs',
      importer: '/project/src/routes/page.tsx',
      trace: [],
    }

    const formatted = formatViolation(info, '/project')
    expect(formatted).toContain('Import denied in server environment')
  })

  test('client-in-server violation with JSX suggests ClientOnly', () => {
    const info: ViolationInfo = {
      env: 'ssr',
      envType: 'server',
      type: 'file',
      behavior: 'mock',
      pattern: '**/*.client.*',
      specifier: './browser-api.client',
      importer: '/project/src/routes/page.tsx',
      resolved: '/project/src/browser-api.client.ts',
      trace: [],
      snippet: {
        lines: [
          '     15 |     <div>',
          '     16 |       <h1>Page</h1>',
          '  >  17 |       <p>{getBrowserTitle()}</p>',
          '         |           ^',
          '     18 |     </div>',
        ],
        highlightLine: 17,
        location: '/project/src/routes/page.tsx:17:11',
      },
    }

    const formatted = formatViolation(info, '/project')

    expect(formatted).toContain('Suggestions:')
    expect(formatted).toContain(
      '<ClientOnly fallback={<Loading />}>...</ClientOnly>',
    )
    expect(formatted).toContain('createClientOnlyFn')
    expect(formatted).toContain('createIsomorphicFn')
  })

  test('specifier violation in client env gets server-in-client suggestions', () => {
    const info: ViolationInfo = {
      env: 'client',
      envType: 'client',
      type: 'specifier',
      behavior: 'error',
      pattern: '@tanstack/react-start/server',
      specifier: '@tanstack/react-start/server',
      importer: '/project/src/routes/index.tsx',
      trace: [],
    }

    const formatted = formatViolation(info, '/project')

    expect(formatted).toContain('Suggestions:')
    expect(formatted).toContain('createServerFn')
    expect(formatted).toContain('createServerOnlyFn')
    expect(formatted).toContain('createIsomorphicFn')
  })

  test('marker violation in server env gets client-in-server suggestions', () => {
    const info: ViolationInfo = {
      env: 'ssr',
      envType: 'server',
      type: 'marker',
      behavior: 'error',
      specifier: '@tanstack/react-start/client-only',
      importer: '/project/src/routes/page.tsx',
      trace: [],
    }

    const formatted = formatViolation(info, '/project')

    expect(formatted).toContain('Suggestions:')
    expect(formatted).toContain('createClientOnlyFn')
    expect(formatted).toContain('createIsomorphicFn')
  })

  test('relativizes absolute-path specifiers in Import line and trace steps', () => {
    // When an alias (e.g. ~/) is resolved by a transform plugin before
    // resolveId, the specifier stored in the graph can be an absolute path.
    // formatViolation should display it as a root-relative path.
    const info: ViolationInfo = {
      env: 'client',
      envType: 'client',
      type: 'file',
      behavior: 'error',
      pattern: '**/client/**',
      specifier: '/project/src/utils/prisma',
      importer: '/project/src/routes/signup.tsx',
      resolved: '/project/src/utils/prisma.ts',
      trace: [
        { file: '/project/src/routes/signup.tsx' },
        {
          file: '/project/src/routes/signup.tsx',
          specifier: '/project/src/utils/prisma',
        },
      ],
    }

    const formatted = formatViolation(info, '/project')

    expect(formatted).toContain('Import: "src/utils/prisma"')
    expect(formatted).not.toContain('Import: "/project/src/utils/prisma"')

    expect(formatted).toContain('(import "src/utils/prisma")')
    expect(formatted).not.toContain('(import "/project/src/utils/prisma")')
  })

  test('leaves non-absolute specifiers unchanged', () => {
    const info: ViolationInfo = {
      env: 'client',
      envType: 'client',
      type: 'specifier',
      behavior: 'error',
      pattern: '@tanstack/react-start/server',
      specifier: '@tanstack/react-start/server',
      importer: '/project/src/routes/index.tsx',
      trace: [
        {
          file: '/project/src/routes/index.tsx',
          specifier: './secret.server',
        },
      ],
    }

    const formatted = formatViolation(info, '/project')

    expect(formatted).toContain('Import: "@tanstack/react-start/server"')
    expect(formatted).toContain('(import "./secret.server")')
  })
})

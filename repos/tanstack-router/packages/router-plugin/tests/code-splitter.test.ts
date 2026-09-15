import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseAst } from '@tanstack/router-utils'

import {
  buildDeclarationMap,
  buildDependencyGraph,
  collectIdentifiersFromNode,
  collectLocalBindingsFromStatement,
  collectModuleLevelRefsFromNode,
  compileCodeSplitReferenceRoute,
  compileCodeSplitSharedRoute,
  compileCodeSplitVirtualRoute,
  computeSharedBindings,
  expandDestructuredDeclarations,
  expandSharedDestructuredDeclarators,
  expandTransitively,
  removeBindingsDependingOnRoute,
} from '../src/core/code-splitter/compilers'
import { createIdentifier } from '@tanstack/router-utils'
import { defaultCodeSplitGroupings } from '../src/core/constants'
import { frameworks } from './constants'
import type { CodeSplitGroupings } from '../src/core/constants'

function getFrameworkDir(framework: string) {
  const files = path.resolve(
    __dirname,
    `./code-splitter/test-files/${framework}`,
  )
  const snapshots = path.resolve(
    __dirname,
    `./code-splitter/snapshots/${framework}`,
  )
  return { files, snapshots }
}

const testGroups: Array<{ name: string; groupings: CodeSplitGroupings }> = [
  {
    name: '1-default',
    groupings: defaultCodeSplitGroupings,
  },
  {
    name: '2-components-combined-loader-separate',
    groupings: [
      ['loader'],
      ['component', 'pendingComponent', 'errorComponent', 'notFoundComponent'],
    ],
  },
  {
    name: '3-all-combined-errorComponent-separate',
    groupings: [
      ['loader', 'component', 'pendingComponent', 'notFoundComponent'],
      ['errorComponent'],
    ],
  },
]

describe('code-splitter works', () => {
  describe.each(frameworks)('FRAMEWORK=%s', (framework) => {
    describe.each(testGroups)(
      'SPLIT_GROUP=$name',
      async ({ groupings: grouping, name: groupName }) => {
        const dirs = getFrameworkDir(framework)
        const filenames = await readdir(dirs.files)

        it.each(filenames)(
          `should compile "reference" for "%s"`,
          async (filename) => {
            const file = await readFile(path.join(dirs.files, filename))
            const code = file.toString()

            const sharedBindings = computeSharedBindings({
              code,
              codeSplitGroupings: grouping,
            })

            const compileResult = compileCodeSplitReferenceRoute({
              code,
              filename,
              id: filename,
              addHmr: false,
              codeSplitGroupings: grouping,
              targetFramework: framework,
              sharedBindings:
                sharedBindings.size > 0 ? sharedBindings : undefined,
            })

            await expect(compileResult?.code || code).toMatchFileSnapshot(
              path.join(dirs.snapshots, groupName, filename),
            )
          },
        )

        it.each(filenames)(
          `should compile "virtual" for "%s"`,
          async (filename) => {
            const file = await readFile(path.join(dirs.files, filename))
            const code = file.toString()

            const sharedBindings = computeSharedBindings({
              code,
              codeSplitGroupings: grouping,
            })

            for (const targets of grouping) {
              const ident = createIdentifier(targets)

              const splitResult = compileCodeSplitVirtualRoute({
                code,
                filename: `${filename}?${ident}`,
                splitTargets: targets,
                sharedBindings:
                  sharedBindings.size > 0 ? sharedBindings : undefined,
              })

              const snapshotFilename = path.join(
                dirs.snapshots,
                groupName,
                `${filename.replace('.tsx', '')}@${ident}.tsx`,
              )
              await expect(splitResult.code).toMatchFileSnapshot(
                snapshotFilename,
              )
            }
          },
        )

        it.each(filenames)(
          `should compile "shared" for "%s"`,
          async (filename) => {
            const file = await readFile(path.join(dirs.files, filename))
            const code = file.toString()

            const sharedBindings = computeSharedBindings({
              code,
              codeSplitGroupings: grouping,
            })

            const snapshotFilename = path.join(
              dirs.snapshots,
              groupName,
              `${filename.replace('.tsx', '')}@shared.tsx`,
            )

            if (sharedBindings.size === 0) {
              // No shared module — snapshot should be empty string
              await expect('').toMatchFileSnapshot(snapshotFilename)
              return
            }

            const sharedResult = compileCodeSplitSharedRoute({
              code,
              sharedBindings,
              filename: `${filename}?tsr-shared=1`,
            })

            await expect(sharedResult.code).toMatchFileSnapshot(
              snapshotFilename,
            )
          },
        )
      },
    )
  })
})

describe('computeSharedBindings fast paths', () => {
  it('returns empty when only one split group is present (default groupings)', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const shared = 42
export const Route = createFileRoute('/')({
  component: () => shared,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultCodeSplitGroupings,
    })
    expect(result.size).toBe(0)
  })

  it('returns empty when all split props are in the same group', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const shared = 42
export const Route = createFileRoute('/')({
  component: () => shared,
  loader: () => shared,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: [['component', 'loader']],
    })
    expect(result.size).toBe(0)
  })

  it('returns empty when all route option values are undefined', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/')({
  component: undefined,
  errorComponent: undefined,
  notFoundComponent: undefined,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultCodeSplitGroupings,
    })
    expect(result.size).toBe(0)
  })

  it('returns empty when no local bindings exist (only imports + Route)', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/')({
  component: () => <div>hello</div>,
  errorComponent: () => <div>error</div>,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultCodeSplitGroupings,
    })
    expect(result.size).toBe(0)
  })

  it('does not fast-path when there is a non-split and a split group', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const shared = 42
export const Route = createFileRoute('/')({
  component: () => shared,
  beforeLoad: () => shared,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultCodeSplitGroupings,
    })
    expect(result).toContain('shared')
  })
})

// ============================================================================
// LAYER 1: Algebraic Property Tests on Helper Functions
//
// These test that the pure graph/set functions obey mathematical contracts
// independent of any particular route file.
// ============================================================================

describe('expandTransitively', () => {
  it('is idempotent — running twice yields the same result as once', () => {
    // Graph: a -> b -> c, d -> b
    const depGraph = new Map<string, Set<string>>([
      ['a', new Set(['b'])],
      ['b', new Set(['c'])],
      ['c', new Set()],
      ['d', new Set(['b'])],
    ])

    const first = new Set(['a'])
    expandTransitively(first, depGraph)
    const afterFirst = new Set(first)

    expandTransitively(first, depGraph)
    expect(first).toEqual(afterFirst)
  })

  it('is monotone — larger initial set produces equal or larger result', () => {
    const depGraph = new Map<string, Set<string>>([
      ['a', new Set(['c'])],
      ['b', new Set(['d'])],
      ['c', new Set()],
      ['d', new Set()],
    ])

    const small = new Set(['a'])
    expandTransitively(small, depGraph)

    const large = new Set(['a', 'b'])
    expandTransitively(large, depGraph)

    for (const item of small) {
      expect(large.has(item)).toBe(true)
    }
  })

  it('handles cycles without infinite loops', () => {
    const depGraph = new Map<string, Set<string>>([
      ['a', new Set(['b'])],
      ['b', new Set(['c'])],
      ['c', new Set(['a'])],
    ])

    const set = new Set(['a'])
    expandTransitively(set, depGraph)
    expect(set).toEqual(new Set(['a', 'b', 'c']))
  })

  it('is a no-op when there are no dependencies', () => {
    const depGraph = new Map<string, Set<string>>([
      ['a', new Set()],
      ['b', new Set()],
    ])

    const set = new Set(['a'])
    expandTransitively(set, depGraph)
    expect(set).toEqual(new Set(['a']))
  })

  it('handles missing entries in the graph gracefully', () => {
    const depGraph = new Map<string, Set<string>>()
    const set = new Set(['unknown'])
    expandTransitively(set, depGraph)
    expect(set).toEqual(new Set(['unknown']))
  })
})

describe('buildDependencyGraph', () => {
  it('result keys are a subset of localBindings', () => {
    const code = `
const a = 1
const b = a + 1
const c = 2
`
    const ast = parseAst({ code })
    const declMap = buildDeclarationMap(ast)
    const localBindings = new Set(['a', 'b', 'c'])
    const graph = buildDependencyGraph(declMap, localBindings)

    for (const key of graph.keys()) {
      expect(localBindings.has(key)).toBe(true)
    }
  })

  it('dependency values are also subsets of localBindings', () => {
    const code = `
import { external } from 'somewhere'
const a = external
const b = a + 1
`
    const ast = parseAst({ code })
    const declMap = buildDeclarationMap(ast)
    const localBindings = new Set(['a', 'b'])
    const graph = buildDependencyGraph(declMap, localBindings)

    for (const deps of graph.values()) {
      for (const dep of deps) {
        expect(localBindings.has(dep)).toBe(true)
      }
    }
  })

  it('captures direct references correctly', () => {
    const code = `
const x = 10
const y = x + 1
`
    const ast = parseAst({ code })
    const declMap = buildDeclarationMap(ast)
    const localBindings = new Set(['x', 'y'])
    const graph = buildDependencyGraph(declMap, localBindings)

    expect(graph.get('y')).toEqual(new Set(['x']))
    expect(graph.get('x')?.size ?? 0).toBe(0)
  })
})

describe('removeBindingsDependingOnRoute', () => {
  it('removes bindings that directly reference Route', () => {
    const depGraph = new Map<string, Set<string>>([
      ['helper', new Set(['Route'])],
      ['standalone', new Set()],
      ['Route', new Set()],
    ])

    const shared = new Set(['helper', 'standalone'])
    removeBindingsDependingOnRoute(shared, depGraph)

    expect(shared.has('helper')).toBe(false)
    expect(shared.has('standalone')).toBe(true)
  })

  it('removes bindings that transitively reference Route', () => {
    const depGraph = new Map<string, Set<string>>([
      ['a', new Set(['b'])],
      ['b', new Set(['Route'])],
      ['c', new Set()],
      ['Route', new Set()],
    ])

    const shared = new Set(['a', 'c'])
    removeBindingsDependingOnRoute(shared, depGraph)

    expect(shared.has('a')).toBe(false)
    expect(shared.has('c')).toBe(true)
  })

  it('is a no-op when nothing depends on Route', () => {
    const depGraph = new Map<string, Set<string>>([
      ['a', new Set(['b'])],
      ['b', new Set()],
      ['Route', new Set()],
    ])

    const shared = new Set(['a', 'b'])
    const before = new Set(shared)
    removeBindingsDependingOnRoute(shared, depGraph)

    expect(shared).toEqual(before)
  })
})

describe('expandDestructuredDeclarations', () => {
  it('is idempotent', () => {
    const code = `const { a, b } = fn()`
    const ast = parseAst({ code })

    const shared = new Set(['a'])
    expandDestructuredDeclarations(ast, shared)
    const afterFirst = new Set(shared)

    expandDestructuredDeclarations(ast, shared)
    expect(shared).toEqual(afterFirst)
  })

  it('pulls all siblings when one destructured binding is shared', () => {
    const code = `const { a, b, c } = fn()`
    const ast = parseAst({ code })

    const shared = new Set(['b'])
    expandDestructuredDeclarations(ast, shared)

    expect(shared).toEqual(new Set(['a', 'b', 'c']))
  })

  it('does not affect non-destructured declarations', () => {
    const code = `
const x = 1
const y = 2
`
    const ast = parseAst({ code })

    const shared = new Set(['x'])
    expandDestructuredDeclarations(ast, shared)

    expect(shared).toEqual(new Set(['x']))
  })
})

describe('collectLocalBindingsFromStatement', () => {
  it('collects variable declaration names', () => {
    const code = `const x = 1`
    const ast = parseAst({ code })
    const bindings = new Set<string>()
    collectLocalBindingsFromStatement(ast.program.body[0]!, bindings)
    expect(bindings).toEqual(new Set(['x']))
  })

  it('collects function declaration names', () => {
    const code = `function foo() {}`
    const ast = parseAst({ code })
    const bindings = new Set<string>()
    collectLocalBindingsFromStatement(ast.program.body[0]!, bindings)
    expect(bindings).toEqual(new Set(['foo']))
  })

  it('collects class declaration names', () => {
    const code = `class MyClass {}`
    const ast = parseAst({ code })
    const bindings = new Set<string>()
    collectLocalBindingsFromStatement(ast.program.body[0]!, bindings)
    expect(bindings).toEqual(new Set(['MyClass']))
  })

  it('collects exported declaration names', () => {
    const code = `export const a = 1`
    const ast = parseAst({ code })
    const bindings = new Set<string>()
    collectLocalBindingsFromStatement(ast.program.body[0]!, bindings)
    expect(bindings).toEqual(new Set(['a']))
  })

  it('collects destructured binding names', () => {
    const code = `const { a, b } = obj`
    const ast = parseAst({ code })
    const bindings = new Set<string>()
    collectLocalBindingsFromStatement(ast.program.body[0]!, bindings)
    expect(bindings).toEqual(new Set(['a', 'b']))
  })
})

// ============================================================================
// LAYER 2: Invariant Tests on computeSharedBindings
//
// These verify the core "contracts" of the shared bindings computation:
// - Route is never extracted
// - Results are always real local bindings
// - Destructured cohesion holds
// - Transitive dependencies are included
// - Route-dependent bindings are excluded
// ============================================================================

describe('computeSharedBindings invariants', () => {
  const defaultGroupings = defaultCodeSplitGroupings

  function getLocalBindings(code: string): Set<string> {
    const ast = parseAst({ code })
    const bindings = new Set<string>()
    for (const stmt of ast.program.body) {
      collectLocalBindingsFromStatement(stmt, bindings)
    }
    bindings.delete('Route')
    return bindings
  }

  it('INVARIANT: Route is never in the shared set', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const shared = 42
export const Route = createFileRoute('/')({
  component: () => shared,
  beforeLoad: () => shared,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    expect(result.has('Route')).toBe(false)
  })

  it('INVARIANT: all results are actual local bindings from the source', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
import { external } from 'somewhere'
const config = { url: external, timeout: 5000 }
const fetcher = (path) => fetch(config.url + path)
export const Route = createFileRoute('/')({
  loader: () => fetcher('/data'),
  component: () => <div>{config.timeout}</div>,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    const localBindings = getLocalBindings(code)

    for (const name of result) {
      expect(localBindings.has(name)).toBe(true)
    }
  })

  it('INVARIANT: imports are never in the shared set', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
import { helper } from './utils'
export const Route = createFileRoute('/')({
  loader: () => helper(),
  component: () => <div>{helper()}</div>,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    expect(result.has('helper')).toBe(false)
  })

  it('INVARIANT: destructured siblings are either all shared or none shared', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const { a, b, c } = createHelpers()
export const Route = createFileRoute('/')({
  loader: () => a,
  component: () => <div>{b}</div>,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })

    // If any destructured sibling is shared, all must be
    const siblings = ['a', 'b', 'c']
    const sharedSiblings = siblings.filter((s) => result.has(s))
    if (sharedSiblings.length > 0) {
      expect(sharedSiblings.length).toBe(siblings.length)
    }
  })

  it('INVARIANT: transitive dependencies of shared bindings are also shared', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const BASE = 'https://api.example.com'
const config = { url: BASE }
const fetcher = () => fetch(config.url)
export const Route = createFileRoute('/')({
  loader: () => fetcher(),
  component: () => <div>{config.url}</div>,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })

    // If config is shared (referenced by both loader via fetcher and component directly),
    // then BASE (which config depends on) should also be shared
    if (result.has('config')) {
      expect(result.has('BASE')).toBe(true)
    }
  })

  it('INVARIANT: bindings depending on Route are excluded from shared', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const HEADER = 'Page'
function usePageTitle() {
  return HEADER + ' - ' + Route.fullPath
}
export const Route = createFileRoute('/about')({
  loader: () => usePageTitle(),
  component: () => <div>{usePageTitle()}</div>,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })

    // usePageTitle references Route, so it must NOT be shared
    expect(result.has('usePageTitle')).toBe(false)
    // HEADER is only referenced by usePageTitle which depends on Route,
    // so HEADER should also not be shared (unless it has other references)
  })

  it('INVARIANT: single-group-only bindings are never shared', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const loaderOnly = () => fetch('/api')
const componentOnly = () => <span>hi</span>
const shared = 42
export const Route = createFileRoute('/')({
  loader: () => { loaderOnly(); return shared },
  component: () => <div>{componentOnly()} {shared}</div>,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })

    // loaderOnly is only used by loader (non-split), should NOT be shared
    expect(result.has('loaderOnly')).toBe(false)
    // componentOnly is only used by component (split), should NOT be shared
    expect(result.has('componentOnly')).toBe(false)
    // shared IS used by both groups
    expect(result.has('shared')).toBe(true)
  })

  it('INVARIANT: empty result for unsplittable routes (createRootRoute)', () => {
    const code = `
import { createRootRoute } from '@tanstack/react-router'
const shared = 42
export const Route = createRootRoute({
  component: () => <div>{shared}</div>,
  beforeLoad: () => shared,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    expect(result.size).toBe(0)
  })

  it('INVARIANT: result is stable across multiple calls with same input', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const shared = { name: 'test' }
export const Route = createFileRoute('/')({
  loader: () => shared.name,
  component: () => <div>{shared.name}</div>,
})
`
    const opts = { code, codeSplitGroupings: defaultGroupings }
    const result1 = computeSharedBindings(opts)
    const result2 = computeSharedBindings(opts)
    const result3 = computeSharedBindings(opts)

    expect(result1).toEqual(result2)
    expect(result2).toEqual(result3)
  })
})

// ============================================================================
// LAYER 3: Small-Scope Exhaustive Tests
//
// Inspired by Alloy's "small scope hypothesis" — most bugs show up in small
// counterexamples. We exhaustively test all combinations of:
// - binding declaration types (const, function, class)
// - route property configurations (loader+component, loader+errorComponent, etc.)
// - split grouping configurations
// ============================================================================

describe('small-scope exhaustive: computeSharedBindings', () => {
  // Helper to generate a route file with specific binding configurations
  function makeRouteCode(opts: {
    bindings: Array<{ name: string; kind: 'const' | 'function' | 'class' }>
    loaderRefs: Array<string>
    componentRefs: Array<string>
    errorComponentRefs?: Array<string>
    beforeLoadRefs?: Array<string>
  }): string {
    const bindingDecls = opts.bindings
      .map((b) => {
        switch (b.kind) {
          case 'const':
            return `const ${b.name} = 42`
          case 'function':
            return `function ${b.name}() { return 42 }`
          case 'class':
            return `class ${b.name} { value = 42 }`
        }
      })
      .join('\n')

    const loaderBody =
      opts.loaderRefs.length > 0
        ? opts.loaderRefs.map((r) => `${r}`).join('; ')
        : '42'

    const componentBody =
      opts.componentRefs.length > 0
        ? opts.componentRefs.map((r) => `{${r}}`).join('')
        : 'hello'

    const props: Array<string> = [
      `  loader: () => { return ${loaderBody} }`,
      `  component: () => <div>${componentBody}</div>`,
    ]

    if (opts.errorComponentRefs) {
      const body =
        opts.errorComponentRefs.length > 0
          ? opts.errorComponentRefs.map((r) => `{${r}}`).join('')
          : 'error'
      props.push(`  errorComponent: () => <div>${body}</div>`)
    }

    if (opts.beforeLoadRefs) {
      const body =
        opts.beforeLoadRefs.length > 0
          ? opts.beforeLoadRefs.map((r) => `${r}`).join('; ')
          : '42'
      props.push(`  beforeLoad: () => { return ${body} }`)
    }

    return `
import { createFileRoute } from '@tanstack/react-router'
${bindingDecls}
export const Route = createFileRoute('/')({
${props.join(',\n')}
})
`
  }

  // Exhaustively test 1-binding scenarios with all grouping configs
  const groupingConfigs: Array<{
    name: string
    groupings: CodeSplitGroupings
  }> = [
    { name: 'default', groupings: defaultCodeSplitGroupings },
    {
      name: 'loader+components-combined',
      groupings: [
        ['loader'],
        [
          'component',
          'pendingComponent',
          'errorComponent',
          'notFoundComponent',
        ],
      ],
    },
  ]

  const bindingKinds = ['const', 'function', 'class'] as const

  describe('single binding × all property combinations', () => {
    // For each binding kind × each grouping × each reference pattern,
    // verify invariants hold
    for (const kind of bindingKinds) {
      for (const { name: groupName, groupings } of groupingConfigs) {
        // Pattern: binding used only by loader (non-split) → never shared
        it(`${kind} used only by loader [${groupName}] → not shared`, () => {
          const code = makeRouteCode({
            bindings: [{ name: 'x', kind }],
            loaderRefs: ['x'],
            componentRefs: [],
          })
          const result = computeSharedBindings({
            code,
            codeSplitGroupings: groupings,
          })
          expect(result.has('x')).toBe(false)
        })

        // Pattern: binding used only by component (split) → never shared
        it(`${kind} used only by component [${groupName}] → not shared`, () => {
          const code = makeRouteCode({
            bindings: [{ name: 'x', kind }],
            loaderRefs: [],
            componentRefs: ['x'],
          })
          const result = computeSharedBindings({
            code,
            codeSplitGroupings: groupings,
          })
          expect(result.has('x')).toBe(false)
        })

        // Pattern: binding used by both loader AND component → shared
        it(`${kind} used by loader+component [${groupName}] → shared`, () => {
          const code = makeRouteCode({
            bindings: [{ name: 'x', kind }],
            loaderRefs: ['x'],
            componentRefs: ['x'],
          })
          const result = computeSharedBindings({
            code,
            codeSplitGroupings: groupings,
          })
          expect(result.has('x')).toBe(true)
        })

        // Pattern: binding used by component AND beforeLoad (non-split) → shared
        it(`${kind} used by component+beforeLoad [${groupName}] → shared`, () => {
          const code = makeRouteCode({
            bindings: [{ name: 'x', kind }],
            loaderRefs: [],
            componentRefs: ['x'],
            beforeLoadRefs: ['x'],
          })
          const result = computeSharedBindings({
            code,
            codeSplitGroupings: groupings,
          })
          expect(result.has('x')).toBe(true)
        })
      }
    }
  })

  describe('two bindings × cross-group references', () => {
    for (const { name: groupName, groupings } of groupingConfigs) {
      // Both bindings in same group → neither shared
      it(`both in loader only [${groupName}] → neither shared`, () => {
        const code = makeRouteCode({
          bindings: [
            { name: 'a', kind: 'const' },
            { name: 'b', kind: 'const' },
          ],
          loaderRefs: ['a', 'b'],
          componentRefs: [],
        })
        const result = computeSharedBindings({
          code,
          codeSplitGroupings: groupings,
        })
        expect(result.has('a')).toBe(false)
        expect(result.has('b')).toBe(false)
      })

      // One binding per group → neither shared
      it(`one per group, no overlap [${groupName}] → neither shared`, () => {
        const code = makeRouteCode({
          bindings: [
            { name: 'a', kind: 'const' },
            { name: 'b', kind: 'const' },
          ],
          loaderRefs: ['a'],
          componentRefs: ['b'],
        })
        const result = computeSharedBindings({
          code,
          codeSplitGroupings: groupings,
        })
        expect(result.has('a')).toBe(false)
        expect(result.has('b')).toBe(false)
      })

      // Both in both groups → both shared
      it(`both in both groups [${groupName}] → both shared`, () => {
        const code = makeRouteCode({
          bindings: [
            { name: 'a', kind: 'const' },
            { name: 'b', kind: 'const' },
          ],
          loaderRefs: ['a', 'b'],
          componentRefs: ['a', 'b'],
        })
        const result = computeSharedBindings({
          code,
          codeSplitGroupings: groupings,
        })
        expect(result.has('a')).toBe(true)
        expect(result.has('b')).toBe(true)
      })

      // One shared, one not → exactly one shared
      it(`one in both groups, one in one [${groupName}] → only cross-group is shared`, () => {
        const code = makeRouteCode({
          bindings: [
            { name: 'a', kind: 'const' },
            { name: 'b', kind: 'const' },
          ],
          loaderRefs: ['a'],
          componentRefs: ['a', 'b'],
        })
        const result = computeSharedBindings({
          code,
          codeSplitGroupings: groupings,
        })
        expect(result.has('a')).toBe(true)
        expect(result.has('b')).toBe(false)
      })
    }
  })

  describe('transitive dependency chains', () => {
    it('A depends on B, both used by different groups → both shared', () => {
      const code = `
import { createFileRoute } from '@tanstack/react-router'
const BASE = 'https://api.example.com'
const config = { url: BASE }
export const Route = createFileRoute('/')({
  loader: () => config.url,
  component: () => <div>{config.url}</div>,
})
`
      const result = computeSharedBindings({
        code,
        codeSplitGroupings: defaultCodeSplitGroupings,
      })
      // config is directly used by both groups → shared
      expect(result.has('config')).toBe(true)
      // BASE is a dep of config → also shared
      expect(result.has('BASE')).toBe(true)
    })

    it('A depends on B depends on C, A used cross-group → all three shared', () => {
      const code = `
import { createFileRoute } from '@tanstack/react-router'
const c = 'deep'
const b = c + '-value'
const a = b + '-final'
export const Route = createFileRoute('/')({
  loader: () => a,
  component: () => <div>{a}</div>,
})
`
      const result = computeSharedBindings({
        code,
        codeSplitGroupings: defaultCodeSplitGroupings,
      })
      expect(result.has('a')).toBe(true)
      expect(result.has('b')).toBe(true)
      expect(result.has('c')).toBe(true)
    })

    it('diamond dependency: A→B, A→C, B→D, C→D → all shared when A is cross-group', () => {
      const code = `
import { createFileRoute } from '@tanstack/react-router'
const D = 42
const B = D + 1
const C = D + 2
const A = B + C
export const Route = createFileRoute('/')({
  loader: () => A,
  component: () => <div>{A}</div>,
})
`
      const result = computeSharedBindings({
        code,
        codeSplitGroupings: defaultCodeSplitGroupings,
      })
      expect(result.has('A')).toBe(true)
      expect(result.has('B')).toBe(true)
      expect(result.has('C')).toBe(true)
      expect(result.has('D')).toBe(true)
    })
  })

  describe('meta-invariant: all fixture files satisfy core contracts', () => {
    const sharedFixtures = [
      'shared-variable.tsx',
      'shared-class.tsx',
      'shared-function.tsx',
      'shared-exported.tsx',
      'shared-indirect-ref.tsx',
      'shared-none.tsx',
      'shared-destructured.tsx',
      'shared-destructured-export.tsx',
      'shared-imported-binding.tsx',
      'shared-jsx-component-ref.tsx',
      'shared-referencing-route.tsx',
      'shared-transitive.tsx',
      'shared-with-side-effect.tsx',
    ]

    // Run invariants across ALL existing test fixtures — like a conformance suite
    it.each(sharedFixtures)(
      'fixture "%s" satisfies: Route excluded, results ⊆ localBindings',
      async (filename) => {
        const file = await readFile(
          path.join(__dirname, `./code-splitter/test-files/react/${filename}`),
        )
        const code = file.toString()

        const result = computeSharedBindings({
          code,
          codeSplitGroupings: defaultCodeSplitGroupings,
        })

        // Contract 1: Route is never shared
        expect(result.has('Route')).toBe(false)

        // Contract 2: all results are real local bindings
        const ast = parseAst({ code })
        const localBindings = new Set<string>()
        for (const stmt of ast.program.body) {
          collectLocalBindingsFromStatement(stmt, localBindings)
        }
        localBindings.delete('Route')

        for (const name of result) {
          expect(localBindings.has(name)).toBe(true)
        }

        // Contract 3: result is deterministic
        const result2 = computeSharedBindings({
          code,
          codeSplitGroupings: defaultCodeSplitGroupings,
        })
        expect(result).toEqual(result2)
      },
    )
  })
})

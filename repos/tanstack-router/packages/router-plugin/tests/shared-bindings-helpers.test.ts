import { describe, expect, it } from 'vitest'
import * as t from '@babel/types'
import { parseAst } from '@tanstack/router-utils'

import {
  addSharedSearchParamToFilename,
  buildDeclarationMap,
  buildDependencyGraph,
  collectIdentifiersFromNode,
  collectLocalBindingsFromStatement,
  collectModuleLevelRefsFromNode,
  computeSharedBindings,
  expandDestructuredDeclarations,
  expandTransitively,
  removeBindingsDependingOnRoute,
} from '../src/core/code-splitter/compilers'
import { defaultCodeSplitGroupings } from '../src/core/constants'
import type { CodeSplitGroupings } from '../src/core/constants'

// ─── Test helpers ──────────────────────────────────────────

function parse(code: string) {
  return parseAst({ code })
}

function collectBindings(code: string): Set<string> {
  const ast = parse(code)
  const bindings = new Set<string>()
  for (const node of ast.program.body) {
    collectLocalBindingsFromStatement(node, bindings)
  }
  return bindings
}

/** Build a dep graph from code for convenience */
function graphFromCode(code: string) {
  const ast = parse(code)
  const locals = new Set<string>()
  for (const node of ast.program.body) {
    collectLocalBindingsFromStatement(node, locals)
  }
  const declMap = buildDeclarationMap(ast)
  return {
    ast,
    locals,
    declMap,
    depGraph: buildDependencyGraph(declMap, locals),
  }
}

// ─── addSharedSearchParamToFilename ────────────────────────

describe('addSharedSearchParamToFilename', () => {
  it('should append tsr-shared=1 to bare filename', () => {
    expect(addSharedSearchParamToFilename('src/routes/index.tsx')).toBe(
      'src/routes/index.tsx?tsr-shared=1',
    )
  })

  it('should strip existing query params', () => {
    expect(
      addSharedSearchParamToFilename(
        'src/routes/index.tsx?tsr-split=component',
      ),
    ).toBe('src/routes/index.tsx?tsr-shared=1')
  })
})

// ─── collectIdentifiersFromNode ───────────────────────────

describe('collectIdentifiersFromNode', () => {
  it('should collect from a simple identifier', () => {
    const ast = parse('const x = foo')
    const decl = ast.program.body[0] as t.VariableDeclaration
    const init = decl.declarations[0]!.init!
    expect(collectIdentifiersFromNode(init)).toEqual(new Set(['foo']))
  })

  it('should collect from a binary expression', () => {
    const ast = parse('const x = a + b')
    const decl = ast.program.body[0] as t.VariableDeclaration
    const init = decl.declarations[0]!.init!
    expect(collectIdentifiersFromNode(init)).toEqual(new Set(['a', 'b']))
  })

  it('should ignore object literal keys', () => {
    const ast = parse('const x = { key: value }')
    const decl = ast.program.body[0] as t.VariableDeclaration
    const init = decl.declarations[0]!.init!
    const ids = collectIdentifiersFromNode(init)
    expect(ids).toContain('value')
    expect(ids).not.toContain('key')
  })

  it('should ignore member expression properties', () => {
    const ast = parse('const x = obj.prop + obj[dynamic]')
    const decl = ast.program.body[0] as t.VariableDeclaration
    const init = decl.declarations[0]!.init!
    const ids = collectIdentifiersFromNode(init)
    expect(ids).toContain('obj')
    expect(ids).toContain('dynamic')
    expect(ids).not.toContain('prop')
  })

  it('should collect from a call expression', () => {
    const ast = parse('const x = foo(bar, baz)')
    const decl = ast.program.body[0] as t.VariableDeclaration
    const init = decl.declarations[0]!.init!
    expect(collectIdentifiersFromNode(init)).toEqual(
      new Set(['foo', 'bar', 'baz']),
    )
  })

  it('should collect from arrow function body', () => {
    const ast = parse('const x = () => a + b')
    const decl = ast.program.body[0] as t.VariableDeclaration
    const init = decl.declarations[0]!.init!
    const ids = collectIdentifiersFromNode(init)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
  })

  it('should collect from member expressions', () => {
    const ast = parse('const x = obj.prop')
    const decl = ast.program.body[0] as t.VariableDeclaration
    const init = decl.declarations[0]!.init!
    const ids = collectIdentifiersFromNode(init)
    expect(ids).toContain('obj')
    // property name is not a referenced identifier
    expect(ids).not.toContain('prop')
  })

  it('should collect from nested structures', () => {
    const ast = parse('const x = { key: fn(val) }')
    const decl = ast.program.body[0] as t.VariableDeclaration
    const init = decl.declarations[0]!.init!
    const ids = collectIdentifiersFromNode(init)
    expect(ids).toContain('fn')
    expect(ids).toContain('val')
    // object literal keys are not referenced identifiers
    expect(ids).not.toContain('key')
  })

  it('should return empty set for a numeric literal', () => {
    const ast = parse('const x = 42')
    const decl = ast.program.body[0] as t.VariableDeclaration
    const init = decl.declarations[0]!.init!
    expect(collectIdentifiersFromNode(init).size).toBe(0)
  })

  it('should collect from function declaration body', () => {
    const ast = parse('function foo() { return bar + baz }')
    const fn = ast.program.body[0]!
    const ids = collectIdentifiersFromNode(fn)
    // function name is a binding, not a reference
    expect(ids).not.toContain('foo')
    expect(ids).toContain('bar')
    expect(ids).toContain('baz')
  })
})

// ─── collectLocalBindingsFromStatement ─────────────────────

describe('collectLocalBindingsFromStatement', () => {
  it('should collect from const declaration', () => {
    expect(collectBindings('const x = 1')).toEqual(new Set(['x']))
  })

  it('should collect from let declaration', () => {
    expect(collectBindings('let x = 1')).toEqual(new Set(['x']))
  })

  it('should collect from multiple declarators', () => {
    expect(collectBindings('const x = 1, y = 2')).toEqual(new Set(['x', 'y']))
  })

  it('should collect from function declaration', () => {
    expect(collectBindings('function foo() {}')).toEqual(new Set(['foo']))
  })

  it('should collect from class declaration', () => {
    expect(collectBindings('class Foo {}')).toEqual(new Set(['Foo']))
  })

  it('should collect from exported variable declaration', () => {
    expect(collectBindings('export const x = 1')).toEqual(new Set(['x']))
  })

  it('should collect from exported function declaration', () => {
    expect(collectBindings('export function foo() {}')).toEqual(
      new Set(['foo']),
    )
  })

  it('should collect from exported class declaration', () => {
    expect(collectBindings('export class Foo {}')).toEqual(new Set(['Foo']))
  })

  it('should collect from object destructuring', () => {
    expect(collectBindings('const { a, b } = obj')).toEqual(new Set(['a', 'b']))
  })

  it('should collect from nested object destructuring', () => {
    expect(collectBindings('const { a: { b, c } } = obj')).toEqual(
      new Set(['b', 'c']),
    )
  })

  it('should collect from array destructuring', () => {
    expect(collectBindings('const [a, b] = arr')).toEqual(new Set(['a', 'b']))
  })

  it('should collect from destructuring with defaults', () => {
    expect(collectBindings('const { a = 1, b = 2 } = obj')).toEqual(
      new Set(['a', 'b']),
    )
  })

  it('should collect from destructuring with rest', () => {
    expect(collectBindings('const { a, ...rest } = obj')).toEqual(
      new Set(['a', 'rest']),
    )
  })

  it('should collect from exported destructuring', () => {
    expect(collectBindings('export const { a, b } = fn()')).toEqual(
      new Set(['a', 'b']),
    )
  })

  it('should NOT collect from import declarations', () => {
    expect(collectBindings("import { a } from './mod'")).toEqual(new Set())
  })

  it('should NOT collect from expression statements', () => {
    expect(collectBindings('console.log("hello")')).toEqual(new Set())
  })

  it('should collect from renamed destructuring', () => {
    expect(collectBindings('const { a: renamedA } = obj')).toEqual(
      new Set(['renamedA']),
    )
  })

  it('should collect from multiple statements', () => {
    const code = `
const x = 1
function foo() {}
class Bar {}
`
    expect(collectBindings(code)).toEqual(new Set(['x', 'foo', 'Bar']))
  })
})

// ─── buildDeclarationMap ──────────────────────────────────

describe('buildDeclarationMap', () => {
  it('should map variable names to their declarator nodes', () => {
    const ast = parse('const x = 1\nconst y = 2')
    const map = buildDeclarationMap(ast)
    expect(map.has('x')).toBe(true)
    expect(map.has('y')).toBe(true)
    expect(t.isVariableDeclarator(map.get('x'))).toBe(true)
  })

  it('should map function declarations', () => {
    const ast = parse('function foo() {}')
    const map = buildDeclarationMap(ast)
    expect(map.has('foo')).toBe(true)
    expect(t.isFunctionDeclaration(map.get('foo'))).toBe(true)
  })

  it('should map class declarations', () => {
    const ast = parse('class Bar {}')
    const map = buildDeclarationMap(ast)
    expect(map.has('Bar')).toBe(true)
    expect(t.isClassDeclaration(map.get('Bar'))).toBe(true)
  })

  it('should map exported declarations', () => {
    const ast = parse('export const x = 1\nexport function foo() {}')
    const map = buildDeclarationMap(ast)
    expect(map.has('x')).toBe(true)
    expect(map.has('foo')).toBe(true)
  })

  it('should map destructured bindings to same declarator', () => {
    const ast = parse('const { a, b } = fn()')
    const map = buildDeclarationMap(ast)
    expect(map.has('a')).toBe(true)
    expect(map.has('b')).toBe(true)
    expect(map.get('a')).toBe(map.get('b'))
  })

  it('should not include imports', () => {
    const ast = parse("import { x } from './mod'\nconst y = 1")
    const map = buildDeclarationMap(ast)
    expect(map.has('x')).toBe(false)
    expect(map.has('y')).toBe(true)
  })
})

// ─── buildDependencyGraph ─────────────────────────────────

describe('buildDependencyGraph', () => {
  it('should detect direct dependency', () => {
    const { depGraph } = graphFromCode('const a = 1\nconst b = a + 1')
    expect(depGraph.get('b')).toEqual(new Set(['a']))
    expect(depGraph.get('a')).toEqual(new Set())
  })

  it('should not include self-references', () => {
    const { depGraph } = graphFromCode('const a = () => a()')
    expect(depGraph.get('a')!.has('a')).toBe(false)
  })

  it('should not include imported identifiers', () => {
    const { depGraph } = graphFromCode(
      "import { ext } from './mod'\nconst a = ext + 1",
    )
    // ext is not in locals, so not in deps
    expect(depGraph.get('a')!.has('ext')).toBe(false)
  })

  it('should handle multiple deps', () => {
    const { depGraph } = graphFromCode(
      'const a = 1\nconst b = 2\nconst c = a + b',
    )
    expect(depGraph.get('c')).toEqual(new Set(['a', 'b']))
  })

  it('should handle function declaration deps', () => {
    const { depGraph } = graphFromCode(
      'const config = {}\nfunction init() { return config }',
    )
    expect(depGraph.get('init')).toEqual(new Set(['config']))
  })

  it('should handle chain deps (each link direct only)', () => {
    const { depGraph } = graphFromCode('const a = 1\nconst b = a\nconst c = b')
    expect(depGraph.get('c')).toEqual(new Set(['b']))
    expect(depGraph.get('b')).toEqual(new Set(['a']))
    expect(depGraph.get('a')).toEqual(new Set())
  })
})

// ─── collectModuleLevelRefsFromNode ────────────────────────

describe('collectModuleLevelRefsFromNode', () => {
  it('should find identifier reference in expression', () => {
    const code = 'const x = 1\nconst y = x + 1'
    const ast = parse(code)
    const locals = new Set(['x', 'y'])

    const yDecl = ast.program.body[1] as t.VariableDeclaration
    const valueNode = yDecl.declarations[0]!.init!

    const refs = collectModuleLevelRefsFromNode(valueNode, locals)
    expect(refs).toContain('x')
    expect(refs).not.toContain('y')
  })

  it('should return empty set when no local bindings referenced', () => {
    const code = "import { foo } from './mod'\nconst x = foo()"
    const ast = parse(code)
    const locals = new Set(['x']) // foo is imported, not local

    const xDecl = ast.program.body[1] as t.VariableDeclaration
    const valueNode = xDecl.declarations[0]!.init!

    const refs = collectModuleLevelRefsFromNode(valueNode, locals)
    expect(refs.size).toBe(0)
  })

  it('should find multiple references', () => {
    const code = 'const a = 1\nconst b = 2\nconst c = a + b'
    const ast = parse(code)
    const locals = new Set(['a', 'b', 'c'])

    const cDecl = ast.program.body[2] as t.VariableDeclaration
    const valueNode = cDecl.declarations[0]!.init!

    const refs = collectModuleLevelRefsFromNode(valueNode, locals)
    expect(refs).toContain('a')
    expect(refs).toContain('b')
  })

  it('should find refs inside function call arguments', () => {
    const code = 'const config = {}\nconst result = process(config)'
    const ast = parse(code)
    const locals = new Set(['config', 'result'])

    const resultDecl = ast.program.body[1] as t.VariableDeclaration
    const valueNode = resultDecl.declarations[0]!.init!

    const refs = collectModuleLevelRefsFromNode(valueNode, locals)
    expect(refs).toContain('config')
  })

  it('should only return direct refs (not transitive)', () => {
    const code = 'const a = 1\nconst b = a\nconst c = b'
    const ast = parse(code)
    const locals = new Set(['a', 'b', 'c'])

    const cDecl = ast.program.body[2] as t.VariableDeclaration
    const valueNode = cDecl.declarations[0]!.init!

    const refs = collectModuleLevelRefsFromNode(valueNode, locals)
    // Only b is directly referenced, NOT a (transitive expansion is separate)
    expect(refs).toContain('b')
    expect(refs).not.toContain('a')
  })
})

// ─── expandTransitively ───────────────────────────────────

describe('expandTransitively', () => {
  it('should expand shared set with deps of shared bindings', () => {
    const { depGraph } = graphFromCode('const dep = 1\nconst shared = dep + 1')
    const shared = new Set(['shared'])

    expandTransitively(shared, depGraph)
    expect(shared).toContain('dep')
  })

  it('should handle multi-level transitive expansion', () => {
    const { depGraph } = graphFromCode('const a = 1\nconst b = a\nconst c = b')
    const shared = new Set(['c'])

    expandTransitively(shared, depGraph)
    expect(shared).toContain('b')
    expect(shared).toContain('a')
  })

  it('should not expand bindings not in graph', () => {
    const depGraph = new Map<string, Set<string>>()
    depGraph.set('shared', new Set(['ext']))
    // ext has no entry in graph
    const shared = new Set(['shared'])

    expandTransitively(shared, depGraph)
    // ext added because it's a dep, even if it has no graph entry
    expect(shared).toContain('ext')
    expect(shared.size).toBe(2)
  })

  it('should not loop on circular references', () => {
    const { depGraph } = graphFromCode(
      'const a = () => b()\nconst b = () => a()',
    )
    const shared = new Set(['a'])

    expandTransitively(shared, depGraph)
    expect(shared).toContain('a')
    expect(shared).toContain('b')
  })

  it('should leave shared untouched when binding has no deps', () => {
    const depGraph = new Map<string, Set<string>>()
    depGraph.set('x', new Set())
    const shared = new Set(['x'])

    expandTransitively(shared, depGraph)
    expect(shared.size).toBe(1)
    expect(shared).toContain('x')
  })

  it('should handle function declaration deps', () => {
    const { depGraph } = graphFromCode(
      'const config = {}\nfunction init() { return config }',
    )
    const shared = new Set(['init'])

    expandTransitively(shared, depGraph)
    expect(shared).toContain('config')
  })

  it('should handle empty graph', () => {
    const depGraph = new Map<string, Set<string>>()
    const shared = new Set(['x'])

    expandTransitively(shared, depGraph)
    expect(shared.size).toBe(1)
  })
})

// ─── expandDestructuredDeclarations ───────────────────────

describe('expandDestructuredDeclarations', () => {
  it('should add all siblings when one destructured binding is shared', () => {
    const ast = parse('const { a, b, c } = fn()')
    const shared = new Set(['a'])

    expandDestructuredDeclarations(ast, shared)
    expect(shared).toContain('a')
    expect(shared).toContain('b')
    expect(shared).toContain('c')
  })

  it('should handle array destructuring', () => {
    const ast = parse('const [x, y] = fn()')
    const shared = new Set(['y'])

    expandDestructuredDeclarations(ast, shared)
    expect(shared).toContain('x')
    expect(shared).toContain('y')
  })

  it('should not expand non-destructured declarations', () => {
    const ast = parse('const a = 1\nconst b = 2')
    const shared = new Set(['a'])

    expandDestructuredDeclarations(ast, shared)
    expect(shared).toContain('a')
    expect(shared).not.toContain('b')
  })

  it('should handle exported destructured declarations', () => {
    const ast = parse('export const { a, b } = fn()')
    const shared = new Set(['b'])

    expandDestructuredDeclarations(ast, shared)
    expect(shared).toContain('a')
    expect(shared).toContain('b')
  })

  it('should not touch declarations where no binding is shared', () => {
    const ast = parse('const { a, b } = fn()\nconst { c, d } = other()')
    const shared = new Set(['a'])

    expandDestructuredDeclarations(ast, shared)
    expect(shared).toContain('a')
    expect(shared).toContain('b')
    expect(shared).not.toContain('c')
    expect(shared).not.toContain('d')
  })

  it('should handle nested destructuring', () => {
    const ast = parse('const { a, b: { c } } = fn()')
    const shared = new Set(['a'])

    expandDestructuredDeclarations(ast, shared)
    expect(shared).toContain('a')
    expect(shared).toContain('c')
  })

  it('should handle destructuring with defaults', () => {
    const ast = parse('const { a = 1, b = 2 } = fn()')
    const shared = new Set(['a'])

    expandDestructuredDeclarations(ast, shared)
    expect(shared).toContain('b')
  })

  it('should handle destructuring with rest', () => {
    const ast = parse('const { a, ...rest } = fn()')
    const shared = new Set(['a'])

    expandDestructuredDeclarations(ast, shared)
    expect(shared).toContain('rest')
  })
})

// ─── computeSharedBindings (integration) ──────────────────

describe('computeSharedBindings', () => {
  const defaultGroupings = defaultCodeSplitGroupings

  it('should return empty set when no route options exist', () => {
    const code = 'const x = 1'
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    expect(result.size).toBe(0)
  })

  it('should return empty set for root routes (unsplittable)', () => {
    const code = `
import { createRootRoute } from '@tanstack/react-router'
const shared = 42
export const Route = createRootRoute({
  component: () => shared,
  beforeLoad: () => shared,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    expect(result.size).toBe(0)
  })

  it('should detect binding shared between split and non-split properties', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const sharedValue = 42
export const Route = createFileRoute('/')({
  component: () => sharedValue,
  beforeLoad: () => sharedValue,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    expect(result).toContain('sharedValue')
  })

  it('should NOT mark binding as shared if only used by split properties', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const myComponent = () => <div />
export const Route = createFileRoute('/')({
  component: myComponent,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    expect(result.size).toBe(0)
  })

  it('should NOT mark binding as shared if only used by non-split properties', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const validator = () => true
export const Route = createFileRoute('/')({
  component: () => <div />,
  beforeLoad: validator,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    expect(result.size).toBe(0)
  })

  it('should detect shared function declaration', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
function helperFn() { return 42 }
export const Route = createFileRoute('/')({
  component: () => helperFn(),
  beforeLoad: () => helperFn(),
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    expect(result).toContain('helperFn')
  })

  it('should mark shared when binding used by two different split groups', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
class Config { value = 1 }
export const Route = createFileRoute('/')({
  component: () => new Config(),
  loader: () => new Config(),
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: [['component'], ['loader']],
    })
    // component and loader are in different split groups → Config is shared
    expect(result).toContain('Config')
  })

  it('should detect shared class when used by split and non-split', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
class Config { value = 1 }
export const Route = createFileRoute('/')({
  component: () => new Config(),
  beforeLoad: () => new Config(),
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    expect(result).toContain('Config')
  })

  it('should expand transitive deps into shared set', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const BASE = 10
const multiplier = BASE * 2
export const Route = createFileRoute('/')({
  component: () => multiplier,
  beforeLoad: () => multiplier,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    expect(result).toContain('multiplier')
    expect(result).toContain('BASE')
  })

  it('should expand destructured declarations', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const { a, b } = getValues()
export const Route = createFileRoute('/')({
  component: () => a,
  beforeLoad: () => a,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    expect(result).toContain('a')
    expect(result).toContain('b')
  })

  it('should handle no local bindings gracefully', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/')({
  component: () => <div />,
  beforeLoad: () => {},
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    expect(result.size).toBe(0)
  })

  it('should not include imported bindings as shared (bundlers dedupe them)', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
import { helper } from './utils'
export const Route = createFileRoute('/')({
  component: () => helper(),
  beforeLoad: () => helper(),
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    expect(result).not.toContain('helper')
    expect(result.size).toBe(0)
  })

  it('should handle multiple shared bindings', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const a = 1
const b = 2
export const Route = createFileRoute('/')({
  component: () => a + b,
  beforeLoad: () => a + b,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    expect(result).toContain('a')
    expect(result).toContain('b')
  })

  it('should handle chained createFileRoute call pattern', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const data = { value: 42 }
export const Route = createFileRoute('/')({
  component: () => data.value,
  validateSearch: () => data,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    expect(result).toContain('data')
  })

  it('should handle loader in default groupings (not split by default)', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const config = { key: 'value' }
export const Route = createFileRoute('/')({
  component: () => config.key,
  loader: () => config,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    // In default groupings, loader is NOT split → non-split
    // component IS split → config referenced by both → shared
    expect(result).toContain('config')
  })

  it('should handle custom groupings where loader and component are in different split groups', () => {
    const groupings: CodeSplitGroupings = [['component'], ['loader']]
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const config = { key: 'value' }
export const Route = createFileRoute('/')({
  component: () => config.key,
  loader: () => config,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: groupings,
    })
    // component and loader are in different split groups → config is shared
    expect(result).toContain('config')
  })

  it('should NOT mark shared when binding used by only one split group', () => {
    const groupings: CodeSplitGroupings = [
      ['loader', 'component'],
      ['errorComponent'],
    ]
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const config = { key: 'value' }
export const Route = createFileRoute('/')({
  component: () => config.key,
  loader: () => config,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: groupings,
    })
    // component and loader are in the SAME split group → config only in one group → not shared
    expect(result.size).toBe(0)
  })

  it('should handle custom groupings with non-split property referencing shared binding', () => {
    const groupings: CodeSplitGroupings = [['component'], ['loader']]
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const config = { key: 'value' }
export const Route = createFileRoute('/')({
  component: () => config.key,
  loader: () => config,
  beforeLoad: () => config,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: groupings,
    })
    // config used by component (split), loader (split), beforeLoad (non-split)
    // In both splitRefs and nonSplitRefs → shared
    expect(result).toContain('config')
  })

  it('should handle deep transitive chain with destructuring', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const base = 10
const { x, y } = compute(base)
export const Route = createFileRoute('/')({
  component: () => x,
  beforeLoad: () => x,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    // x is shared → y must be shared (destructured together)
    // base is a transitive dep of {x, y} declaration → also shared
    expect(result).toContain('x')
    expect(result).toContain('y')
    expect(result).toContain('base')
  })

  it('should NOT include bindings that transitively depend on Route', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const HEADER = 'Page'
function usePageTitle() { return HEADER + ' - ' + Route.fullPath }
export const Route = createFileRoute('/about')({
  loader: () => usePageTitle(),
  component: () => usePageTitle(),
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    // usePageTitle references Route → cannot be shared
    expect(result).not.toContain('usePageTitle')
    // HEADER does NOT reference Route → still safe to share
    expect(result).toContain('HEADER')
    // Route must never be shared
    expect(result).not.toContain('Route')
  })

  it('should remove entire transitive chain if it reaches Route', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const routeInfo = { path: '' }
function initRouteInfo() { routeInfo.path = Route.fullPath }
function getTitle() { initRouteInfo(); return routeInfo.path }
export const Route = createFileRoute('/test')({
  loader: () => getTitle(),
  component: () => getTitle(),
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    // getTitle → initRouteInfo → Route: entire chain cannot be shared
    expect(result).not.toContain('getTitle')
    expect(result).not.toContain('initRouteInfo')
    expect(result).not.toContain('Route')
    // routeInfo doesn't reference Route directly, but initRouteInfo does
    // routeInfo itself may or may not be shared depending on its own deps
  })

  it('should keep bindings that do NOT depend on Route alongside ones that do', () => {
    const code = `
import { createFileRoute } from '@tanstack/react-router'
const safeConfig = { timeout: 5000 }
function unsafeHelper() { return Route.fullPath }
export const Route = createFileRoute('/mixed')({
  loader: () => ({ config: safeConfig, path: unsafeHelper() }),
  component: () => <div>{safeConfig.timeout} {unsafeHelper()}</div>,
})
`
    const result = computeSharedBindings({
      code,
      codeSplitGroupings: defaultGroupings,
    })
    expect(result).toContain('safeConfig')
    expect(result).not.toContain('unsafeHelper')
    expect(result).not.toContain('Route')
  })
})

// ─── removeBindingsDependingOnRoute ───────────────────────

describe('removeBindingsDependingOnRoute', () => {
  it('should remove a binding that directly depends on Route', () => {
    const depGraph = new Map<string, Set<string>>()
    depGraph.set('helper', new Set(['Route']))
    depGraph.set('Route', new Set())
    const shared = new Set(['helper'])

    removeBindingsDependingOnRoute(shared, depGraph)
    expect(shared).not.toContain('helper')
  })

  it('should remove a binding that transitively depends on Route', () => {
    const depGraph = new Map<string, Set<string>>()
    depGraph.set('a', new Set(['b']))
    depGraph.set('b', new Set(['Route']))
    depGraph.set('Route', new Set())
    const shared = new Set(['a'])

    removeBindingsDependingOnRoute(shared, depGraph)
    expect(shared).not.toContain('a')
  })

  it('should keep a binding that does NOT depend on Route', () => {
    const depGraph = new Map<string, Set<string>>()
    depGraph.set('safe', new Set(['dep']))
    depGraph.set('dep', new Set())
    depGraph.set('Route', new Set())
    const shared = new Set(['safe'])

    removeBindingsDependingOnRoute(shared, depGraph)
    expect(shared).toContain('safe')
  })

  it('should handle mixed: remove Route-dependent, keep safe bindings', () => {
    const depGraph = new Map<string, Set<string>>()
    depGraph.set('safe', new Set(['dep']))
    depGraph.set('dep', new Set())
    depGraph.set('unsafe', new Set(['Route']))
    depGraph.set('Route', new Set())
    const shared = new Set(['safe', 'unsafe'])

    removeBindingsDependingOnRoute(shared, depGraph)
    expect(shared).toContain('safe')
    expect(shared).not.toContain('unsafe')
  })

  it('should handle empty shared set', () => {
    const depGraph = new Map<string, Set<string>>()
    const shared = new Set<string>()

    removeBindingsDependingOnRoute(shared, depGraph)
    expect(shared.size).toBe(0)
  })

  it('should handle binding with no graph entry', () => {
    const depGraph = new Map<string, Set<string>>()
    const shared = new Set(['orphan'])

    removeBindingsDependingOnRoute(shared, depGraph)
    // No deps found → does not depend on Route → keep
    expect(shared).toContain('orphan')
  })

  it('should handle circular deps that do NOT reach Route', () => {
    const depGraph = new Map<string, Set<string>>()
    depGraph.set('a', new Set(['b']))
    depGraph.set('b', new Set(['a']))
    depGraph.set('Route', new Set())
    const shared = new Set(['a'])

    removeBindingsDependingOnRoute(shared, depGraph)
    expect(shared).toContain('a')
  })

  it('should handle circular deps that DO reach Route', () => {
    const depGraph = new Map<string, Set<string>>()
    depGraph.set('a', new Set(['b']))
    depGraph.set('b', new Set(['a', 'Route']))
    depGraph.set('Route', new Set())
    const shared = new Set(['a'])

    removeBindingsDependingOnRoute(shared, depGraph)
    expect(shared).not.toContain('a')
  })
})

import * as t from '@babel/types'
import { describe, expect, test } from 'vitest'
import {
  buildDeclarationMap,
  collectIdentifiersFromNode,
  collectLocalBindingsFromStatement,
  extractModuleInfoFromAst,
} from '../src/compiler-helpers'
import { parseAst } from '../src/ast'

function getVariableInit(code: string) {
  const ast = parseAst({ code, filename: 'test.tsx' })
  const declaration = ast.program.body.find((node) =>
    t.isVariableDeclaration(node),
  ) as t.VariableDeclaration
  return declaration.declarations[0]!.init!
}

function collectSortedIdentifiers(node: t.Node) {
  return [...collectIdentifiersFromNode(node)].sort()
}

function collectSortedStatementBindings(code: string) {
  const ast = parseAst({ code, filename: 'test.tsx' })
  const bindings = new Set<string>()
  for (const statement of ast.program.body) {
    collectLocalBindingsFromStatement(statement, bindings)
  }
  return [...bindings].sort()
}

function collectSortedDeclarationMapEntries(code: string) {
  const ast = parseAst({ code, filename: 'test.tsx' })
  return [...buildDeclarationMap(ast)]
    .map(([name, node]): [string, string] => [name, node.type])
    .sort((left, right) => (left[0] < right[0] ? -1 : 1))
}

function collectModuleInfoSnapshot(code: string) {
  const ast = parseAst({ code, filename: 'test.tsx' })
  const info = extractModuleInfoFromAst(ast)
  return {
    bindings: [...info.bindings]
      .map(([name, binding]) => [
        name,
        binding.type === 'import'
          ? `${binding.source}:${binding.importedName}`
          : (binding.init?.type ?? null),
      ])
      .sort((left, right) => (left[0]! < right[0]! ? -1 : 1)),
    exports: [...info.exports].sort((left, right) =>
      left[0] < right[0] ? -1 : 1,
    ),
    reExportAllSources: info.reExportAllSources,
  }
}

describe('collectIdentifiersFromNode', () => {
  test('collects free identifiers without reporting nested local bindings', () => {
    const init = getVariableInit(`
const value = outer + (() => {
  const local = dep

  function nested(param = fallback) {
    const Inner = () => <LocalComponent value={param} />
    const LocalExpr = class NamedLocal {
      method() {
        return NamedLocal + local + param
      }
    }

    class LocalComponent {}

    return local + param + imported + Inner + LocalExpr
  }

  return nested()
})()
`)

    expect(collectSortedIdentifiers(init)).toMatchInlineSnapshot(`
      [
        "dep",
        "fallback",
        "imported",
        "outer",
      ]
    `)
  })

  test('respects nested variable, parameter, catch, and import shadowing', () => {
    const ast = parseAst({
      code: `
import { external as localImport } from 'pkg'

const value = (localParam = defaultValue) => {
  const localShadow = factory(localImport)

  try {
    throw thrown
  } catch (thrown) {
    const factory = () => localShadow + localParam + thrown
    return factory()
  }
}
`,
      filename: 'test.ts',
    })

    expect(collectSortedIdentifiers(ast.program)).toMatchInlineSnapshot(`
      [
        "defaultValue",
        "factory",
        "thrown",
      ]
    `)
  })
})

describe('collectLocalBindingsFromStatement', () => {
  test('collects ids from named default function and class declarations', () => {
    expect({
      class: collectSortedStatementBindings(
        `export default class DefaultComponent {}`,
      ),
      function: collectSortedStatementBindings(
        `export default function DefaultRoute() {}`,
      ),
      anonymous: collectSortedStatementBindings(
        `export default function () {}`,
      ),
    }).toMatchInlineSnapshot(`
      {
        "anonymous": [],
        "class": [
          "DefaultComponent",
        ],
        "function": [
          "DefaultRoute",
        ],
      }
    `)
  })
})

describe('buildDeclarationMap', () => {
  test('maps named default function and class declarations', () => {
    expect({
      class: collectSortedDeclarationMapEntries(
        `export default class DefaultComponent {}`,
      ),
      function: collectSortedDeclarationMapEntries(
        `export default function DefaultRoute() {}`,
      ),
      anonymous: collectSortedDeclarationMapEntries(`export default class {}`),
    }).toMatchInlineSnapshot(`
      {
        "anonymous": [],
        "class": [
          [
            "DefaultComponent",
            "ClassDeclaration",
          ],
        ],
        "function": [
          [
            "DefaultRoute",
            "FunctionDeclaration",
          ],
        ],
      }
    `)
  })
})

describe('extractModuleInfoFromAst', () => {
  test('extracts imports, local exports, default exports, and re-export sources', () => {
    expect(
      collectModuleInfoSnapshot(`
        import defaultImport, { named as localNamed } from 'pkg'
        import * as ns from 'pkg-ns'
        const local = localNamed
        export const exported = local
        export function loader() {}
        export default class DefaultRoute {}
        export { remote as renamed } from './remote'
        export * from './all'
      `),
    ).toMatchInlineSnapshot(`
      {
        "bindings": [
          [
            "DefaultRoute",
            null,
          ],
          [
            "defaultImport",
            "pkg:default",
          ],
          [
            "exported",
            "Identifier",
          ],
          [
            "loader",
            null,
          ],
          [
            "local",
            "Identifier",
          ],
          [
            "localNamed",
            "pkg:named",
          ],
          [
            "ns",
            "pkg-ns:*",
          ],
          [
            "remote",
            "./remote:remote",
          ],
        ],
        "exports": [
          [
            "default",
            "DefaultRoute",
          ],
          [
            "exported",
            "exported",
          ],
          [
            "loader",
            "loader",
          ],
          [
            "renamed",
            "remote",
          ],
        ],
        "reExportAllSources": [
          "./all",
        ],
      }
    `)
  })
})

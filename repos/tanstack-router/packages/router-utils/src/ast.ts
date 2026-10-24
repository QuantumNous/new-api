import { parse } from '@babel/parser'
import _generate from '@babel/generator'
import * as t from '@babel/types'
import {
  deadCodeElimination as _deadCodeElimination,
  findReferencedIdentifiers,
} from 'babel-dead-code-elimination'
import type { GeneratorOptions, GeneratorResult } from '@babel/generator'
import type { ParseResult, ParserOptions } from '@babel/parser'
import type * as _babel_types from '@babel/types'

export type ParseAstOptions = ParserOptions & {
  code: string
  filename?: string
}

export type ParseAstResult = ParseResult<_babel_types.File>
export function parseAst({
  code,
  filename,
  sourceFilename,
  plugins,
  ...opts
}: ParseAstOptions): ParseAstResult {
  const inferredFilename = filename ?? sourceFilename
  return parse(code, {
    plugins: plugins ?? getDefaultParserPluginsForFilename(inferredFilename),
    sourceType: 'module',
    sourceFilename,
    ...opts,
  })
}

function getDefaultParserPluginsForFilename(
  filename: string | undefined,
): NonNullable<ParserOptions['plugins']> {
  const plugins: NonNullable<ParserOptions['plugins']> = [
    'typescript',
    'explicitResourceManagement',
    'importAttributes',
    'deprecatedImportAssert',
    ['decorators', { decoratorsBeforeExport: true }],
    'decoratorAutoAccessors',
  ]

  if (!isPlainTypeScriptFile(filename)) {
    plugins.unshift('jsx')
  }

  return plugins
}

function isPlainTypeScriptFile(filename: string | undefined): boolean {
  if (!filename) {
    return false
  }

  return /\.[cm]?ts(?:$|[?#])/.test(filename)
}

let generate = _generate

if ('default' in generate) {
  generate = generate.default as typeof generate
}
type GenerateFromAstOptions = GeneratorOptions &
  Required<Pick<GeneratorOptions, 'sourceFileName' | 'filename'>>
export function generateFromAst(
  ast: _babel_types.Node,
  opts?: GenerateFromAstOptions,
): GeneratorResult {
  return generate(
    ast,
    opts
      ? { importAttributesKeyword: 'with', sourceMaps: true, ...opts }
      : undefined,
  )
}
export type { GeneratorResult } from '@babel/generator'

/**
 * Strips TypeScript type-only exports and imports from an AST.
 *
 * This is necessary because babel-dead-code-elimination doesn't handle
 * TypeScript type exports/imports. When a type export references an import
 * that pulls in server-only code, the dead code elimination won't remove
 * that import because it sees the type as still referencing it.
 *
 * This function removes:
 * - `export type Foo = ...`
 * - `export interface Foo { ... }`
 * - `export type { Foo } from './module'`
 * - `export type * from './module'`
 * - Type specifiers in mixed exports: `export { value, type Foo }` -> `export { value }`
 * - `import type { Foo } from './module'`
 * - Type specifiers in mixed imports: `import { value, type Foo } from './module'` -> `import { value }`
 *
 * Note: Non-exported type/interface declarations are preserved as they may be
 * used as type annotations within the code.
 *
 * @param ast - The Babel AST (or ParseResult) to mutate
 */
export function stripTypeExports(ast: ParseResult<_babel_types.File>): void {
  // Filter the program body to remove type-only nodes
  ast.program.body = ast.program.body.filter((node) => {
    // Handle export declarations
    if (t.isExportNamedDeclaration(node)) {
      // Remove entire export if it's a type-only export
      // e.g., `export type Foo = string`, `export interface Bar {}`, `export type { X } from './y'`
      if (node.exportKind === 'type') {
        return false
      }

      // For value exports with mixed specifiers, filter out type-only specifiers
      // e.g., `export { value, type TypeOnly }` -> `export { value }`
      if (node.specifiers.length > 0) {
        node.specifiers = node.specifiers.filter((specifier) => {
          if (t.isExportSpecifier(specifier)) {
            return specifier.exportKind !== 'type'
          }
          return true
        })

        // If all specifiers were removed, remove the entire export declaration
        // (unless it has a declaration like `export const x = 1`)
        if (node.specifiers.length === 0 && !node.declaration) {
          return false
        }
      }
    }

    // Handle type-only export-all declarations
    // e.g., `export type * from './module'`
    if (t.isExportAllDeclaration(node)) {
      if (node.exportKind === 'type') {
        return false
      }
    }

    // Handle import declarations
    if (t.isImportDeclaration(node)) {
      // Remove entire import if it's a type-only import
      // e.g., `import type { Foo } from './module'`
      if (node.importKind === 'type') {
        return false
      }

      // For value imports with mixed specifiers, filter out type-only specifiers
      // e.g., `import { value, type TypeOnly } from './module'` -> `import { value }`
      if (node.specifiers.length > 0) {
        node.specifiers = node.specifiers.filter((specifier) => {
          if (t.isImportSpecifier(specifier)) {
            return specifier.importKind !== 'type'
          }
          return true
        })

        // If all specifiers were removed, remove the entire import declaration
        if (node.specifiers.length === 0) {
          return false
        }
      }
    }

    return true
  })
}

// Re-export findReferencedIdentifiers from babel-dead-code-elimination
export { findReferencedIdentifiers }

/**
 * Performs dead code elimination on the AST, with TypeScript type stripping.
 *
 * This is a wrapper around babel-dead-code-elimination that first strips
 * TypeScript type-only exports and imports. This is necessary because
 * babel-dead-code-elimination doesn't handle type exports, which can cause
 * imports to be retained when they're only referenced by type exports.
 *
 * @param ast - The Babel AST to mutate
 * @param candidates - Optional set of identifier paths to consider for removal.
 *                     If provided, only these identifiers will be candidates for removal.
 *                     This should be the result of `findReferencedIdentifiers(ast)` called
 *                     before any AST transformations.
 */
export function deadCodeElimination(
  ast: ParseResult<_babel_types.File>,
  candidates?: ReturnType<typeof findReferencedIdentifiers>,
): void {
  // First strip TypeScript type-only exports and imports
  stripTypeExports(ast)

  // Then run the original dead code elimination
  _deadCodeElimination(ast, candidates)
}

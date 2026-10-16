import { describe, expect, test } from 'vitest'
import { generateFromAst, parseAst, stripTypeExports } from '../src/ast'

function transform(code: string): string {
  const ast = parseAst({ code })
  stripTypeExports(ast)
  return generateFromAst(ast, {
    sourceFileName: 'test.ts',
    filename: 'test.ts',
  }).code
}

describe('stripTypeExports', () => {
  describe('import attributes parsing', () => {
    test('parses import attributes with with syntax', () => {
      const code = `import data from './data.json' with { type: 'json' }
export const value = data`

      expect(() => parseAst({ code })).not.toThrow()
    })

    test('parses import attributes with deprecated assert syntax', () => {
      const code = `import data from './data.json' assert { type: 'json' }
export const value = data`

      expect(() => parseAst({ code })).not.toThrow()
    })

    test('parses angle-bracket type assertions in .ts files without JSX', () => {
      const code = `export function cast<T>(value: any): T {
  return <T>value
}`

      expect(() => parseAst({ code, filename: 'cast.ts' })).not.toThrow()
    })
  })

  describe('type alias declarations', () => {
    test('preserves top-level type alias declaration (non-exported)', () => {
      const code = `type Foo = string;
const value = 1;`
      const result = transform(code)
      expect(result).toContain('type Foo = string')
      expect(result).toContain('const value = 1')
    })

    test('removes export type alias declaration', () => {
      const code = `export type Foo = string;
export const value = 1;`
      const result = transform(code)
      expect(result).not.toContain('type Foo')
      expect(result).toContain('export const value = 1')
    })
  })

  describe('interface declarations', () => {
    test('preserves top-level interface declaration (non-exported)', () => {
      const code = `interface Bar { x: number }
const value = 1;`
      const result = transform(code)
      expect(result).toContain('interface Bar')
      expect(result).toContain('const value = 1')
    })

    test('removes export interface declaration', () => {
      const code = `export interface Bar { x: number }
export const value = 1;`
      const result = transform(code)
      expect(result).not.toContain('interface Bar')
      expect(result).toContain('export const value = 1')
    })
  })

  describe('type re-exports', () => {
    test('removes export type { X } from syntax', () => {
      const code = `export type { Foo } from './other';
export const value = 1;`
      const result = transform(code)
      expect(result).not.toContain('Foo')
      expect(result).not.toContain('./other')
      expect(result).toContain('export const value = 1')
    })

    test('removes export type { X as Y } from syntax', () => {
      const code = `export type { Foo as Bar } from './other';
export const value = 1;`
      const result = transform(code)
      expect(result).not.toContain('Foo')
      expect(result).not.toContain('Bar')
      expect(result).toContain('export const value = 1')
    })

    test('removes export type * from syntax', () => {
      const code = `export type * from './types';
export const value = 1;`
      const result = transform(code)
      expect(result).not.toContain('./types')
      expect(result).toContain('export const value = 1')
    })

    test('removes export type * as namespace from syntax', () => {
      const code = `export type * as Types from './types';
export const value = 1;`
      const result = transform(code)
      expect(result).not.toContain('Types')
      expect(result).not.toContain('./types')
      expect(result).toContain('export const value = 1')
    })

    test('preserves regular export * from syntax', () => {
      const code = `export * from './other';
export const value = 1;`
      const result = transform(code)
      expect(result).toContain("export * from './other'")
      expect(result).toContain('export const value = 1')
    })
  })

  describe('mixed exports with type specifiers', () => {
    test('removes type specifiers from mixed export', () => {
      const code = `const value = 1;
type TypeOnly = string;
export { value, type TypeOnly };`
      const result = transform(code)
      expect(result).toContain('export { value }')
      expect(result).toContain('type TypeOnly = string')
    })

    test('removes entire export if all specifiers are type-only', () => {
      const code = `type Foo = string;
type Bar = number;
export { type Foo, type Bar };
export const value = 1;`
      const result = transform(code)
      expect(result).not.toContain('export { type Foo')
      expect(result).toContain('type Foo = string')
      expect(result).toContain('type Bar = number')
      expect(result).toContain('export const value = 1')
    })
  })

  describe('type-only imports', () => {
    test('removes import type declaration', () => {
      const code = `import type { Foo } from './module';
import { value } from './other';`
      const result = transform(code)
      expect(result).not.toContain('Foo')
      expect(result).not.toContain('./module')
      expect(result).toContain("import { value } from './other'")
    })

    test('removes import type * as namespace', () => {
      const code = `import type * as Types from './module';
import { value } from './other';`
      const result = transform(code)
      expect(result).not.toContain('Types')
      expect(result).not.toContain('./module')
      expect(result).toContain("import { value } from './other'")
    })
  })

  describe('mixed imports with type specifiers', () => {
    test('removes type specifiers from mixed import', () => {
      const code = `import { value, type TypeOnly } from './module';`
      const result = transform(code)
      expect(result).toContain("import { value } from './module'")
      expect(result).not.toContain('TypeOnly')
    })

    test('removes entire import if all specifiers are type-only', () => {
      const code = `import { type Foo, type Bar } from './module';
import { value } from './other';`
      const result = transform(code)
      expect(result).not.toContain('./module')
      expect(result).not.toContain('Foo')
      expect(result).not.toContain('Bar')
      expect(result).toContain("import { value } from './other'")
    })
  })

  describe('preserves non-type code', () => {
    test('preserves regular exports', () => {
      const code = `export const value = 1;
export function foo() { return 2; }
export class MyClass {}`
      const result = transform(code)
      expect(result).toContain('export const value = 1')
      expect(result).toContain('export function foo()')
      expect(result).toContain('export class MyClass')
    })

    test('preserves regular imports', () => {
      const code = `import { foo, bar } from './module';
import defaultExport from './other';
import * as namespace from './third';`
      const result = transform(code)
      expect(result).toContain("import { foo, bar } from './module'")
      expect(result).toContain("import defaultExport from './other'")
      expect(result).toContain("import * as namespace from './third'")
    })

    test('preserves export with declaration', () => {
      const code = `export const x = 1;
export function fn() {}
export class C {}`
      const result = transform(code)
      expect(result).toContain('export const x = 1')
      expect(result).toContain('export function fn()')
      expect(result).toContain('export class C')
    })
  })

  describe('complex scenarios', () => {
    test('handles file with mixed type and value exports', () => {
      const code = `import { z } from 'zod';
import type { SomeType } from './types';
import { helper, type HelperType } from './helpers';

type LocalType = string;
interface LocalInterface { x: number }

export type ExportedType = z.infer<typeof schema>;
export interface ExportedInterface { y: string }

const schema = z.object({ name: z.string() });
export const myValue = 1;
export { helper, type HelperType };`

      const result = transform(code)

      // Should remove type imports
      expect(result).not.toContain('SomeType')
      expect(result).not.toContain('./types')
      expect(result).not.toContain('HelperType')

      // Should preserve local type declarations
      expect(result).toContain('type LocalType = string')
      expect(result).toContain('interface LocalInterface')

      // Should remove exported type declarations
      expect(result).not.toContain('type ExportedType')
      expect(result).not.toContain('interface ExportedInterface')

      // Should preserve value imports and exports
      expect(result).toContain("import { z } from 'zod'")
      expect(result).toContain("import { helper } from './helpers'")
      expect(result).toContain('export const myValue = 1')
      expect(result).toContain('export { helper }')
    })

    test('handles the issue #6480 scenario - type export referencing imported enum', () => {
      // This simulates the problematic case from the issue:
      // export type CreatePostInput = z.infer<typeof postSchema>;
      // where postSchema uses an imported enum
      const code = `import { z } from 'zod';
import { PostCategory } from './PostService';

const postSchema = z.object({
  category: z.nativeEnum(PostCategory)
});

export type CreatePostInput = z.infer<typeof postSchema>;

export const serverFn = () => {};`

      const result = transform(code)

      // The type export should be removed
      expect(result).not.toContain('export type CreatePostInput')

      // The value exports and imports should remain
      expect(result).toContain("import { z } from 'zod'")
      expect(result).toContain("import { PostCategory } from './PostService'")
      expect(result).toContain('export const serverFn')
    })
  })
})

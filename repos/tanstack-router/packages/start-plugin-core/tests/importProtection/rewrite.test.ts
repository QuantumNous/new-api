import { describe, expect, test } from 'vitest'
import { rewriteDeniedImports } from '../../src/import-protection/rewrite'

const MOCK_SUBSTR = 'tanstack-start-import-protection:mock'

function rewrite(code: string, denied: Array<string>): string {
  const result = rewriteDeniedImports(code, '/test.ts', new Set(denied))
  expect(result).toBeDefined()
  return result!.code.trim()
}

function expectMockImport(out: string, varName: string): void {
  expect(out).toContain(MOCK_SUBSTR)
  expect(out).toMatch(new RegExp(`import ${varName} from`))
}

describe('rewriteDeniedImports', () => {
  test('rewrites named imports', () => {
    const out = rewrite(`import { foo, bar } from './secret.server';`, [
      './secret.server',
    ])
    expectMockImport(out, '__tss_deny_0')
    expect(out).toContain('const foo = __tss_deny_0.foo')
    expect(out).toContain('const bar = __tss_deny_0.bar')
    expect(out).not.toContain('./secret.server')
  })

  test('rewrites default import', () => {
    const out = rewrite(`import secret from './secret.server';`, [
      './secret.server',
    ])
    expectMockImport(out, '__tss_deny_0')
    expect(out).toContain('const secret = __tss_deny_0')
    expect(out).not.toContain('./secret.server')
  })

  test('rewrites namespace import', () => {
    const out = rewrite(`import * as ns from './secret.server';`, [
      './secret.server',
    ])
    expectMockImport(out, '__tss_deny_0')
    expect(out).toContain('const ns = __tss_deny_0')
    expect(out).not.toContain('./secret.server')
  })

  test('rewrites aliased named import', () => {
    const out = rewrite(`import { foo as myFoo } from './secret.server';`, [
      './secret.server',
    ])
    expect(out).toContain('const myFoo = __tss_deny_0.foo')
  })

  test('rewrites mixed default + named imports', () => {
    const out = rewrite(`import def, { a, b } from './secret.server';`, [
      './secret.server',
    ])
    expect(out).toContain('const def = __tss_deny_0')
    expect(out).toContain('const a = __tss_deny_0.a')
    expect(out).toContain('const b = __tss_deny_0.b')
  })

  test('skips type-only import declaration', () => {
    const result = rewriteDeniedImports(
      `import type { Foo } from './secret.server';`,
      '/test.ts',
      new Set(['./secret.server']),
    )
    expect(result).toBeUndefined()
  })

  test('skips type-only specifiers but rewrites value specifiers', () => {
    const out = rewrite(`import { type Foo, bar } from './secret.server';`, [
      './secret.server',
    ])
    expect(out).toContain('const bar = __tss_deny_0.bar')
    expect(out).not.toContain('const Foo')
  })

  test('rewrites export { x } from "denied"', () => {
    const out = rewrite(`export { foo, bar } from './secret.server';`, [
      './secret.server',
    ])
    expectMockImport(out, '__tss_deny_0')
    expect(out).toContain('const __tss_reexport_foo = __tss_deny_0.foo')
    expect(out).toContain('const __tss_reexport_bar = __tss_deny_0.bar')
    expect(out).toMatch(/export\s*\{/)
    expect(out).toContain('__tss_reexport_foo as foo')
    expect(out).toContain('__tss_reexport_bar as bar')
    expect(out).not.toContain('./secret.server')
  })

  test('rewrites aliased re-export', () => {
    const out = rewrite(`export { foo as myFoo } from './secret.server';`, [
      './secret.server',
    ])
    expect(out).toContain('const __tss_reexport_foo = __tss_deny_0.foo')
    expect(out).toContain('__tss_reexport_foo as myFoo')
  })

  test('rewrites string-literal import names with computed access', () => {
    const out = rewrite(
      `import { "foo-bar" as fooBar } from './secret.server';`,
      ['./secret.server'],
    )
    expect(out).toContain('const fooBar = __tss_deny_0["foo-bar"]')
  })

  test('rewrites string-literal re-export names with computed access', () => {
    const out = rewrite(
      `export { "foo-bar" as exposed } from './secret.server';`,
      ['./secret.server'],
    )
    expect(out).toContain('const __tss_reexport_0 = __tss_deny_0["foo-bar"]')
    expect(out).toContain('__tss_reexport_0 as exposed')
  })

  test('removes export * from "denied"', () => {
    const out = rewrite(
      `export * from './secret.server';\nexport const x = 1;`,
      ['./secret.server'],
    )
    expect(out).not.toContain('export *')
    expect(out).not.toContain('./secret.server')
    expect(out).toContain('export const x = 1')
  })

  test('returns undefined when no denied imports are found', () => {
    const result = rewriteDeniedImports(
      `import { ok } from './safe';\nimport { also } from './fine';`,
      '/test.ts',
      new Set(['./secret.server']),
    )
    expect(result).toBeUndefined()
  })

  test('preserves non-denied imports alongside denied ones', () => {
    const out = rewrite(
      `import { safe } from './ok';\nimport { secret } from './secret.server';`,
      ['./secret.server'],
    )
    expect(out).toContain("from './ok'")
    expect(out).toContain('const secret = __tss_deny_0.secret')
  })

  test('handles multiple denied sources with separate counters', () => {
    const out = rewrite(
      `import { a } from './server-a';\nimport { b } from './server-b';`,
      ['./server-a', './server-b'],
    )
    expect(out).toContain('__tss_deny_0')
    expect(out).toContain('__tss_deny_1')
    expect(out).toContain('const a =')
    expect(out).toContain('const b =')
    expect(out).not.toContain('./server-a')
    expect(out).not.toContain('./server-b')
  })

  test('returns a source map', () => {
    const result = rewriteDeniedImports(
      `import { foo } from './secret.server';`,
      '/test.ts',
      new Set(['./secret.server']),
    )
    expect(result).toBeDefined()
    expect(result!.map).toBeDefined()
  })

  test('skips type-only export declaration', () => {
    const result = rewriteDeniedImports(
      `export type { Foo } from './secret.server';`,
      '/test.ts',
      new Set(['./secret.server']),
    )
    expect(result).toBeUndefined()
  })

  test('skips type-only export * from denied', () => {
    const result = rewriteDeniedImports(
      `export type * from './secret.server';`,
      '/test.ts',
      new Set(['./secret.server']),
    )
    expect(result).toBeUndefined()
  })
})

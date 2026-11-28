import { describe, expect, test } from 'vitest'

import {
  isValidExportName,
  getMockExportNamesBySource,
  getNamedExports,
} from '../../src/import-protection/analysis'

describe('isValidExportName', () => {
  test('rejects "default"', () => {
    expect(isValidExportName('default')).toBe(false)
  })

  test('accepts valid JS identifiers', () => {
    expect(isValidExportName('foo')).toBe(true)
    expect(isValidExportName('_private')).toBe(true)
    expect(isValidExportName('$ref')).toBe(true)
    expect(isValidExportName('camelCase')).toBe(true)
    expect(isValidExportName('A')).toBe(true)
  })

  test('rejects names starting with a digit', () => {
    expect(isValidExportName('1foo')).toBe(false)
  })

  test('rejects names with special characters', () => {
    expect(isValidExportName('foo-bar')).toBe(false)
    expect(isValidExportName('foo.bar')).toBe(false)
    expect(isValidExportName('foo bar')).toBe(false)
  })

  test('rejects empty string', () => {
    expect(isValidExportName('')).toBe(false)
  })
})

describe('collectMockExportNamesBySource', () => {
  test('collects named imports', () => {
    const code = `import { alpha, beta } from 'mod-a'`
    const result = getMockExportNamesBySource(code)
    expect(result.get('mod-a')).toEqual(['alpha', 'beta'])
  })

  test('ignores default imports', () => {
    const code = `import def from 'mod-a'`
    const result = getMockExportNamesBySource(code)
    expect(result.has('mod-a')).toBe(false)
  })

  test('collects namespace member usage', () => {
    const code = [
      `import * as ns from 'mod-a'`,
      `const a = ns.alpha`,
      `const b = ns.beta`,
    ].join('\n')
    const result = getMockExportNamesBySource(code)
    expect(result.get('mod-a')).toEqual(['alpha', 'beta'])
  })

  test('collects optional namespace member usage', () => {
    const code = [
      `import * as ns from 'mod-a'`,
      `const maybe = ns.gamma?.()`,
    ].join('\n')
    const result = getMockExportNamesBySource(code)
    expect(result.get('mod-a')).toEqual(['gamma'])
  })

  test('collects string-literal computed namespace member usage', () => {
    const code = [
      `import * as ns from 'mod-a'`,
      `const val = ns['delta']`,
    ].join('\n')
    const result = getMockExportNamesBySource(code)
    expect(result.get('mod-a')).toEqual(['delta'])
  })

  test('collects member usage from default imports', () => {
    const code = [
      `import mock from 'mod-a'`,
      `const a = mock.getSecret`,
      `const b = mock['foo-bar']`,
    ].join('\n')
    const result = getMockExportNamesBySource(code)
    expect(result.get('mod-a')).toEqual(['foo-bar', 'getSecret'])
  })

  test('ignores non-literal computed namespace member usage', () => {
    const code = [
      `import * as ns from 'mod-a'`,
      `const key = 'epsilon'`,
      `const val = ns[key]`,
    ].join('\n')
    const result = getMockExportNamesBySource(code)
    expect(result.has('mod-a')).toBe(false)
  })

  test('ignores type-only imports', () => {
    const code = `import type { Foo } from 'mod-a'`
    const result = getMockExportNamesBySource(code)
    expect(result.has('mod-a')).toBe(false)
  })

  test('ignores type-only specifiers in value imports', () => {
    const code = `import { type Foo, bar } from 'mod-a'`
    const result = getMockExportNamesBySource(code)
    expect(result.get('mod-a')).toEqual(['bar'])
  })

  test('ignores "import { default as x }" specifiers', () => {
    const code = `import { default as myDefault } from 'mod-a'`
    const result = getMockExportNamesBySource(code)
    expect(result.has('mod-a')).toBe(false)
  })

  test('collects from re-exports', () => {
    const code = `export { alpha, beta } from 'mod-a'`
    const result = getMockExportNamesBySource(code)
    expect(result.get('mod-a')).toEqual(['alpha', 'beta'])
  })

  test('ignores type-only re-exports', () => {
    const code = `export type { Foo } from 'mod-a'`
    const result = getMockExportNamesBySource(code)
    expect(result.has('mod-a')).toBe(false)
  })

  test('merges specifiers from multiple imports of the same source', () => {
    const code = [
      `import { alpha } from 'mod-a'`,
      `import { beta } from 'mod-a'`,
    ].join('\n')
    const result = getMockExportNamesBySource(code)
    expect(result.get('mod-a')).toEqual(['alpha', 'beta'])
  })

  test('dedupes specifiers from import and re-export of same source', () => {
    const code = [
      `import { alpha } from 'mod-a'`,
      `export { alpha } from 'mod-a'`,
    ].join('\n')
    const result = getMockExportNamesBySource(code)
    expect(result.get('mod-a')).toEqual(['alpha'])
  })

  test('sorts output alphabetically', () => {
    const code = `import { zeta, alpha, mu } from 'mod-a'`
    const result = getMockExportNamesBySource(code)
    expect(result.get('mod-a')).toEqual(['alpha', 'mu', 'zeta'])
  })

  test('handles multiple sources', () => {
    const code = [
      `import { a } from 'mod-a'`,
      `import { b } from 'mod-b'`,
    ].join('\n')
    const result = getMockExportNamesBySource(code)
    expect(result.get('mod-a')).toEqual(['a'])
    expect(result.get('mod-b')).toEqual(['b'])
  })

  test('returns empty map for code with no relevant imports', () => {
    const code = `const x = 1`
    const result = getMockExportNamesBySource(code)
    expect(result.size).toBe(0)
  })

  test('collects ES2022 string-keyed import specifiers', () => {
    const code = `import { "foo-bar" as x } from 'mod-a'`
    const result = getMockExportNamesBySource(code)
    expect(result.get('mod-a')).toEqual(['foo-bar'])
  })

  test('collects string-literal re-export specifiers', () => {
    const code = `export { "foo-bar" as baz } from 'mod-a'`
    const result = getMockExportNamesBySource(code)
    expect(result.get('mod-a')).toEqual(['foo-bar'])
  })
})

describe('collectNamedExports', () => {
  test('collects declaration exports', () => {
    const code = [
      `export function alpha() {}`,
      `export const beta = 1`,
      `export class Gamma {}`,
    ].join('\n')
    expect(getNamedExports(code)).toEqual(['Gamma', 'alpha', 'beta'])
  })

  test('collects named export specifiers and aliases', () => {
    const code = [
      `const local = 1`,
      `const x = 2`,
      `export { local as renamed, x }`,
    ].join('\n')
    expect(getNamedExports(code)).toEqual(['renamed', 'x'])
  })

  test('ignores default and type-only exports', () => {
    const code = [
      `export default function main() {}`,
      `export type { Foo } from 'mod-a'`,
    ].join('\n')
    expect(getNamedExports(code)).toEqual([])
  })

  test('collects destructured object pattern exports', () => {
    const code = `export const { a, b } = obj`
    expect(getNamedExports(code)).toEqual(['a', 'b'])
  })

  test('collects destructured array pattern exports', () => {
    const code = `export const [x, y] = arr`
    expect(getNamedExports(code)).toEqual(['x', 'y'])
  })

  test('collects renamed destructured exports', () => {
    const code = `export const { a: renamed } = obj`
    expect(getNamedExports(code)).toEqual(['renamed'])
  })

  test('collects nested destructured exports', () => {
    const code = `export const { a: { b, c } } = obj`
    expect(getNamedExports(code)).toEqual(['b', 'c'])
  })

  test('collects destructured exports with defaults', () => {
    const code = `export const { a = 1, b = 2 } = obj`
    expect(getNamedExports(code)).toEqual(['a', 'b'])
  })

  test('collects rest element in destructured exports', () => {
    const code = `export const { a, ...rest } = obj`
    expect(getNamedExports(code)).toEqual(['a', 'rest'])
  })

  test('collects re-exports with aliases', () => {
    const code = `export { default as hello } from './foo'`
    expect(getNamedExports(code)).toEqual(['hello'])
  })

  test('collects string-literal exported names', () => {
    const code = [`const local = 1`, `export { local as "foo-bar" }`].join('\n')
    expect(getNamedExports(code)).toEqual(['foo-bar'])
  })
})

import { describe, expect, test } from 'vitest'
import {
  findOriginalUnsafeUsagePos,
  findPostCompileUsagePos,
} from '../../src/import-protection/analysis'

function pos(code: string, source: string) {
  return findPostCompileUsagePos(code, source)
}

function originalPos(
  code: string,
  source: string,
  envType: 'client' | 'server',
) {
  return findOriginalUnsafeUsagePos(code, source, envType)
}

describe('findPostCompileUsagePos', () => {
  test('returns undefined when there is no import from the source', () => {
    expect(pos(`const x = 1`, 'denied')).toBeUndefined()
  })

  test('returns undefined when import is type-only', () => {
    expect(
      pos(`import type { Foo } from 'denied';\nconst x = 1`, 'denied'),
    ).toBeUndefined()
  })

  test('finds preferred call usage for named import', () => {
    const p = pos(
      `import { getRequest } from 'denied';\nexport function x(){ return getRequest() }`,
      'denied',
    )
    expect(p).toBeDefined()
    expect(p!.line).toBe(2)
  })

  test('prefers call usage over earlier non-preferred identifier usage', () => {
    const p = pos(
      `import { getRequest } from 'denied';\nconst a = getRequest;\ngetRequest()`,
      'denied',
    )
    expect(p).toBeDefined()
    expect(p!.line).toBe(3)
  })

  test('falls back to non-binding identifier usage if no preferred usage exists', () => {
    const p = pos(`import { x } from 'denied';\nconst y = x;`, 'denied')
    expect(p).toBeDefined()
    expect(p!.line).toBe(2)
  })

  test('ignores binding positions (variable declarator id)', () => {
    const p = pos(
      `import { x } from 'denied';\nconst x = 1;\nconst y = x;`,
      'denied',
    )
    expect(p).toBeUndefined()
  })

  test('ignores object property key (non-shorthand) but still finds later usage', () => {
    const p = pos(
      `import { x } from 'denied';\nconst obj = { x: 1 };\nx()`,
      'denied',
    )
    expect(p).toBeDefined()
    expect(p!.line).toBe(3)
  })

  test('ignores shadowed identifiers in nested function scope', () => {
    const p = pos(
      `import { x } from 'denied';\nfunction inner(x: any){ return x }\nconst y = x;`,
      'denied',
    )
    expect(p).toBeDefined()
    expect(p!.line).toBe(3)
  })

  test('ignores shadowing via catch clause param', () => {
    const p = pos(
      `import { err } from 'denied';\ntry { throw 1 } catch (err) { console.log(err) }\nconsole.log(err)`,
      'denied',
    )
    expect(p).toBeDefined()
    expect(p!.line).toBe(3)
  })

  test('handles namespace member preferred usage (ns.foo)', () => {
    const p = pos(`import * as ns from 'denied';\nns.getRequest()`, 'denied')
    expect(p).toBeDefined()
    expect(p!.line).toBe(2)
  })

  test('handles default import preferred usage (call)', () => {
    const p = pos(`import req from 'denied';\nreq()`, 'denied')
    expect(p).toBeDefined()
    expect(p!.line).toBe(2)
  })

  test('counts object pattern shorthand as usage (not a binding position)', () => {
    const p = pos(
      `import { foo } from 'denied';\nconst obj = { foo };`,
      'denied',
    )
    expect(p).toBeDefined()
    expect(p!.line).toBe(2)
  })

  test('var in block scope shadows import at function level', () => {
    const p = pos(
      [
        `import { x } from 'denied';`,
        `function f() {`,
        `  if (true) {`,
        `    var x = 1;`,
        `  }`,
        `  return x;`,
        `}`,
      ].join('\n'),
      'denied',
    )
    expect(p).toBeUndefined()
  })

  test('var in block scope does NOT shadow import in outer scope', () => {
    const p = pos(
      [
        `import { x } from 'denied';`,
        `function f() {`,
        `  if (true) {`,
        `    var x = 1;`,
        `  }`,
        `  return x;`,
        `}`,
        `console.log(x);`,
      ].join('\n'),
      'denied',
    )
    expect(p).toBeDefined()
    expect(p!.line).toBe(8)
  })

  test('let in block scope does NOT shadow import in enclosing function', () => {
    const p = pos(
      [
        `import { x } from 'denied';`,
        `function f() {`,
        `  if (true) {`,
        `    let x = 1;`,
        `  }`,
        `  return x;`,
        `}`,
      ].join('\n'),
      'denied',
    )
    expect(p).toBeDefined()
    expect(p!.line).toBe(6)
  })

  test('const in block scope does NOT shadow import in enclosing function', () => {
    const p = pos(
      [
        `import { x } from 'denied';`,
        `function f() {`,
        `  {`,
        `    const x = 1;`,
        `  }`,
        `  return x;`,
        `}`,
      ].join('\n'),
      'denied',
    )
    expect(p).toBeDefined()
    expect(p!.line).toBe(6)
  })

  test('var in nested arrow function does not shadow outer scope', () => {
    const p = pos(
      [
        `import { x } from 'denied';`,
        `const outer = () => {`,
        `  const inner = () => {`,
        `    var x = 1;`,
        `  };`,
        `  return x;`,
        `};`,
      ].join('\n'),
      'denied',
    )
    expect(p).toBeDefined()
    expect(p!.line).toBe(6)
  })
})

describe('findOriginalUnsafeUsagePos', () => {
  test('skips createServerFn handler usage in client env and finds later unsafe usage', () => {
    const p = originalPos(
      [
        `import { createServerFn } from '@tanstack/react-start';`,
        `import { getSecret } from './secret.server';`,
        `export const safeServerFn = createServerFn().handler(async () => {`,
        `  return getSecret();`,
        `});`,
        `export function leakyReference() {`,
        `  return getSecret();`,
        `}`,
      ].join('\n'),
      './secret.server',
      'client',
    )

    expect(p).toBeDefined()
    expect(p!.line).toBe(7)
  })

  test('returns undefined when usage is only inside createServerOnlyFn in client env', () => {
    const p = originalPos(
      [
        `import { createServerOnlyFn } from '@tanstack/react-start';`,
        `import { getSecret } from './secret.server';`,
        `export const safeServerOnly = createServerOnlyFn(() => {`,
        `  return getSecret();`,
        `});`,
      ].join('\n'),
      './secret.server',
      'client',
    )

    expect(p).toBeUndefined()
  })

  test('returns undefined when usage is only inside createMiddleware.server in client env', () => {
    const p = originalPos(
      [
        `import { createMiddleware } from '@tanstack/react-start';`,
        `import { getSecret } from './secret.server';`,
        `const middleware = createMiddleware({ type: 'function' }).server(({ next }) => {`,
        `  const secret = getSecret();`,
        `  return next({ context: { secret } });`,
        `});`,
      ].join('\n'),
      './secret.server',
      'client',
    )

    expect(p).toBeUndefined()
  })

  test('returns undefined when usage is only inside createIsomorphicFn.server in client env', () => {
    const p = originalPos(
      [
        `import { createIsomorphicFn } from '@tanstack/react-start';`,
        `import { getSecret } from './secret.server';`,
        `export const safeIsomorphic = createIsomorphicFn().server(() => {`,
        `  return getSecret();`,
        `});`,
      ].join('\n'),
      './secret.server',
      'client',
    )

    expect(p).toBeUndefined()
  })

  test('returns undefined when usage is only inside createClientOnlyFn in server env', () => {
    const p = originalPos(
      [
        `import { createClientOnlyFn } from '@tanstack/react-start';`,
        `import { readWindow } from './browser.client';`,
        `export const safeClientOnly = createClientOnlyFn(() => {`,
        `  return readWindow();`,
        `});`,
      ].join('\n'),
      './browser.client',
      'server',
    )

    expect(p).toBeUndefined()
  })
})

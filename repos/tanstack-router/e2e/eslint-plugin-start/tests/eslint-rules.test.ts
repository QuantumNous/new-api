import { ESLint } from 'eslint'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, test, expect, beforeAll } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

let eslint: ESLint

beforeAll(() => {
  eslint = new ESLint({
    cwd: rootDir,
    overrideConfigFile: path.join(rootDir, 'eslint.config.js'),
  })
})

async function lintFile(relativePath: string) {
  const results = await eslint.lintFiles([
    path.join(rootDir, 'src', relativePath),
  ])
  return results[0]
}

function getErrorsForRule(result: ESLint.LintResult, ruleId: string) {
  return result.messages.filter((m) => m.ruleId === ruleId)
}

describe('no-client-code-in-server-component', () => {
  const ruleId = '@tanstack/start/no-client-code-in-server-component'

  test('errors on cross-file client code via callback pattern', async () => {
    const result = await lintFile(
      'fixtures/cross-file-server-component/server-with-callback.tsx',
    )
    const errors = getErrorsForRule(result, ruleId)
    expect(errors.length).toBeGreaterThan(0)
    // Should mention ClientComponent or onClick
    expect(errors[0].message).toMatch(/onClick|ClientComponent/i)
  })

  test('errors on direct component reference pattern', async () => {
    const result = await lintFile(
      'fixtures/direct-component-reference/server-direct-ref.tsx',
    )
    const errors = getErrorsForRule(result, ruleId)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toMatch(/onClick|DirectClientComponent/i)
  })

  test('errors on transitive client code (3 levels deep)', async () => {
    const result = await lintFile(
      'fixtures/cross-file-server-component/transitive-server.tsx',
    )
    const errors = getErrorsForRule(result, ruleId)
    expect(errors.length).toBeGreaterThan(0)
  })

  test('no error when use client boundary exists', async () => {
    const result = await lintFile(
      'fixtures/cross-file-server-component/server-with-use-client.tsx',
    )
    const errors = getErrorsForRule(result, ruleId)
    expect(errors.length).toBe(0)
  })
})

describe('no-async-client-component', () => {
  const ruleId = '@tanstack/start/no-async-client-component'

  test('errors on async component in route options (direct ref) - at usage site only', async () => {
    // Should error at route file, not at async component definition
    const routeResult = await lintFile(
      'fixtures/cross-file-async-component/route-with-async.tsx',
    )
    const routeErrors = getErrorsForRule(routeResult, ruleId)
    expect(routeErrors.length).toBeGreaterThan(0)
    expect(routeErrors[0].message).toMatch(/async/i)

    // Definition file should have NO errors
    const defResult = await lintFile(
      'fixtures/cross-file-async-component/async-component.tsx',
    )
    const defErrors = getErrorsForRule(defResult, ruleId)
    expect(defErrors.length).toBe(0)
  })

  test('errors on async component in route options (inline JSX) - at usage site only', async () => {
    // Should error at route file, not at async component definition
    const routeResult = await lintFile(
      'fixtures/cross-file-async-component/route-with-inline-async.tsx',
    )
    const routeErrors = getErrorsForRule(routeResult, ruleId)
    expect(routeErrors.length).toBeGreaterThan(0)
    expect(routeErrors[0].message).toMatch(/async/i)

    // Definition file should have NO errors
    const defResult = await lintFile(
      'fixtures/cross-file-async-component/inline-async-component.tsx',
    )
    const defErrors = getErrorsForRule(defResult, ruleId)
    expect(defErrors.length).toBe(0)
  })

  test('no error on sync component in route options', async () => {
    const result = await lintFile(
      'fixtures/cross-file-async-component/route-with-sync.tsx',
    )
    const errors = getErrorsForRule(result, ruleId)
    expect(errors.length).toBe(0)
  })

  test('no error when route also defines createServerFn(createCompositeComponent)', async () => {
    const result = await lintFile(
      'fixtures/cross-file-async-component/route-with-createServerFn-and-server-component.tsx',
    )
    const errors = getErrorsForRule(result, ruleId)
    expect(errors.length).toBe(0)
  })
})

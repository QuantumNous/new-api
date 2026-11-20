import path from 'node:path'
import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

import { extractViolationsFromLog, stripAnsi } from './violations.utils'

interface ErrorResult {
  exitCode?: number
  stdout?: string
  stderr?: string
  combined: string
}

async function readResult(name: string): Promise<ErrorResult> {
  const p = path.resolve(import.meta.dirname, '..', name)
  const mod: { default: ErrorResult } = await import(p, {
    with: { type: 'json' },
  })
  return mod.default
}

// Build error mode tests

test('build fails with non-zero exit code in error mode', async () => {
  const result = await readResult('error-build-result.json')
  expect(result.exitCode).not.toBe(0)
})

test('build output contains import-protection violation', async () => {
  const result = await readResult('error-build-result.json')
  const text = stripAnsi(result.combined)
  expect(text).toContain('[import-protection] Import denied in')
})

test('build violation mentions environment', async () => {
  const result = await readResult('error-build-result.json')
  const text = stripAnsi(result.combined)
  const hasClient = text.includes('Import denied in client environment')
  const hasServer = text.includes('Import denied in server environment')
  expect(hasClient || hasServer).toBe(true)
})

test('build violation references custom file pattern', async () => {
  const result = await readResult('error-build-result.json')
  const text = stripAnsi(result.combined)
  // The violation should reference .backend. or .frontend. files
  const hasBackend = text.includes('credentials.backend')
  const hasFrontend = text.includes('browser-api.frontend')
  expect(hasBackend || hasFrontend).toBe(true)
})

test('build violation is parseable', async () => {
  const result = await readResult('error-build-result.json')
  const violations = extractViolationsFromLog(result.combined)
  expect(violations.length).toBeGreaterThanOrEqual(1)

  const v = violations[0]
  expect(v.envType).toMatch(/^(client|server)$/)
  expect(v.importer).toBeTruthy()
  expect(v.specifier).toBeTruthy()
  expect(v.type).toBe('file')
})

// Dev error mode tests

test('dev server logs contain import-protection error', async () => {
  const result = await readResult('error-dev-result.json')
  const text = stripAnsi(result.combined)
  expect(text).toContain('[import-protection] Import denied in')
})

test('dev error violation references custom file pattern', async () => {
  const result = await readResult('error-dev-result.json')
  const text = stripAnsi(result.combined)
  const hasBackend = text.includes('credentials.backend')
  const hasFrontend = text.includes('browser-api.frontend')
  expect(hasBackend || hasFrontend).toBe(true)
})

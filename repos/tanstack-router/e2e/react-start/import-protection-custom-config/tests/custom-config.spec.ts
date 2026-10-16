import path from 'node:path'
import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import type { Violation } from './violations.utils'

async function readViolations(
  type: 'build' | 'dev',
): Promise<Array<Violation>> {
  const filename = `violations.${type}.json`
  const violationsPath = path.resolve(import.meta.dirname, '..', filename)
  const mod = await import(violationsPath, {
    with: { type: 'json' },
  } as any)
  return (mod.default ?? []) as Array<Violation>
}

test.use({
  whitelistErrors: [/mock/i, /Cannot read properties/i, /undefined/i],
})

// -----------------------------------------------------------------------
// App loads
// -----------------------------------------------------------------------

test('app loads successfully with custom config mock mode', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('heading')).toContainText(
    'Import Protection Custom Config E2E',
  )
  await expect(page.getByTestId('status')).toContainText(
    'App loaded successfully with custom file patterns',
  )
})

test('backend leak route loads in mock mode', async ({ page }) => {
  await page.goto('/backend-leak')
  await expect(page.getByTestId('backend-leak-heading')).toContainText(
    'Backend Leak',
  )
})

test('frontend leak route loads in mock mode', async ({ page }) => {
  await page.goto('/frontend-leak')
  await expect(page.getByTestId('frontend-leak-heading')).toContainText(
    'Frontend Leak',
  )
})

// -----------------------------------------------------------------------
// Build violations
// -----------------------------------------------------------------------

test('violations.build.json is written', async () => {
  const violations = await readViolations('build')
  expect(violations.length).toBeGreaterThan(0)
})

test('build: client violation for .backend. file (custom pattern)', async () => {
  const violations = await readViolations('build')

  const backendViolation = violations.find(
    (v) =>
      v.envType === 'client' &&
      v.type === 'file' &&
      (v.specifier.includes('credentials.backend') ||
        v.resolved?.includes('credentials.backend')),
  )

  expect(backendViolation).toBeDefined()
  expect(backendViolation!.envType).toBe('client')
})

test('build: server violation for .frontend. file (custom pattern)', async () => {
  const violations = await readViolations('build')

  const frontendViolation = violations.find(
    (v) =>
      v.envType === 'server' &&
      v.type === 'file' &&
      (v.specifier.includes('browser-api.frontend') ||
        v.resolved?.includes('browser-api.frontend')),
  )

  expect(frontendViolation).toBeDefined()
  expect(frontendViolation!.envType).toBe('server')
})

test('build: no false positives for default .server./.client. patterns', async () => {
  const violations = await readViolations('build')

  // Since we use custom patterns, .server. and .client. should NOT trigger
  // violations (they are not in the deny lists).
  const defaultPatternViolation = violations.find(
    (v) =>
      v.type === 'file' &&
      (v.resolved?.includes('.server.') || v.resolved?.includes('.client.')),
  )

  expect(defaultPatternViolation).toBeUndefined()
})

// -----------------------------------------------------------------------
// Build: mock integrity (no real secrets in client JS bundle)
// -----------------------------------------------------------------------

test('build: client JS bundle does not contain real backend secret', async () => {
  // Read all client JS chunks and verify the real secret string is absent.
  // (The SSR-rendered HTML may contain the real value because the server env
  // is allowed to use .backend. files — we only check the client JS here.)
  const fs = await import('node:fs')
  const path = await import('node:path')
  const clientDir = path.resolve(
    import.meta.dirname,
    '..',
    'dist',
    'client',
    'assets',
  )
  const jsFiles = fs.readdirSync(clientDir).filter((f) => f.endsWith('.js'))
  const allClientCode = jsFiles
    .map((f) => fs.readFileSync(path.join(clientDir, f), 'utf-8'))
    .join('\n')

  expect(allClientCode).not.toContain('custom-backend-secret-99999')
})

// -----------------------------------------------------------------------
// Dev violations
// -----------------------------------------------------------------------

test('violations.dev.json is written', async () => {
  const violations = await readViolations('dev')
  expect(violations.length).toBeGreaterThan(0)
})

test('dev: client violation for .backend. file (custom pattern)', async () => {
  const violations = await readViolations('dev')

  const backendViolation = violations.find(
    (v) =>
      v.envType === 'client' &&
      v.type === 'file' &&
      (v.specifier.includes('credentials.backend') ||
        v.resolved?.includes('credentials.backend')),
  )

  expect(backendViolation).toBeDefined()
  expect(backendViolation!.envType).toBe('client')
})

test('dev: server violation for .frontend. file (custom pattern)', async () => {
  const violations = await readViolations('dev')

  const frontendViolation = violations.find(
    (v) =>
      v.envType === 'server' &&
      v.type === 'file' &&
      (v.specifier.includes('browser-api.frontend') ||
        v.resolved?.includes('browser-api.frontend')),
  )

  expect(frontendViolation).toBeDefined()
  expect(frontendViolation!.envType).toBe('server')
})

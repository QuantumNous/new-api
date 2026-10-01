import path from 'node:path'
import fs from 'node:fs'
import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import type { Violation } from './violations.utils'
import type { Page } from '@playwright/test'

const toolchain = process.env.E2E_TOOLCHAIN ?? 'vite'
const fixtureRoot = path.resolve(import.meta.dirname, '..')
const workspaceRoot = path.resolve(import.meta.dirname, '../../../..')

function stripLocation(value: string): string {
  return value.replace(/:\d+:\d+$/, '')
}

function normalizeKeyPath(value: string): string {
  let normalized = stripLocation(value).replace(/\\/g, '/')
  const normalizedFixtureRoot = fixtureRoot.replace(/\\/g, '/')
  const normalizedWorkspaceRoot = workspaceRoot.replace(/\\/g, '/')

  if (normalized.startsWith(`${normalizedFixtureRoot}/`)) {
    normalized = normalized.slice(normalizedFixtureRoot.length + 1)
  } else if (normalized.startsWith(`${normalizedWorkspaceRoot}/`)) {
    normalized = normalized.slice(normalizedWorkspaceRoot.length + 1)
  }

  normalized = normalized.replace(
    /^packages\/react-start\/dist\/esm\/(.+)$/,
    '@tanstack/react-start/$1',
  )
  normalized = normalized.replace(/\.[cm]?[tj]sx?$/, '')
  normalized = normalized.replace(/\/index$/, '')

  return normalized
}

async function readViolations(
  type: 'build' | 'dev' | 'dev.cold' | 'dev.warm',
): Promise<Array<Violation>> {
  const filename = `violations.${type}.json`
  const violationsPath = path.resolve(import.meta.dirname, '..', filename)
  const mod = await import(violationsPath, {
    with: { type: 'json' },
  } as any)
  return (mod.default ?? []) as Array<Violation>
}

async function expectRouteHeading(
  page: Page,
  route: string,
  testId: string,
  heading: string,
): Promise<void> {
  await page.goto(route)
  await expect(page.getByTestId(testId)).toContainText(heading)
}

function findClientSecretServerFileViolation(
  violations: Array<Violation>,
  importerFragment: string,
  specifierMatches: (specifier: string) => boolean,
): Violation | undefined {
  return violations.find(
    (v) =>
      v.envType === 'client' &&
      v.type === 'file' &&
      v.importer.includes(importerFragment) &&
      (specifierMatches(v.specifier) ||
        v.resolved?.includes('violations/secret.server')),
  )
}

function findBarrelReexportHits(
  violations: Array<Violation>,
): Array<Violation> {
  return violations.filter(
    (v) =>
      v.envType === 'client' &&
      (v.importer.includes('barrel-reexport') ||
        v.importer.includes('barrel-false-positive') ||
        v.specifier.includes('db.server') ||
        v.resolved?.includes('barrel-reexport') ||
        v.trace.some(
          (s) =>
            s.file.includes('barrel-reexport') ||
            s.file.includes('barrel-false-positive'),
        )),
  )
}

function findBarrelMarkerHits(violations: Array<Violation>): Array<Violation> {
  return violations.filter(
    (v) =>
      v.envType === 'client' &&
      (v.specifier.includes('server-only') ||
        v.specifier.includes('foo') ||
        v.resolved?.includes('foo')) &&
      v.trace.some(
        (s) =>
          s.file.includes('barrel-reexport') ||
          s.file.includes('barrel-false-positive'),
      ),
  )
}

function findTypeOnlyProtectedImportHits(
  violations: Array<Violation>,
): Array<Violation> {
  return violations.filter(
    (v) =>
      v.envType === 'client' &&
      (v.importer.includes('type-only-protected-import') ||
        v.importer.includes('type-only.server') ||
        v.specifier.includes('type-only.server') ||
        v.resolved?.includes('type-only.server') ||
        v.trace.some(
          (s) =>
            s.file.includes('type-only-protected-import') ||
            s.file.includes('type-only.server'),
        )),
  )
}

test.use({
  // The mock proxy returns undefined-ish values, which may cause
  // React rendering warnings — whitelist those
  whitelistErrors: [/mock/i, /Cannot read properties/i, /undefined/i],
})

test.beforeEach(({}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL
  if (!baseURL) {
    throw new Error(
      'Missing Playwright baseURL for import-protection e2e. Run with `pnpm exec playwright test -c e2e/react-start/import-protection/playwright.config.ts` (or configure `use.baseURL`).',
    )
  }
})

test('app loads successfully with mock mode', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('heading')).toContainText(
    'Import Protection E2E',
  )
  await expect(page.getByTestId('status')).toContainText(
    'App loaded successfully with mock mode',
  )
})

test('leaky server import route loads in mock mode', async ({ page }) => {
  await page.goto('/leaky-server-import')
  await expect(page.getByTestId('leaky-heading')).toContainText(
    'Leaky Server Import',
  )
})

test('client-only violations route loads in mock mode', async ({ page }) => {
  await page.goto('/client-only-violations')
  await expect(page.getByTestId('client-only-heading')).toContainText(
    'Client-Only Violations',
  )
})

for (const mode of ['build', 'dev'] as const) {
  test(`violations.${mode}.json is written during ${mode}`, async () => {
    const violations = await readViolations(mode)
    expect(violations.length).toBeGreaterThan(0)
  })
}

test('file-based violation: client importing .server. file', async () => {
  const violations = await readViolations('build')

  // Find violation for the secret.server.ts file
  const fileViolation = violations.find(
    (v) =>
      v.type === 'file' &&
      v.importer.includes('edge-a') &&
      (v.specifier.includes('secret.server') ||
        v.resolved?.includes('secret.server')),
  )

  expect(fileViolation).toBeDefined()
  expect(fileViolation!.envType).toBe('client')
})

test('marker violation: client importing server-only marked module', async () => {
  const violations = await readViolations('build')

  // Find the marker violation — it could manifest in two ways:
  // 1. As a 'marker' type when the marker import is processed
  // 2. As the resolved file being marked server-only and then imported from client
  const markerViolation = violations.find(
    (v) =>
      v.type === 'marker' &&
      (v.importer.includes('marked-server-only') ||
        v.resolved?.includes('marked-server-only') ||
        v.specifier.includes('server-only')),
  )

  expect(markerViolation).toBeDefined()
})

test('build log does not contain mock-edge missing export warnings', () => {
  const buildLogPath = path.resolve(
    import.meta.dirname,
    '..',
    'webserver-build.log',
  )

  if (!fs.existsSync(buildLogPath)) {
    return
  }

  const log = fs.readFileSync(buildLogPath, 'utf-8')
  expect(log).not.toMatch(/not exported by\s+"[^"\n]*mock:build:/)
})

for (const mode of ['build', 'dev'] as const) {
  test(`violations contain trace information in ${mode}`, async () => {
    const violations = await readViolations(mode)

    const fileViolation = violations.find(
      (v) =>
        v.type === 'file' &&
        (v.specifier.includes('secret.server') ||
          v.resolved?.includes('secret.server')),
    )

    expect(fileViolation).toBeDefined()
    expect(fileViolation!.trace).toBeDefined()
    expect(fileViolation!.trace.length).toBeGreaterThanOrEqual(2)
  })
}

test('deep trace includes full chain', async () => {
  const violations = await readViolations('build')

  const v = violations.find(
    (x) => x.type === 'file' && x.importer.includes('edge-3'),
  )

  expect(v).toBeDefined()
  const traceText = v!.trace.map((s) => s.file).join(' -> ')
  expect(traceText).toContain('routes/index')
  expect(traceText).toContain('violations/edge-1')
  expect(traceText).toContain('violations/edge-2')
  expect(traceText).toContain('violations/edge-3')
})

for (const mode of ['build', 'dev'] as const) {
  test(`all trace steps include line numbers in ${mode}`, async () => {
    const violations = await readViolations(mode)

    // Find a violation with a multi-step trace
    const v = violations.find(
      (x) =>
        x.type === 'file' &&
        x.trace.length >= 3 &&
        x.trace.some((s) => s.line != null),
    )
    expect(v).toBeDefined()

    // Every non-entry trace step should have a line number, except:
    // - Virtual specifiers (e.g. ?tsr-split=) injected by the router plugin
    // - routeTree.gen.ts steps (generated code, import locations unreliable)
    // - Steps immediately after ?tsr-split= (the re-entry from the split chunk)
    for (let i = 1; i < v!.trace.length; i++) {
      const step = v!.trace[i]
      if (step.specifier?.includes('?tsr-split=')) continue
      if (step.file.includes('routeTree.gen')) continue
      // In dev mode, the step right after a ?tsr-split= virtual step
      // re-enters the same file — its import may not be locatable.
      const prev = v!.trace[i - 1]
      if (prev?.specifier?.includes('?tsr-split=')) continue
      if (
        step.line == null &&
        step.file.startsWith('src/routes/') &&
        prev?.file.includes('routeTree.gen')
      ) {
        continue
      }

      expect(
        step.line,
        `trace step ${i} (${step.file}) should have a line number`,
      ).toBeDefined()
      expect(step.line).toBeGreaterThan(0)
    }
  })
}

for (const mode of ['build', 'dev'] as const) {
  test(`leaf trace step includes the denied import specifier in ${mode}`, async () => {
    const violations = await readViolations(mode)

    const v = violations.find(
      (x) =>
        x.type === 'file' &&
        x.envType === 'client' &&
        (x.specifier.includes('secret.server') ||
          x.resolved?.includes('secret.server')) &&
        x.trace[x.trace.length - 1]?.line != null,
    )
    expect(v).toBeDefined()

    const last = v!.trace[v!.trace.length - 1]
    expect(last.specifier).toContain('secret.server')
    expect(last.line).toBeDefined()
    expect(last.line).toBeGreaterThan(0)
  })
}

for (const mode of ['build', 'dev'] as const) {
  test(`violation includes code snippet showing offending usage in ${mode}`, async () => {
    const violations = await readViolations(mode)

    const v = violations.find(
      (x) =>
        x.type === 'file' &&
        x.envType === 'client' &&
        (x.specifier.includes('secret.server') ||
          x.resolved?.includes('secret.server')) &&
        x.snippet?.lines.join('\n').includes('getSecret'),
    )
    expect(v).toBeDefined()
    expect(v!.snippet).toBeDefined()
    expect(v!.snippet!.lines.length).toBeGreaterThan(0)

    const snippetText = v!.snippet!.lines.join('\n')
    expect(snippetText).toContain('getSecret')

    if (v!.snippet!.location) {
      expect(v!.snippet!.location).toMatch(/:\d+:\d+/)
    }
  })
}

for (const mode of ['build', 'dev'] as const) {
  test(`compiler leak violation includes line/col in importer in ${mode}`, async () => {
    const violations = await readViolations(mode)
    const v = violations.find(
      (x) =>
        x.importer.includes('compiler-leak') &&
        x.type === 'file' &&
        /:\d+:\d+$/.test(x.importer),
    )
    expect(v).toBeDefined()
    expect(v!.importer).toMatch(/:\d+:\d+$/)
  })
}

for (const mode of ['build', 'dev'] as const) {
  test(`leaky @tanstack/react-start/server import points to usage site in ${mode}`, async () => {
    const violations = await readViolations(mode)
    const v = violations.find(
      (x) =>
        x.type === 'specifier' &&
        x.specifier === '@tanstack/react-start/server' &&
        x.importer.includes('leaky-server-import') &&
        /:\d+:\d+$/.test(x.importer),
    )
    expect(v).toBeDefined()
    expect(v!.importer).toContain('violations/leaky-server-import')
    expect(v!.importer).toMatch(/:\d+:\d+$/)
  })
}

for (const mode of ['build', 'dev'] as const) {
  test(`client-env violations exist in ${mode}`, async () => {
    const violations = await readViolations(mode)
    const clientViolations = violations.filter((v) => v.envType === 'client')
    expect(clientViolations.length).toBeGreaterThanOrEqual(
      mode === 'build' ? 2 : 1,
    )
  })
}

for (const mode of ['build', 'dev', 'dev.warm'] as const) {
  test(`no false positive for boundary-safe pattern in ${mode}`, async () => {
    const violations = await readViolations(mode)

    // boundary-safe.ts imports secret.server.ts but only uses it inside
    // compiler boundaries (createServerFn/createServerOnlyFn/createIsomorphicFn).
    const isBoundarySafe = (s: string) => /(?<![/-])boundary-safe/.test(s)
    const safeHits = violations.filter(
      (v) =>
        v.envType === 'client' &&
        (isBoundarySafe(v.importer) ||
          v.trace.some((s) => isBoundarySafe(s.file))),
    )

    expect(safeHits).toEqual([])
  })
}

for (const mode of ['build', 'dev'] as const) {
  test(`compiler-processed module has code snippet in ${mode}`, async () => {
    const violations = await readViolations(mode)

    // compiler-leak.ts is processed by the Start compiler (createServerFn),
    // which shortens the output.  The snippet must still show the original
    // source lines (mapped via sourcesContent in the compiler's sourcemap).
    const compilerViolation = violations.find(
      (v) =>
        v.envType === 'client' &&
        v.importer.includes('compiler-leak') &&
        !!v.snippet,
    )

    expect(compilerViolation).toBeDefined()
    expect(compilerViolation!.snippet).toBeDefined()
    expect(compilerViolation!.snippet!.lines.length).toBeGreaterThan(0)

    const snippetText = compilerViolation!.snippet!.lines.join('\n')
    expect(snippetText).toContain('getSecret')
  })
}

test('file-based violation: SSR importing .client. file', async () => {
  const violations = await readViolations('build')

  const v = violations.find(
    (x) =>
      x.type === 'file' &&
      x.envType === 'server' &&
      (x.specifier.includes('browser-api.client') ||
        x.resolved?.includes('browser-api.client')),
  )

  expect(v).toBeDefined()
  expect(v!.envType).toBe('server')
  expect(v!.type).toBe('file')

  // Should have trace info leading back through the route
  expect(v!.trace.length).toBeGreaterThanOrEqual(2)
})

test('marker violation: SSR importing client-only marked module', async () => {
  const violations = await readViolations('build')

  const v = violations.find(
    (x) =>
      x.type === 'marker' &&
      x.envType === 'server' &&
      (x.importer.includes('marked-client-only') ||
        x.specifier.includes('client-only')),
  )

  expect(v).toBeDefined()
  expect(v!.envType).toBe('server')
  expect(v!.type).toBe('marker')
})

test('client-only JSX route loads in mock mode', async ({ page }) => {
  await page.goto('/client-only-jsx')
  await expect(page.getByTestId('client-only-jsx-heading')).toContainText(
    'Client-Only JSX',
  )
})

test('file-based violation: SSR importing .client. file with JSX usage', async () => {
  const violations = await readViolations('build')

  const v = violations.find(
    (x) =>
      x.type === 'file' &&
      x.envType === 'server' &&
      (x.specifier.includes('window-size.client') ||
        x.resolved?.includes('window-size.client')),
  )

  expect(v).toBeDefined()
  expect(v!.envType).toBe('server')
  expect(v!.type).toBe('file')

  // The snippet should show the JSX usage site where WindowSize() is called,
  // not just the import statement.
  expect(v!.snippet).toBeDefined()
  expect(v!.snippet!.lines.length).toBeGreaterThan(0)

  const snippetText = v!.snippet!.lines.join('\n')
  expect(snippetText).toContain('WindowSize')
})

test('build has violations in both client and SSR environments', async () => {
  const violations = await readViolations('build')

  const clientViolations = violations.filter((v) => v.envType === 'client')
  const ssrViolations = violations.filter((v) => v.envType === 'server')

  expect(clientViolations.length).toBeGreaterThanOrEqual(2)
  expect(ssrViolations.length).toBeGreaterThanOrEqual(2)
})

for (const mode of ['build', 'dev', 'dev.warm'] as const) {
  test(`no false positive for factory-safe middleware pattern in ${mode}`, async () => {
    const violations = await readViolations(mode)

    // createSecretFactory.ts uses @tanstack/react-start/server and ../secret.server
    // ONLY inside createMiddleware().server() callbacks.  The compiler strips these
    // on the client, so import-protection must not fire for them.
    const factoryHits = violations.filter(
      (v) =>
        v.envType === 'client' &&
        (v.importer.includes('createSecretFactory') ||
          v.importer.includes('factory-safe') ||
          v.trace.some(
            (s) =>
              s.file.includes('createSecretFactory') ||
              s.file.includes('factory-safe'),
          )),
    )

    expect(factoryHits).toEqual([])
  })
}

for (const mode of ['build', 'dev', 'dev.warm'] as const) {
  test(`no false positive for cross-boundary-safe pattern in ${mode}`, async () => {
    const violations = await readViolations(mode)

    // session-util.ts imports @tanstack/react-start/server, but it's only ever
    // imported by usage.ts which uses it exclusively inside compiler boundaries
    // (createServerFn().handler, createMiddleware().server).  The compiler should
    // prune the import chain from the client build.
    const crossHits = violations.filter(
      (v) =>
        v.envType === 'client' &&
        (v.importer.includes('cross-boundary-safe') ||
          v.importer.includes('session-util') ||
          v.trace.some(
            (s) =>
              s.file.includes('cross-boundary-safe') ||
              s.file.includes('session-util'),
          )),
    )

    expect(crossHits).toEqual([])
  })
}

for (const mode of ['build', 'dev', 'dev.warm'] as const) {
  test(`cross-boundary-leak: leaky consumer still produces violation in ${mode}`, async () => {
    const violations = await readViolations(mode)

    const leakHits = violations.filter(
      (v) =>
        v.envType === 'client' &&
        (v.importer.includes('cross-boundary-leak') ||
          v.importer.includes('shared-util') ||
          v.trace.some(
            (s) =>
              s.file.includes('leaky-consumer') ||
              s.file.includes('shared-util'),
          )),
    )

    expect(leakHits.length).toBeGreaterThanOrEqual(1)
  })
}

for (const mode of ['build', 'dev', 'dev.warm'] as const) {
  test(`beforeload-leak: server import via beforeLoad triggers client violation in ${mode}`, async () => {
    const violations = await readViolations(mode)

    const hits = violations.filter(
      (v) =>
        v.envType === 'client' &&
        (v.importer.includes('beforeload-server-leak') ||
          v.importer.includes('beforeload-leak') ||
          v.trace.some(
            (s) =>
              s.file.includes('beforeload-server-leak') ||
              s.file.includes('beforeload-leak'),
          )),
    )

    expect(hits.length).toBeGreaterThanOrEqual(1)

    if (mode === 'build') {
      const specHit = hits.find(
        (v) =>
          v.type === 'specifier' &&
          v.specifier === '@tanstack/react-start/server',
      )
      expect(specHit).toBeDefined()
    }
  })
}

test('beforeload-leak: violation trace includes the route file', async () => {
  const violations = await readViolations('build')

  const hit = violations.find(
    (v) =>
      v.envType === 'client' &&
      v.type === 'specifier' &&
      v.specifier === '@tanstack/react-start/server' &&
      (v.importer.includes('beforeload-server-leak') ||
        v.trace.some((s) => s.file.includes('beforeload-server-leak'))),
  )

  expect(hit).toBeDefined()
  expect(hit!.trace.length).toBeGreaterThanOrEqual(2)

  // The trace should include beforeload-leak route somewhere in the chain
  const traceFiles = hit!.trace.map((s) => s.file).join(' -> ')
  expect(traceFiles).toContain('beforeload-leak')
})

// Warm-start regression tests: second navigation (cached modules) must
// still produce the same violations as the cold run.

test('warm run produces violations', async () => {
  const warm = await readViolations('dev.warm')
  expect(warm.length).toBeGreaterThan(0)
})

test('warm run detects every unique cold-run violation', async () => {
  const cold = await readViolations('dev.cold')
  const warm = await readViolations('dev.warm')

  // Deduplicate by (envType, type, normalizedSpecifier, importer-file).
  // On warm starts the specifier string may differ from cold starts
  // (e.g. alias `~/foo` vs resolved relative `src/foo`, or with/without
  // the `.ts` extension) because different detection code-paths fire.
  // Normalize to the resolved path (without extension) for a stable key.
  const normalizeSpec = (v: Violation) =>
    normalizeKeyPath(v.resolved ?? v.specifier)
  const normalizeImporter = (v: Violation) => {
    const importer = stripLocation(v.importer)
    const leafTraceFile = v.trace.at(-1)?.file

    if (
      leafTraceFile &&
      !importer.includes('/') &&
      normalizeKeyPath(leafTraceFile).endsWith(normalizeKeyPath(importer))
    ) {
      return normalizeKeyPath(leafTraceFile)
    }

    return normalizeKeyPath(importer)
  }
  const uniqueKey = (v: Violation) =>
    `${v.envType}|${v.type}|${normalizeSpec(v)}|${normalizeImporter(v)}`

  const coldUniq = [...new Set(cold.map(uniqueKey))].sort()
  const warmUniq = new Set(warm.map(uniqueKey))
  const missingFromWarm = coldUniq.filter((key) => !warmUniq.has(key))

  expect(missingFromWarm).toEqual([])
})

test('warm run traces include line numbers', async () => {
  const warm = await readViolations('dev.warm')

  const v = warm.find(
    (x) =>
      x.type === 'file' &&
      x.trace.length >= 3 &&
      x.trace.some((s) => s.line != null),
  )
  expect(v).toBeDefined()

  for (let i = 1; i < v!.trace.length; i++) {
    const step = v!.trace[i]
    if (step.specifier?.includes('?tsr-split=')) continue
    if (step.file.includes('routeTree.gen')) continue
    const prev = v!.trace[i - 1]
    if (prev.specifier?.includes('?tsr-split=')) continue
    if (
      step.line == null &&
      step.file.startsWith('src/routes/') &&
      prev.file.includes('routeTree.gen')
    ) {
      continue
    }

    expect(
      step.line,
      `warm trace step ${i} (${step.file}) should have a line number`,
    ).toBeDefined()
    expect(step.line).toBeGreaterThan(0)
  }
})

// Regression: SERVER_FN_LOOKUP variant pollution + hasSeenEntry bug.
//
// The Start compiler excludes ?server-fn-module-lookup variants from its
// transform, so they retain the original (untransformed) imports.  If the
// reachability check considers those untransformed imports, it would see
// edges the compiler has actually pruned, causing a false positive.
//
// Additionally, in Vite dev mode the client entry resolves through virtual
// modules, so a naïve resolveId-based entry detection may never fire,
// causing all deferred violations to be confirmed immediately.
//
// The cross-boundary-safe pattern exercises both bugs:
//   auth-wrapper.ts exports createAuthServerFn (factory with middleware)
//   → session-util.ts wraps @tanstack/react-start/server
//   → usage.ts calls createAuthServerFn().handler()
// All server imports are inside compiler boundaries and must be pruned.

for (const mode of ['dev', 'dev.warm'] as const) {
  test(`regression: server-fn-lookup variant does not cause false positive in ${mode}`, async () => {
    const violations = await readViolations(mode)

    // Any violation touching the cross-boundary-safe chain where the importer
    // or trace includes the ?server-fn-module-lookup query (or its normalized
    // key) would indicate the lookup variant polluted the reachability check.
    const lookupHits = violations.filter(
      (v) =>
        v.envType === 'client' &&
        (v.importer.includes('auth-wrapper') ||
          v.importer.includes('session-util') ||
          v.importer.includes('cross-boundary-safe') ||
          v.trace.some(
            (s) =>
              s.file.includes('auth-wrapper') ||
              s.file.includes('session-util') ||
              s.file.includes('cross-boundary-safe'),
          )),
    )

    expect(lookupHits).toEqual([])
  })
}

// Component-level server leak: the .server import is used exclusively inside
// the route component function, which is code-split by the router plugin into
// a separate lazy chunk.  Import protection must still detect this.

test('component-server-leak route loads in mock mode', async ({ page }) => {
  await page.goto('/component-server-leak')
  await expect(page.getByTestId('component-leak-heading')).toContainText(
    'Component Server Leak',
  )
})

for (const mode of ['build', 'dev', 'dev.warm'] as const) {
  test(`component-server-leak: .server import inside code-split component is caught in ${mode}`, async () => {
    const violations = await readViolations(mode)

    const hits = violations.filter(
      (v) =>
        v.envType === 'client' &&
        (v.specifier.includes('db-credentials.server') ||
          v.resolved?.includes('db-credentials.server') ||
          v.importer.includes('db-credentials.server') ||
          v.trace.some(
            (s) =>
              s.file.includes('db-credentials.server') ||
              s.file.includes('component-server-leak'),
          )),
    )

    expect(hits.length).toBeGreaterThanOrEqual(1)
  })
}

// Barrel re-export false positive: the barrel re-exports from a .server
// module AND a marker-protected module (foo.ts with `import 'server-only'`),
// but the component only uses values that would be tree-shaken away
// (getUsers inside createServerFn) or originate from a safe source, and
// never imports foo at all. Both the .server module and the marker module
// should NOT survive tree-shaking in the client bundle, so import-protection
// must NOT flag violations for either in build mode.
// Dev behavior is not part of this contract because barrel re-export diagnostics
// can warn or be elided depending on dev transform/chunk graph ordering.

test('barrel-false-positive route loads in mock mode', async ({ page }) => {
  await page.goto('/barrel-false-positive')
  await expect(page.getByTestId('barrel-heading')).toContainText(
    'Barrel False Positive',
  )
})

test('no false positive for barrel-reexport .server pattern in build', async () => {
  const violations = await readViolations('build')

  expect(findBarrelReexportHits(violations)).toEqual([])
})

test('no false positive for barrel-reexport marker pattern in build', async () => {
  const violations = await readViolations('build')

  // foo.ts uses `import '@tanstack/react-start/server-only'` marker and is
  // re-exported through the barrel, but never imported by the route.
  // Tree-shaking should eliminate it — no marker violation should fire.
  expect(findBarrelMarkerHits(violations)).toEqual([])
})

// noExternal .client package false positive: react-tweet's package.json
// exports resolve to `index.client.js` via the "default" condition.
// When listed in ssr.noExternal, Vite bundles it and the resolved path
// contains `.client.`, matching the default **/*.client.* deny pattern.
// Import-protection must NOT flag node_modules paths with file-based
// deny rules — these are third-party conventions, not user source code.

test('noexternal-client-pkg route loads in mock mode', async ({ page }) => {
  await page.goto('/noexternal-client-pkg')
  await expect(page.getByTestId('noexternal-heading')).toContainText(
    'noExternal .client Package',
  )
})

test('alias-path-leak route loads in mock mode', async ({ page }) => {
  await expectRouteHeading(
    page,
    '/alias-path-leak',
    'alias-path-leak-heading',
    'Alias Path Leak',
  )
})

test('alias-path-leak renders real secret in SSR HTML', async ({ page }) => {
  const response = await page.request.get('/alias-path-leak')
  expect(response.ok()).toBe(true)

  const html = await response.text()
  expect(html).toContain('data-testid="alias-path-secret"')
  expect(html).toContain('super-secret-server-key-12345')
})

test('alias-path-leak does not expose real secret after hydration', async ({
  page,
}) => {
  await page.goto('/alias-path-leak')
  await expect(page.getByTestId('alias-path-secret-hydration')).toContainText(
    'hydrated',
  )

  await expect(page.getByTestId('alias-path-secret-client')).not.toContainText(
    'super-secret-server-key-12345',
  )
})

test('alias-path-namespace-leak route loads in mock mode', async ({ page }) => {
  await expectRouteHeading(
    page,
    '/alias-path-namespace-leak',
    'alias-path-namespace-leak-heading',
    'Alias Path Namespace Leak',
  )
})

test('alias-path-namespace-leak renders real secret in SSR HTML', async ({
  page,
}) => {
  const response = await page.request.get('/alias-path-namespace-leak')
  expect(response.ok()).toBe(true)

  const html = await response.text()
  expect(html).toContain('data-testid="alias-path-namespace-leak-secret"')
  expect(html).toContain('super-secret-server-key-12345')
})

test('alias-path-namespace-leak does not expose real secret after hydration', async ({
  page,
}) => {
  await page.goto('/alias-path-namespace-leak')
  await expect(
    page.getByTestId('alias-path-namespace-leak-secret-hydration'),
  ).toContainText('hydrated')

  await expect(
    page.getByTestId('alias-path-namespace-leak-secret-client'),
  ).not.toContainText('super-secret-server-key-12345')
})

test('non-alias-namespace-leak route loads in mock mode', async ({ page }) => {
  await expectRouteHeading(
    page,
    '/non-alias-namespace-leak',
    'non-alias-namespace-leak-heading',
    'Non-Alias Namespace Leak',
  )
})

test('non-alias-namespace-leak renders real secret in SSR HTML', async ({
  page,
}) => {
  const response = await page.request.get('/non-alias-namespace-leak')
  expect(response.ok()).toBe(true)

  const html = await response.text()
  expect(html).toContain('data-testid="non-alias-namespace-leak-secret"')
  expect(html).toContain('super-secret-server-key-12345')
})

test('non-alias-namespace-leak does not expose real secret after hydration', async ({
  page,
}) => {
  await page.goto('/non-alias-namespace-leak')
  await expect(
    page.getByTestId('non-alias-namespace-leak-secret-hydration'),
  ).toContainText('hydrated')

  await expect(
    page.getByTestId('non-alias-namespace-leak-secret-client'),
  ).not.toContainText('super-secret-server-key-12345')
})

test('type-only protected import route loads in mock mode', async ({
  page,
}) => {
  await expectRouteHeading(
    page,
    '/type-only-protected-import',
    'type-only-protected-import-heading',
    'Type-Only Protected Import',
  )
})

for (const mode of ['build', 'dev', 'dev.warm'] as const) {
  test(`type-only protected imports do not trigger violations in ${mode}`, async () => {
    const violations = await readViolations(mode)

    expect(findTypeOnlyProtectedImportHits(violations)).toEqual([])
  })
}

for (const mode of ['build', 'dev'] as const) {
  test(`no false positive for noExternal react-tweet (.client entry) in ${mode}`, async () => {
    const violations = await readViolations(mode)

    const hits = violations.filter(
      (v) =>
        v.specifier.includes('react-tweet') ||
        v.resolved?.includes('react-tweet') ||
        v.importer.includes('noexternal-client-pkg'),
    )

    expect(hits).toEqual([])
  })
}

for (const mode of ['build', 'dev'] as const) {
  test(`alias path mapping does not bypass .server file denial in ${mode}`, async () => {
    const violations = await readViolations(mode)

    const hit = findClientSecretServerFileViolation(
      violations,
      'alias-path-leak',
      (specifier) => specifier.includes('violations/secret.server'),
    )

    expect(hit).toBeDefined()
  })
}

for (const mode of ['build', 'dev', 'dev.warm'] as const) {
  test(`alias path .server imports are not denied in server env in ${mode}`, async () => {
    const violations = await readViolations(mode)

    const serverAliasHits = violations.filter(
      (v) =>
        v.envType === 'server' &&
        (v.type === 'file' || v.type === 'marker' || v.type === 'specifier') &&
        (v.importer.includes('alias-path-leak') ||
          v.importer.includes('alias-path-namespace-leak')) &&
        (v.specifier.includes('secret.server') ||
          v.resolved?.includes('secret.server')),
    )

    expect(serverAliasHits).toEqual([])
  })
}

for (const mode of ['build', 'dev'] as const) {
  test(`alias path namespace import does not bypass .server file denial in ${mode}`, async () => {
    const violations = await readViolations(mode)

    const hit = findClientSecretServerFileViolation(
      violations,
      'alias-path-namespace-leak',
      (specifier) => specifier === '~/violations/secret.server',
    )

    expect(hit).toBeDefined()
  })
}

for (const mode of ['build', 'dev', 'dev.warm'] as const) {
  test(`alias routes both emit client file violations in ${mode}`, async () => {
    const violations = await readViolations(mode)

    const aliasImporters = new Set(
      violations
        .filter(
          (v) =>
            v.envType === 'client' &&
            v.type === 'file' &&
            (v.specifier.includes('secret.server') ||
              v.resolved?.includes('secret.server')) &&
            (v.importer.includes('alias-path-leak') ||
              v.importer.includes('alias-path-namespace-leak')),
        )
        .map((v) =>
          v.importer.includes('alias-path-namespace-leak')
            ? 'alias-path-namespace-leak'
            : 'alias-path-leak',
        ),
    )

    expect(aliasImporters).toEqual(
      new Set(['alias-path-leak', 'alias-path-namespace-leak']),
    )
  })
}

for (const mode of ['build', 'dev', 'dev.warm'] as const) {
  test(`namespace import without path alias is denied in ${mode}`, async () => {
    const violations = await readViolations(mode)

    const hit = findClientSecretServerFileViolation(
      violations,
      'non-alias-namespace-leak',
      (specifier) => specifier.includes('../violations/secret.server'),
    )

    expect(hit).toBeDefined()
  })
}

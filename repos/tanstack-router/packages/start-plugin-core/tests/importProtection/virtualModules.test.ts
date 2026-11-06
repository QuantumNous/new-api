import { describe, expect, test } from 'vitest'
import {
  MOCK_EDGE_PREFIX,
  MOCK_MODULE_ID,
  MOCK_RUNTIME_PREFIX,
  generateDevSelfDenialModule,
  generateSelfContainedMockModule,
  loadMarkerModule,
  loadMockEdgeModule,
  loadMockRuntimeModule,
  loadSilentMockModule,
  makeMockEdgeModuleId,
  mockRuntimeModuleIdFromViolation,
} from '../../src/vite/import-protection-plugin/virtualModules'
import type { ViolationInfo } from '../../src/import-protection/trace'

type MockValue = {
  toString: () => string
  valueOf: () => string
  toJSON: () => string
}

type MockFunction = {
  (): MockValue
}

function evaluateGeneratedModule<T>(code: string): T {
  const exports: Record<string, unknown> = {}
  const runnableCode = code
    .replace(/export default mock;?/g, 'exports.default = mock;')
    .replace(/export const ([A-Za-z_$][\w$]*) = ([^;]+);/g, 'exports.$1 = $2;')

  new Function('exports', runnableCode)(exports)
  return exports as T
}

describe('loadSilentMockModule', () => {
  test('returns mock code', () => {
    const result = loadSilentMockModule()
    expect(result.code).toContain('export default mock')
    expect(result.code).toContain('createMock')
    expect(result.code).toContain('Proxy')
    expect(result.code).toContain('@__NO_SIDE_EFFECTS__')
    expect(result.code).toContain('@__PURE__')
  })

  test('supports primitive conversion for called mocks', () => {
    const result = loadSilentMockModule()
    const mod = evaluateGeneratedModule<{ default: MockFunction }>(result.code)
    const value = mod.default()

    expect(String(value)).toBe('[import-protection mock]')
    expect(value.toString()).toBe('[import-protection mock]')
    expect(value.valueOf()).toBe('[import-protection mock]')
    expect(JSON.stringify(value)).toBe('"[import-protection mock]"')
  })
})

describe('loadMarkerModule', () => {
  test('returns empty module', () => {
    const result = loadMarkerModule()
    expect(result.code).toBe('export {}')
  })
})

describe('loadMockEdgeModule', () => {
  test('generates named exports from payload', () => {
    const payload = JSON.stringify({
      exports: ['getSecret', 'initDb'],
      runtimeId: MOCK_MODULE_ID,
    })
    const encoded = Buffer.from(payload, 'utf8').toString('base64url')
    const result = loadMockEdgeModule(encoded)

    expect(result.code).toContain('export const getSecret')
    expect(result.code).toContain('export const initDb')
    expect(result.code).toContain('export default mock')
  })

  test('handles empty exports array', () => {
    const payload = JSON.stringify({
      exports: [],
      runtimeId: MOCK_MODULE_ID,
    })
    const encoded = Buffer.from(payload, 'utf8').toString('base64url')
    const result = loadMockEdgeModule(encoded)

    expect(result.code).toContain('export default mock')
    expect(result.code).not.toContain('export const')
  })

  test('handles string-keyed (non-identifier) export names via re-export', () => {
    const payload = JSON.stringify({
      exports: ['valid', 'default', '123invalid', 'also-invalid'],
      runtimeId: MOCK_MODULE_ID,
    })
    const encoded = Buffer.from(payload, 'utf8').toString('base64url')
    const result = loadMockEdgeModule(encoded)

    // Valid identifier: direct const export
    expect(result.code).toContain('export const valid')
    // 'default' is filtered out
    expect(result.code).not.toContain('export const default')
    // Non-identifiers get string-keyed re-exports
    expect(result.code).toContain('__tss_str_')
    expect(result.code).toContain('"123invalid"')
    expect(result.code).toContain('"also-invalid"')
  })

  test('handles malformed base64', () => {
    const result = loadMockEdgeModule('not-valid-base64!!!')
    expect(result.code).toContain('export default mock')
  })

  test('falls back to MOCK_MODULE_ID when runtimeId missing', () => {
    const payload = JSON.stringify({
      exports: ['a'],
    })
    const encoded = Buffer.from(payload, 'utf8').toString('base64url')
    const result = loadMockEdgeModule(encoded)

    expect(result.code).toContain(MOCK_MODULE_ID)
  })
})

describe('loadMockRuntimeModule', () => {
  test('generates runtime diagnostic module with error mode', () => {
    const payload = JSON.stringify({
      mode: 'error',
      env: 'client',
      importer: '/src/routes/index.tsx',
      specifier: './secret.server',
      trace: ['src/main.tsx', 'src/routes/index.tsx'],
    })
    const encoded = Buffer.from(payload, 'utf8').toString('base64url')
    const result = loadMockRuntimeModule(encoded)

    expect(result.code).toContain('__report')
    expect(result.code).toContain('console.error')
    expect(result.code).toContain('"error"')
    expect(result.code).toContain('export default mock')
  })

  test('generates warn mode module', () => {
    const payload = JSON.stringify({ mode: 'warn' })
    const encoded = Buffer.from(payload, 'utf8').toString('base64url')
    const result = loadMockRuntimeModule(encoded)

    expect(result.code).toContain('"warn"')
    expect(result.code).toContain('console.warn')
  })

  test('handles malformed payload gracefully', () => {
    const result = loadMockRuntimeModule('bad-data')
    expect(result.code).toContain('export default mock')
  })
})

describe('mockRuntimeModuleIdFromViolation', () => {
  const baseViolation: ViolationInfo = {
    env: 'client',
    envType: 'client',
    type: 'file',
    behavior: 'mock',
    specifier: './secret.server',
    importer: '/project/src/routes/index.tsx',
    trace: [
      { file: '/project/src/main.tsx' },
      { file: '/project/src/routes/index.tsx', specifier: './secret.server' },
    ],
  }

  test('returns MOCK_MODULE_ID when mode is off', () => {
    const id = mockRuntimeModuleIdFromViolation(
      baseViolation,
      'off',
      '/project',
    )
    expect(id).toBe(MOCK_MODULE_ID)
  })

  test('returns MOCK_MODULE_ID for non-client env', () => {
    const ssrViolation = { ...baseViolation, env: 'ssr' }
    const id = mockRuntimeModuleIdFromViolation(
      ssrViolation,
      'error',
      '/project',
    )
    expect(id).toBe(MOCK_MODULE_ID)
  })

  test('returns runtime module ID for client env with error mode', () => {
    const id = mockRuntimeModuleIdFromViolation(
      baseViolation,
      'error',
      '/project',
    )
    expect(id.startsWith(MOCK_RUNTIME_PREFIX)).toBe(true)
    const encoded = id.slice(MOCK_RUNTIME_PREFIX.length)
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    )
    expect(payload.env).toBe('client')
    expect(payload.mode).toBe('error')
    expect(payload.specifier).toBe('./secret.server')
  })

  test('includes relative trace paths', () => {
    const id = mockRuntimeModuleIdFromViolation(
      baseViolation,
      'warn',
      '/project',
    )
    const encoded = id.slice(MOCK_RUNTIME_PREFIX.length)
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    )
    expect(payload.trace[0]).toBe('src/main.tsx')
  })

  test('includes line numbers in trace when present', () => {
    const violation: ViolationInfo = {
      ...baseViolation,
      trace: [
        { file: '/project/src/main.tsx' },
        {
          file: '/project/src/routes/index.tsx',
          specifier: './secret.server',
          line: 5,
          column: 10,
        },
      ],
    }
    const id = mockRuntimeModuleIdFromViolation(violation, 'error', '/project')
    const encoded = id.slice(MOCK_RUNTIME_PREFIX.length)
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    )
    expect(payload.trace[1]).toBe('src/routes/index.tsx:5:10')
  })
})

describe('makeMockEdgeModuleId', () => {
  test('encodes exports into module ID payload', () => {
    const id = makeMockEdgeModuleId(['foo', 'bar'], MOCK_MODULE_ID)
    expect(id.startsWith(MOCK_EDGE_PREFIX)).toBe(true)
    const encoded = id.slice(MOCK_EDGE_PREFIX.length)
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    )
    expect(payload.exports).toEqual(['foo', 'bar'])
    expect(payload.runtimeId).toBe(MOCK_MODULE_ID)
  })

  test('handles empty exports', () => {
    const id = makeMockEdgeModuleId([], MOCK_MODULE_ID)
    const encoded = id.slice(MOCK_EDGE_PREFIX.length)
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    )
    expect(payload.exports).toEqual([])
  })
})

describe('generateSelfContainedMockModule', () => {
  test('generates module with named exports', () => {
    const result = generateSelfContainedMockModule(['getSecret', 'initDb'])
    expect(result.code).toContain('export const getSecret = mock.getSecret;')
    expect(result.code).toContain('export const initDb = mock.initDb;')
    expect(result.code).toContain('export default mock')
    expect(result.code).toContain('createMock')
    expect(result.code).toContain('Proxy')
  })

  test('handles empty exports', () => {
    const result = generateSelfContainedMockModule([])
    expect(result.code).toContain('export default mock')
    expect(result.code).not.toContain('export const')
  })

  test('filters out default export', () => {
    const result = generateSelfContainedMockModule(['default', 'foo'])
    expect(result.code).toContain('export const foo = mock.foo;')
    expect(result.code).not.toContain('export const default')
  })

  test('handles string-keyed (non-identifier) export names via re-export', () => {
    const result = generateSelfContainedMockModule([
      'valid',
      '123invalid',
      'also-invalid',
    ])
    expect(result.code).toContain('export const valid = mock.valid;')
    expect(result.code).toContain('__tss_str_')
    expect(result.code).toContain('"123invalid"')
    expect(result.code).toContain('"also-invalid"')
  })

  test('is self-contained (no imports)', () => {
    const result = generateSelfContainedMockModule(['foo'])
    // Should not import from any other module
    expect(result.code).not.toMatch(/^\s*import\s/m)
  })

  test('supports primitive conversion for named export calls', () => {
    const result = generateSelfContainedMockModule(['getSecret'])
    const mod = evaluateGeneratedModule<{ getSecret: MockFunction }>(
      result.code,
    )

    expect(String(mod.getSecret())).toBe('[import-protection mock]')
  })
})

describe('generateDevSelfDenialModule', () => {
  test('generates module with named exports and mock-runtime import', () => {
    const runtimeId = 'tanstack-start-import-protection:mock-runtime:abc'
    const result = generateDevSelfDenialModule(
      ['getSecret', 'initDb'],
      runtimeId,
    )
    expect(result.code).toContain(`import mock from "${runtimeId}"`)
    expect(result.code).toContain('export const getSecret = mock.getSecret;')
    expect(result.code).toContain('export const initDb = mock.initDb;')
    expect(result.code).toContain('export default mock;')
  })

  test('handles empty exports', () => {
    const runtimeId = MOCK_MODULE_ID
    const result = generateDevSelfDenialModule([], runtimeId)
    expect(result.code).toContain(`import mock from "${runtimeId}"`)
    expect(result.code).toContain('export default mock;')
    expect(result.code).not.toContain('export const')
  })

  test('filters out default export', () => {
    const result = generateDevSelfDenialModule(['default', 'foo'], 'mock-rt:x')
    expect(result.code).toContain('export const foo = mock.foo;')
    expect(result.code).not.toContain('export const default')
    expect(result.code).toContain('export default mock;')
  })

  test('imports mock-runtime (not self-contained)', () => {
    const result = generateDevSelfDenialModule(['foo'], 'mock-rt:xyz')
    expect(result.code).toMatch(/\bimport\b/)
    // Should NOT contain inline createMock/Proxy (that's the build-mode mock)
    expect(result.code).not.toContain('createMock')
    expect(result.code).not.toContain('Proxy')
  })
})

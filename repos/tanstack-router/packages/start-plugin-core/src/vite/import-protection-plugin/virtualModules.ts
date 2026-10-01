import { resolveViteId } from '../../utils'
import {
  MARKER_PREFIX,
  MOCK_BUILD_PREFIX,
  MOCK_EDGE_PREFIX,
  MOCK_MODULE_ID,
  MOCK_RUNTIME_PREFIX,
  RUNTIME_SUGGESTION_TEXT,
  generateDevSelfDenialModule,
  generateSelfContainedMockModule,
  loadMarkerModule,
  loadMockEdgeModule,
  loadMockRuntimeModule,
  loadSilentMockModule,
  makeMockEdgeModuleId,
  mockRuntimeModuleIdFromViolation,
} from '../../import-protection/virtualModules'
import { VITE_BROWSER_VIRTUAL_PREFIX } from '../../import-protection/constants'

const RESOLVED_MOCK_MODULE_ID = resolveViteId(MOCK_MODULE_ID)
const RESOLVED_MOCK_BUILD_PREFIX = resolveViteId(MOCK_BUILD_PREFIX)
const RESOLVED_MOCK_EDGE_PREFIX = resolveViteId(MOCK_EDGE_PREFIX)
const RESOLVED_MOCK_RUNTIME_PREFIX = resolveViteId(MOCK_RUNTIME_PREFIX)
const RESOLVED_MARKER_PREFIX = resolveViteId(MARKER_PREFIX)
const RESOLVED_MARKER_SERVER_ONLY = resolveViteId(`${MARKER_PREFIX}server-only`)
const RESOLVED_MARKER_CLIENT_ONLY = resolveViteId(`${MARKER_PREFIX}client-only`)

export function resolvedMarkerVirtualModuleId(
  kind: 'server' | 'client',
): string {
  return kind === 'server'
    ? RESOLVED_MARKER_SERVER_ONLY
    : RESOLVED_MARKER_CLIENT_ONLY
}

export function getResolvedVirtualModuleMatchers(): ReadonlyArray<string> {
  return RESOLVED_VIRTUAL_MODULE_MATCHERS
}

const RESOLVED_VIRTUAL_MODULE_MATCHERS = [
  RESOLVED_MOCK_MODULE_ID,
  RESOLVED_MOCK_BUILD_PREFIX,
  RESOLVED_MOCK_EDGE_PREFIX,
  RESOLVED_MOCK_RUNTIME_PREFIX,
  RESOLVED_MARKER_PREFIX,
] as const

const RESOLVE_PREFIX_PAIRS = [
  [MOCK_EDGE_PREFIX, RESOLVED_MOCK_EDGE_PREFIX],
  [MOCK_RUNTIME_PREFIX, RESOLVED_MOCK_RUNTIME_PREFIX],
  [MOCK_BUILD_PREFIX, RESOLVED_MOCK_BUILD_PREFIX],
  [MARKER_PREFIX, RESOLVED_MARKER_PREFIX],
] as const

export function resolveInternalVirtualModuleId(
  source: string,
): string | undefined {
  if (source.startsWith(VITE_BROWSER_VIRTUAL_PREFIX)) {
    return resolveInternalVirtualModuleId(
      `\0${source.slice(VITE_BROWSER_VIRTUAL_PREFIX.length)}`,
    )
  }

  if (source === MOCK_MODULE_ID || source === RESOLVED_MOCK_MODULE_ID) {
    return RESOLVED_MOCK_MODULE_ID
  }

  for (const [unresolvedPrefix, resolvedPrefix] of RESOLVE_PREFIX_PAIRS) {
    if (source.startsWith(unresolvedPrefix)) {
      return resolveViteId(source)
    }

    if (source.startsWith(resolvedPrefix)) {
      return source
    }
  }

  return undefined
}

export function loadResolvedVirtualModule(
  id: string,
): { code: string } | undefined {
  if (id === RESOLVED_MOCK_MODULE_ID) {
    return loadSilentMockModule()
  }

  if (id.startsWith(RESOLVED_MOCK_BUILD_PREFIX)) {
    return loadSilentMockModule()
  }

  if (id.startsWith(RESOLVED_MOCK_EDGE_PREFIX)) {
    return loadMockEdgeModule(id.slice(RESOLVED_MOCK_EDGE_PREFIX.length))
  }

  if (id.startsWith(RESOLVED_MOCK_RUNTIME_PREFIX)) {
    return loadMockRuntimeModule(id.slice(RESOLVED_MOCK_RUNTIME_PREFIX.length))
  }

  if (id.startsWith(RESOLVED_MARKER_PREFIX)) {
    return loadMarkerModule()
  }

  return undefined
}

export {
  MARKER_PREFIX,
  MOCK_BUILD_PREFIX,
  MOCK_EDGE_PREFIX,
  MOCK_MODULE_ID,
  MOCK_RUNTIME_PREFIX,
  RUNTIME_SUGGESTION_TEXT,
  generateDevSelfDenialModule,
  generateSelfContainedMockModule,
  loadMarkerModule,
  loadMockEdgeModule,
  loadMockRuntimeModule,
  loadSilentMockModule,
  makeMockEdgeModuleId,
  mockRuntimeModuleIdFromViolation,
}

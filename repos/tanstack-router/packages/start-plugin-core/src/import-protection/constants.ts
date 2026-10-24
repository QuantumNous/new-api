import { SERVER_FN_LOOKUP } from '../constants'

export const SERVER_FN_LOOKUP_QUERY = `?${SERVER_FN_LOOKUP}`

export const MOCK_MODULE_ID = 'tanstack-start-import-protection:mock'
export const MOCK_BUILD_PREFIX = 'tanstack-start-import-protection:mock:build:'
export const MOCK_EDGE_PREFIX = 'tanstack-start-import-protection:mock-edge:'
export const MOCK_RUNTIME_PREFIX =
  'tanstack-start-import-protection:mock-runtime:'
export const MARKER_PREFIX = 'tanstack-start-import-protection:marker:'

export const IMPORT_PROTECTION_DEBUG =
  process.env.TSR_IMPORT_PROTECTION_DEBUG === '1' ||
  process.env.TSR_IMPORT_PROTECTION_DEBUG === 'true'

export const IMPORT_PROTECTION_DEBUG_FILTER =
  process.env.TSR_IMPORT_PROTECTION_DEBUG_FILTER

export const KNOWN_SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
])

/** Vite's browser-visible prefix for virtual modules (replaces `\0`). */
export const VITE_BROWSER_VIRTUAL_PREFIX = '/@id/__x00__'

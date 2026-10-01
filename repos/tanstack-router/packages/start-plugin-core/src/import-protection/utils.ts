import {
  extname,
  isAbsolute,
  relative,
  resolve as resolvePath,
} from 'node:path'
import { normalizePath } from '../utils'

import {
  IMPORT_PROTECTION_DEBUG,
  IMPORT_PROTECTION_DEBUG_FILTER,
  KNOWN_SOURCE_EXTENSIONS,
} from './constants'

export type Pattern = string | RegExp

export function dedupePatterns(patterns: Array<Pattern>): Array<Pattern> {
  const out: Array<Pattern> = []
  const seen = new Set<string>()
  for (const p of patterns) {
    const key = typeof p === 'string' ? `s:${p}` : `r:${p.toString()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

export interface FileMatchers {
  files: Array<{ pattern: Pattern; test: (value: string) => boolean }>
  excludeFiles: Array<{ pattern: Pattern; test: (value: string) => boolean }>
}

export function isFileExcluded(
  relativePath: string,
  matchers: Pick<FileMatchers, 'excludeFiles'>,
): boolean {
  return (
    matchers.excludeFiles.length > 0 &&
    matchers.excludeFiles.some((matcher) => matcher.test(relativePath))
  )
}

export function checkFileDenial(
  relativePath: string,
  matchers: FileMatchers,
): FileMatchers['files'][number] | undefined {
  if (isFileExcluded(relativePath, matchers)) {
    return undefined
  }

  return matchers.files.find((matcher) => matcher.test(relativePath))
}

export function dedupeViolationKey(info: {
  type: string
  importer: string
  specifier: string
  resolved?: string
}): string {
  return `${info.type}:${info.importer}:${info.specifier}:${info.resolved ?? ''}`
}

/** Strip both `?query` and `#hash` from a module ID. */
export function stripQueryAndHash(id: string): string {
  const q = id.indexOf('?')
  const h = id.indexOf('#')
  if (q === -1 && h === -1) return id
  if (q === -1) return id.slice(0, h)
  if (h === -1) return id.slice(0, q)
  return id.slice(0, Math.min(q, h))
}

/**
 * Strip Vite query/hash parameters and normalize the path in one step.
 *
 * Results are memoized because the same module IDs are processed many
 * times across resolveId, transform, and trace-building hooks.
 */
const normalizeFilePathCache = new Map<string, string>()
export function normalizeFilePath(id: string): string {
  let result = normalizeFilePathCache.get(id)
  if (result === undefined) {
    result = normalizePath(stripQueryAndHash(id))
    normalizeFilePathCache.set(id, result)
  }
  return result
}

/** Clear the memoization cache (call from buildStart to bound growth). */
export function clearNormalizeFilePathCache(): void {
  normalizeFilePathCache.clear()
}

/** Get a value from a Map, creating it with `factory` if absent. */
export function getOrCreate<TKey, TValue>(
  map: Map<TKey, TValue>,
  key: TKey,
  factory: () => TValue,
): TValue {
  let value = map.get(key)
  if (value === undefined) {
    value = factory()
    map.set(key, value)
  }
  return value
}

/** Make a path relative to `root`, keeping non-rooted paths as-is. */
export function relativizePath(p: string, root: string): string {
  if (!p.startsWith(root)) return p
  const ch = p.charCodeAt(root.length)
  // Must be followed by a separator or end-of-string to be a true child
  if (ch !== 47 && !Number.isNaN(ch)) return p
  return ch === 47 ? p.slice(root.length + 1) : p.slice(root.length)
}

/** Log import-protection debug output when debug mode is enabled. */
export function debugLog(...args: Array<unknown>): void {
  if (!IMPORT_PROTECTION_DEBUG) return
  console.warn('[import-protection:debug]', ...args)
}

/** Check if any value matches the configured debug filter (if present). */
export function matchesDebugFilter(...values: Array<string>): boolean {
  const debugFilter = IMPORT_PROTECTION_DEBUG_FILTER
  if (!debugFilter) return true
  return values.some((v) => v.includes(debugFilter))
}

/** Strip `?query` (but not `#hash`) from a module ID. */
export function stripQuery(id: string): string {
  const queryIndex = id.indexOf('?')
  return queryIndex === -1 ? id : id.slice(0, queryIndex)
}

export function withoutKnownExtension(id: string): string {
  const ext = extname(id)
  return KNOWN_SOURCE_EXTENSIONS.has(ext) ? id.slice(0, -ext.length) : id
}

/**
 * Check whether `filePath` is contained inside `directory` using a
 * boundary-safe comparison.  A naïve `filePath.startsWith(directory)`
 * would incorrectly treat `/app/src2/foo.ts` as inside `/app/src`.
 */
export function isInsideDirectory(
  filePath: string,
  directory: string,
): boolean {
  const rel = relative(resolvePath(directory), resolvePath(filePath))
  return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * Decide whether a violation should be deferred for later verification
 * rather than reported immediately.
 *
 * Build mode: always defer — generateBundle checks tree-shaking.
 * Dev mock mode: always defer — edge-survival verifies whether the Start
 *   compiler strips the import (factory-safe pattern).  All violation
 *   types and specifier formats are handled uniformly by the
 *   edge-survival mechanism in processPendingViolations.
 * Dev error mode: never defer — throw immediately (no mock fallback).
 */
export function shouldDeferViolation(opts: {
  isBuild: boolean
  isDevMock: boolean
}): boolean {
  return opts.isBuild || opts.isDevMock
}

export function buildSourceCandidates(
  source: string,
  resolved: string | undefined,
  root: string,
): Set<string> {
  const candidates = new Set<string>()
  const push = (value: string | undefined) => {
    if (!value) return
    candidates.add(value)
    candidates.add(stripQuery(value))
    candidates.add(withoutKnownExtension(stripQuery(value)))
  }

  push(source)
  if (resolved) {
    push(resolved)
    const relativeResolved = relativizePath(resolved, root)
    push(relativeResolved)
    push(`./${relativeResolved}`)
    push(`/${relativeResolved}`)
  }

  return candidates
}

export function buildResolutionCandidates(id: string): Array<string> {
  const normalized = normalizeFilePath(id)
  const stripped = stripQuery(normalized)

  return [...new Set([id, normalized, stripped])]
}

export function canonicalizeResolvedId(
  id: string,
  root: string,
  resolveExtensionlessAbsoluteId: (value: string) => string,
): string {
  const stripped = stripQuery(id)
  let normalized = normalizeFilePath(stripped)

  if (
    !isAbsolute(normalized) &&
    !normalized.startsWith('.') &&
    !normalized.startsWith('\0') &&
    !/^[a-zA-Z]+:/.test(normalized)
  ) {
    normalized = normalizeFilePath(resolvePath(root, normalized))
  }

  return resolveExtensionlessAbsoluteId(normalized)
}

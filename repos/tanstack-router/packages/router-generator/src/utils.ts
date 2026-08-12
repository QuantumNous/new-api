/* eslint-disable @typescript-eslint/prefer-for-of */
import * as fsp from 'node:fs/promises'
import path from 'node:path'
import * as prettier from 'prettier'
import { rootPathId } from './filesystem/physical/rootPathId'
import type { Config, TokenMatcher } from './config'
import type {
  ImportDeclaration,
  RouteNode,
  RoutePathSegmentMetadata,
} from './types'

/**
 * Prefix map for O(1) parent route lookups.
 * Maps each route path prefix to the route node that owns that prefix.
 * Enables finding longest matching parent without linear search.
 */
export class RoutePrefixMap {
  private prefixToRoute: Map<string, RouteNode> = new Map()

  constructor(routes: Array<RouteNode>) {
    for (const route of routes) {
      if (!route.routePath || route.routePath === `/${rootPathId}`) continue

      // Skip route pieces (lazy, loader, component, etc.) - they are merged with main routes
      // and should not be valid parent candidates
      if (
        route._fsRouteType === 'lazy' ||
        route._fsRouteType === 'loader' ||
        route._fsRouteType === 'component' ||
        route._fsRouteType === 'pendingComponent' ||
        route._fsRouteType === 'errorComponent' ||
        route._fsRouteType === 'notFoundComponent'
      ) {
        continue
      }

      // Index by exact path for direct lookups
      this.prefixToRoute.set(route.routePath, route)
    }
  }

  /**
   * Find the longest matching parent route for a given path.
   * O(k) where k is the number of path segments, not O(n) routes.
   */
  findParent(routePath: string): RouteNode | null {
    if (!routePath || routePath === '/') return null

    // Walk up the path segments
    let searchPath = routePath
    while (searchPath.length > 0) {
      const lastSlash = searchPath.lastIndexOf('/')
      if (lastSlash <= 0) break

      searchPath = searchPath.substring(0, lastSlash)
      const parent = this.prefixToRoute.get(searchPath)
      if (parent && parent.routePath !== routePath) {
        return parent
      }
    }
    return null
  }

  /**
   * Check if a route exists at the given path.
   */
  has(routePath: string): boolean {
    return this.prefixToRoute.has(routePath)
  }

  /**
   * Get a route by exact path.
   */
  get(routePath: string): RouteNode | undefined {
    return this.prefixToRoute.get(routePath)
  }
}

export function multiSortBy<T>(
  arr: Array<T>,
  accessors: Array<(item: T) => any> = [(d) => d],
): Array<T> {
  const len = arr.length
  // Pre-compute all accessor values to avoid repeated function calls during sort
  const indexed: Array<{ item: T; index: number; keys: Array<any> }> =
    new Array(len)
  for (let i = 0; i < len; i++) {
    const item = arr[i]!
    const keys = new Array(accessors.length)
    for (let j = 0; j < accessors.length; j++) {
      keys[j] = accessors[j]!(item)
    }
    indexed[i] = { item, index: i, keys }
  }

  indexed.sort((a, b) => {
    for (let j = 0; j < accessors.length; j++) {
      const ao = a.keys[j]
      const bo = b.keys[j]

      if (typeof ao === 'undefined') {
        if (typeof bo === 'undefined') {
          continue
        }
        return 1
      }

      if (ao === bo) {
        continue
      }

      return ao > bo ? 1 : -1
    }

    return a.index - b.index
  })

  const result: Array<T> = new Array(len)
  for (let i = 0; i < len; i++) {
    result[i] = indexed[i]!.item
  }
  return result
}

export function cleanPath(path: string) {
  // remove double slashes
  return path.replace(/\/{2,}/g, '/')
}

export function trimPathLeft(path: string) {
  return path === '/' ? path : path.replace(/^\/{1,}/, '')
}

export function removeLeadingSlash(path: string): string {
  return path.replace(/^\//, '')
}

export function removeTrailingSlash(s: string) {
  return s.replace(/\/$/, '')
}

const BRACKET_CONTENT_RE = /\[(.*?)\]/g
const SPLIT_REGEX = /(?<!\[)\.(?!\])/g

/**
 * Characters that cannot be escaped in square brackets.
 * These are characters that would cause issues in URLs or file systems.
 */
const DISALLOWED_ESCAPE_CHARS = new Set([
  '/',
  '\\',
  '?',
  '#',
  ':',
  '*',
  '<',
  '>',
  '|',
  '!',
  '$',
  '%',
])

export function determineInitialRoutePath(routePath: string) {
  const originalRoutePath =
    cleanPath(
      `/${(cleanPath(routePath) || '').split(SPLIT_REGEX).join('/')}`,
    ) || ''

  const parts = routePath.split(SPLIT_REGEX)

  // Escape any characters that in square brackets
  // we keep the original path untouched
  const escapedParts = parts.map((part) => {
    // Check if any disallowed characters are used in brackets

    let match
    while ((match = BRACKET_CONTENT_RE.exec(part)) !== null) {
      const character = match[1]
      if (character === undefined) continue
      if (DISALLOWED_ESCAPE_CHARS.has(character)) {
        console.error(
          `Error: Disallowed character "${character}" found in square brackets in route path "${routePath}".\nYou cannot use any of the following characters in square brackets: ${Array.from(
            DISALLOWED_ESCAPE_CHARS,
          ).join(', ')}\nPlease remove and/or replace them.`,
        )
        process.exit(1)
      }
    }

    // Since this split segment is safe at this point, we can
    // remove the brackets and replace them with the content inside
    return part.replace(BRACKET_CONTENT_RE, '$1')
  })

  // If the syntax for prefix/suffix is different, from the path
  // matching internals of router-core, we'd perform those changes here
  // on the `escapedParts` array before it is joined back together in
  // `final`

  const final = cleanPath(`/${escapedParts.join('/')}`) || ''

  return {
    routePath: final,
    originalRoutePath,
  }
}

/**
 * Checks if a segment is fully escaped (entirely wrapped in brackets with no nested brackets).
 * E.g., "[index]" -> true, "[_layout]" -> true, "foo[.]bar" -> false, "index" -> false
 */
function isFullyEscapedSegment(originalSegment: string): boolean {
  return (
    originalSegment.startsWith('[') &&
    originalSegment.endsWith(']') &&
    !originalSegment.slice(1, -1).includes('[') &&
    !originalSegment.slice(1, -1).includes(']')
  )
}

/**
 * Checks if the leading underscore in a segment is escaped.
 * Returns true if:
 * - Segment starts with [_] pattern: "[_]layout" -> "_layout"
 * - Segment is fully escaped and content starts with _: "[_1nd3x]" -> "_1nd3x"
 */
export function hasEscapedLeadingUnderscore(originalSegment: string): boolean {
  // Pattern: [_]something or [_something]
  return (
    originalSegment.startsWith('[_]') ||
    (originalSegment.startsWith('[_') && isFullyEscapedSegment(originalSegment))
  )
}

/**
 * Checks if the trailing underscore in a segment is escaped.
 * Returns true if:
 * - Segment ends with [_] pattern: "blog[_]" -> "blog_"
 * - Segment is fully escaped and content ends with _: "[_r0ut3_]" -> "_r0ut3_"
 */
export function hasEscapedTrailingUnderscore(originalSegment: string): boolean {
  // Pattern: something[_] or [something_]
  return (
    originalSegment.endsWith('[_]') ||
    (originalSegment.endsWith('_]') && isFullyEscapedSegment(originalSegment))
  )
}

export function countRoutePathSegments(routePath?: string): number {
  const path = routePath ?? ''
  let count = 0
  let inSegment = false

  for (let i = 0; i < path.length; i++) {
    if (path[i] === '/') {
      inSegment = false
      continue
    }

    if (!inSegment) {
      count++
      inSegment = true
    }
  }

  return count
}

export function countSlashSeparatedParts(path: string): number {
  let count = 1

  for (let i = 0; i < path.length; i++) {
    if (path[i] === '/') count++
  }

  return count
}

export function hasRoutePathSegmentMetadata(
  metadata: RoutePathSegmentMetadata | undefined,
): metadata is RoutePathSegmentMetadata {
  return !!(
    metadata?.literalLeadingUnderscore || metadata?.literalTrailingUnderscore
  )
}

function mergeRoutePathSegmentMetadata(
  current: RoutePathSegmentMetadata | undefined,
  incoming: RoutePathSegmentMetadata | undefined,
): RoutePathSegmentMetadata | undefined {
  const hasCurrent = hasRoutePathSegmentMetadata(current)
  const hasIncoming = hasRoutePathSegmentMetadata(incoming)

  if (!hasCurrent) return hasIncoming ? incoming : undefined
  if (!hasIncoming) return current

  return {
    literalLeadingUnderscore:
      current.literalLeadingUnderscore || incoming.literalLeadingUnderscore,
    literalTrailingUnderscore:
      current.literalTrailingUnderscore || incoming.literalTrailingUnderscore,
  }
}

export function createRoutePathSegmentMetadata(
  routePath: string = '/',
  originalPath?: string,
): Array<RoutePathSegmentMetadata | undefined> | undefined {
  if (!originalPath) return undefined

  const routeSegments = routePath.split('/')
  const originalSegments = originalPath.split('/')
  const metadata = new Array<RoutePathSegmentMetadata | undefined>(
    routeSegments.length,
  )
  let hasMetadata = false

  for (let i = 0; i < routeSegments.length; i++) {
    const segment = routeSegments[i]!
    const originalSegment = originalSegments[i] || ''
    const literalLeadingUnderscore =
      segment.startsWith('_') && hasEscapedLeadingUnderscore(originalSegment)
    const literalTrailingUnderscore =
      segment.endsWith('_') && hasEscapedTrailingUnderscore(originalSegment)

    if (!literalLeadingUnderscore && !literalTrailingUnderscore) continue

    hasMetadata = true
    metadata[i] = {
      literalLeadingUnderscore: literalLeadingUnderscore || undefined,
      literalTrailingUnderscore: literalTrailingUnderscore || undefined,
    }
  }

  return hasMetadata ? metadata : undefined
}

export function createLiteralRoutePathSegmentMetadata(
  routePath: string,
  parent?: RouteNode,
  literalNewSegments = false,
): Array<RoutePathSegmentMetadata | undefined> | undefined {
  const routeSegments = routePath.split('/')
  const metadata = new Array<RoutePathSegmentMetadata | undefined>(
    routeSegments.length,
  )
  const parentDepth = countRoutePathSegments(parent?.routePath)
  let hasMetadata = false
  let depth = 0

  for (let i = 0; i < routeSegments.length; i++) {
    const segment = routeSegments[i]
    metadata[i] = parent?._routePathSegmentMetadata?.[i]
    hasMetadata ||= hasRoutePathSegmentMetadata(metadata[i])

    if (!segment) continue

    if (literalNewSegments && depth >= parentDepth) {
      const literalLeadingUnderscore = segment.startsWith('_')
      const literalTrailingUnderscore = segment.endsWith('_')

      if (literalLeadingUnderscore || literalTrailingUnderscore) {
        metadata[i] = mergeRoutePathSegmentMetadata(metadata[i], {
          literalLeadingUnderscore: literalLeadingUnderscore || undefined,
          literalTrailingUnderscore: literalTrailingUnderscore || undefined,
        })
        hasMetadata = true
      }
    }

    depth++
  }

  return hasMetadata ? metadata : undefined
}

export function joinRoutePathSegmentMetadata(
  routePath: string,
  prefixPath: string,
  prefixMetadata: Array<RoutePathSegmentMetadata | undefined> | undefined,
  childMetadata: Array<RoutePathSegmentMetadata | undefined> | undefined,
): Array<RoutePathSegmentMetadata | undefined> | undefined {
  const metadata = new Array<RoutePathSegmentMetadata | undefined>(
    countSlashSeparatedParts(routePath),
  )
  let hasMetadata = false

  if (prefixMetadata) {
    for (let i = 0; i < prefixMetadata.length && i < metadata.length; i++) {
      metadata[i] = prefixMetadata[i]
      hasMetadata ||= hasRoutePathSegmentMetadata(metadata[i])
    }
  }

  const offset = countRoutePathSegments(prefixPath)
  if (childMetadata) {
    for (let i = 1; i < childMetadata.length; i++) {
      const targetIndex = offset + i
      if (targetIndex >= metadata.length) break

      metadata[targetIndex] = mergeRoutePathSegmentMetadata(
        metadata[targetIndex],
        childMetadata[i],
      )
      hasMetadata ||= hasRoutePathSegmentMetadata(metadata[targetIndex])
    }
  }

  return hasMetadata ? metadata : undefined
}

const backslashRegex = /\\/g

export function replaceBackslash(s: string) {
  return s.replace(backslashRegex, '/')
}

const alphanumericRegex = /[a-zA-Z0-9_]/
const splatSlashRegex = /\/\$\//g
const trailingSplatRegex = /\$$/g
const bracketSplatRegex = /\$\{\$\}/g
const dollarSignRegex = /\$/g
const splitPathRegex = /[/-]/g
const leadingDigitRegex = /^(\d)/g

const toVariableSafeChar = (char: string): string => {
  if (alphanumericRegex.test(char)) {
    return char // Keep alphanumeric characters and underscores as is
  }

  // Replace special characters with meaningful text equivalents
  switch (char) {
    case '.':
      return 'Dot'
    case '-':
      return 'Dash'
    case '@':
      return 'At'
    case '(':
      return '' // Removed since route groups use parentheses
    case ')':
      return '' // Removed since route groups use parentheses
    case ' ':
      return '' // Remove spaces
    default:
      return `Char${char.charCodeAt(0)}` // For any other characters
  }
}

export function routePathToVariable(routePath: string): string {
  const cleaned = removeUnderscores(routePath)
  if (!cleaned) return ''

  const parts = cleaned
    .replace(splatSlashRegex, '/splat/')
    .replace(trailingSplatRegex, 'splat')
    .replace(bracketSplatRegex, 'splat')
    .replace(dollarSignRegex, '')
    .split(splitPathRegex)

  let result = ''
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!
    const segment = i > 0 ? capitalize(part) : part
    for (let j = 0; j < segment.length; j++) {
      result += toVariableSafeChar(segment[j]!)
    }
  }

  return result.replace(leadingDigitRegex, 'R$1')
}

const underscoreStartEndRegex = /(^_|_$)/gi
const underscoreSlashRegex = /(\/_|_\/)/gi

export function removeUnderscores(s?: string) {
  return s
    ?.replace(underscoreStartEndRegex, '')
    .replace(underscoreSlashRegex, '/')
}

function removeUnderscoresFromSegment(
  segment: string,
  metadata?: RoutePathSegmentMetadata,
): string {
  let result = segment

  if (result.startsWith('_') && !metadata?.literalLeadingUnderscore) {
    result = result.slice(1)
  }

  if (result.endsWith('_') && !metadata?.literalTrailingUnderscore) {
    result = result.slice(0, -1)
  }

  return result
}

/**
 * Removes underscores from a path, but preserves underscores that were escaped
 * in the original path (indicated by [_] syntax).
 *
 * @param routePath - The path with brackets removed
 * @param originalPath - The original path that may contain [_] escape sequences
 * @returns The path with non-escaped underscores removed
 */
export function removeUnderscoresWithEscape(
  routePath?: string,
  originalPath?: string,
): string {
  if (!routePath) return ''
  if (!originalPath) return removeUnderscores(routePath) ?? ''

  const routeSegments = routePath.split('/')
  const metadata = createRoutePathSegmentMetadata(routePath, originalPath)
  const newSegments = new Array<string>(routeSegments.length)

  for (let i = 0; i < routeSegments.length; i++) {
    newSegments[i] = removeUnderscoresFromSegment(
      routeSegments[i]!,
      metadata?.[i],
    )
  }

  return newSegments.join('/')
}

export function removeLayoutSegmentsAndUnderscoresWithEscape(
  routePath: string = '/',
  originalPath?: string,
  routePathSegmentMetadata?: Array<RoutePathSegmentMetadata | undefined>,
): string {
  if (!originalPath) {
    return removeUnderscores(removeLayoutSegments(routePath)) ?? ''
  }

  const metadata =
    routePathSegmentMetadata ??
    createRoutePathSegmentMetadata(routePath, originalPath)

  const routeSegments = routePath.split('/')
  const originalSegments = originalPath.split('/')
  const newSegments: Array<string> = []

  for (let i = 0; i < routeSegments.length; i++) {
    const segment = routeSegments[i]!
    const originalSegment = originalSegments[i] || ''
    const segmentMetadata = metadata?.[i]

    if (
      !segmentMetadata?.literalLeadingUnderscore &&
      isSegmentPathless(segment, originalSegment)
    ) {
      continue
    }

    newSegments.push(removeUnderscoresFromSegment(segment, segmentMetadata))
  }

  return newSegments.join('/')
}

/**
 * Removes layout segments (segments starting with underscore) from a path,
 * but preserves segments where the underscore was escaped.
 *
 * @param routePath - The path with brackets removed
 * @param originalPath - The original path that may contain [_] escape sequences
 * @returns The path with non-escaped layout segments removed
 */
export function removeLayoutSegmentsWithEscape(
  routePath: string = '/',
  originalPath?: string,
): string {
  if (!originalPath) return removeLayoutSegments(routePath)

  const routeSegments = routePath.split('/')
  const originalSegments = originalPath.split('/')

  // Keep segments that are NOT pathless (i.e., don't start with unescaped underscore)
  const newSegments = routeSegments.filter((segment, i) => {
    const originalSegment = originalSegments[i] || ''
    return !isSegmentPathless(segment, originalSegment)
  })

  return newSegments.join('/')
}

/**
 * Checks if a segment should be treated as a pathless/layout segment.
 * A segment is pathless if it starts with underscore and the underscore is not escaped.
 *
 * @param segment - The segment from routePath (brackets removed)
 * @param originalSegment - The segment from originalRoutePath (may contain brackets)
 * @returns true if the segment is pathless (has non-escaped leading underscore)
 */
export function isSegmentPathless(
  segment: string,
  originalSegment: string,
): boolean {
  if (!segment.startsWith('_')) return false
  return !hasEscapedLeadingUnderscore(originalSegment)
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function sanitizeTokenFlags(flags?: string): string | undefined {
  if (!flags) return flags

  // Prevent stateful behavior with RegExp.prototype.test/exec
  // g = global, y = sticky
  return flags.replace(/[gy]/g, '')
}

export function createTokenRegex(
  token: TokenMatcher,
  opts: {
    type: 'segment' | 'filename'
  },
): RegExp {
  // Defensive check: if token is undefined/null, throw a clear error
  // (runtime safety for config loading edge cases)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (token === undefined || token === null) {
    throw new Error(
      `createTokenRegex: token is ${token}. This usually means the config was not properly parsed with defaults.`,
    )
  }

  try {
    if (typeof token === 'string') {
      return opts.type === 'segment'
        ? new RegExp(`^${escapeRegExp(token)}$`)
        : new RegExp(`[./]${escapeRegExp(token)}[.]`)
    }

    if (token instanceof RegExp) {
      const flags = sanitizeTokenFlags(token.flags)
      return opts.type === 'segment'
        ? new RegExp(`^(?:${token.source})$`, flags)
        : new RegExp(`[./](?:${token.source})[.]`, flags)
    }

    // Handle JSON regex object form: { regex: string, flags?: string }
    if (typeof token === 'object' && 'regex' in token) {
      const flags = sanitizeTokenFlags(token.flags)
      return opts.type === 'segment'
        ? new RegExp(`^(?:${token.regex})$`, flags)
        : new RegExp(`[./](?:${token.regex})[.]`, flags)
    }

    throw new Error(
      `createTokenRegex: invalid token type. Expected string, RegExp, or { regex, flags } object, got: ${typeof token}`,
    )
  } catch (e) {
    if (e instanceof SyntaxError) {
      const pattern =
        typeof token === 'string'
          ? token
          : token instanceof RegExp
            ? token.source
            : token.regex
      throw new Error(
        `Invalid regex pattern in token config: "${pattern}". ${e.message}`,
      )
    }
    throw e
  }
}

function isBracketWrappedSegment(segment: string): boolean {
  return segment.startsWith('[') && segment.endsWith(']')
}

export function unwrapBracketWrappedSegment(segment: string): string {
  return isBracketWrappedSegment(segment) ? segment.slice(1, -1) : segment
}

export function removeLeadingUnderscores(s: string, routeToken: string) {
  if (!s) return s

  const hasLeadingUnderscore = routeToken[0] === '_'

  const routeTokenToExclude = hasLeadingUnderscore
    ? routeToken.slice(1)
    : routeToken

  const escapedRouteToken = escapeRegExp(routeTokenToExclude)

  const leadingUnderscoreRegex = hasLeadingUnderscore
    ? new RegExp(`(?<=^|\\/)_(?!${escapedRouteToken})`, 'g')
    : new RegExp(`(?<=^|\\/)_`, 'g')

  return s.replaceAll(leadingUnderscoreRegex, '')
}

export function removeTrailingUnderscores(s: string, routeToken: string) {
  if (!s) return s

  const hasTrailingUnderscore = routeToken.slice(-1) === '_'

  const routeTokenToExclude = hasTrailingUnderscore
    ? routeToken.slice(0, -1)
    : routeToken

  const escapedRouteToken = escapeRegExp(routeTokenToExclude)

  const trailingUnderscoreRegex = hasTrailingUnderscore
    ? new RegExp(`(?<!${escapedRouteToken})_(?=\\/|$)`, 'g')
    : new RegExp(`_(?=\\/)|_$`, 'g')

  return s.replaceAll(trailingUnderscoreRegex, '')
}

export function capitalize(s: string) {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function removeExt(d: string, addExtensions: boolean | string = false) {
  if (typeof addExtensions === 'string') {
    const dotIndex = d.lastIndexOf('.')
    if (dotIndex === -1) return d
    return d.substring(0, dotIndex) + addExtensions
  }
  return addExtensions ? d : d.substring(0, d.lastIndexOf('.')) || d
}

/**
 * This function writes to a file if the content is different.
 *
 * @param filepath The path to the file
 * @param content Original content
 * @param incomingContent New content
 * @param callbacks Callbacks to run before and after writing
 * @returns Whether the file was written
 */
export async function writeIfDifferent(
  filepath: string,
  content: string,
  incomingContent: string,
  callbacks?: { beforeWrite?: () => void; afterWrite?: () => void },
): Promise<boolean> {
  if (content !== incomingContent) {
    callbacks?.beforeWrite?.()
    await fsp.writeFile(filepath, incomingContent)
    callbacks?.afterWrite?.()
    return true
  }
  return false
}

/**
 * This function formats the source code using the default formatter (Prettier).
 *
 * @param source The content to format
 * @param config The configuration object
 * @returns The formatted content
 */
export async function format(
  source: string,
  config: {
    quoteStyle: 'single' | 'double'
    semicolons: boolean
  },
): Promise<string> {
  const prettierOptions: prettier.Config = {
    semi: config.semicolons,
    singleQuote: config.quoteStyle === 'single',
    parser: 'typescript',
  }
  return prettier.format(source, prettierOptions)
}

/**
 * This function resets the regex index to 0 so that it can be reused
 * without having to create a new regex object or worry about the last
 * state when using the global flag.
 *
 * @param regex The regex object to reset
 * @returns
 */
export function resetRegex(regex: RegExp) {
  regex.lastIndex = 0
  return
}

/**
 * This function checks if a file exists.
 *
 * @param file The path to the file
 * @returns Whether the file exists
 */
export async function checkFileExists(file: string) {
  try {
    await fsp.access(file, fsp.constants.F_OK)
    return true
  } catch {
    return false
  }
}

const possiblyNestedRouteGroupPatternRegex = /\([^/]+\)\/?/g
export function removeGroups(s: string) {
  return s.replace(possiblyNestedRouteGroupPatternRegex, '')
}

/**
 * Removes all segments from a given path that start with an underscore ('_').
 *
 * @param {string} routePath - The path from which to remove segments. Defaults to '/'.
 * @returns {string} The path with all underscore-prefixed segments removed.
 * @example
 * removeLayoutSegments('/workspace/_auth/foo') // '/workspace/foo'
 */
export function removeLayoutSegments(routePath: string = '/'): string {
  const segments = routePath.split('/')
  const newSegments = segments.filter((segment) => !segment.startsWith('_'))
  return newSegments.join('/')
}

/**
 * The `node.path` is used as the `id` in the route definition.
 * This function checks if the given node has a parent and if so, it determines the correct path for the given node.
 * @param node - The node to determine the path for.
 * @returns The correct path for the given node.
 */
export function determineNodePath(node: RouteNode) {
  return (node.path = node.parent
    ? node.routePath?.replace(node.parent.routePath ?? '', '') || '/'
    : node.routePath)
}

/**
 * Removes the last segment from a given path. Segments are considered to be separated by a '/'.
 *
 * @param {string} routePath - The path from which to remove the last segment. Defaults to '/'.
 * @returns {string} The path with the last segment removed.
 * @example
 * removeLastSegmentFromPath('/workspace/_auth/foo') // '/workspace/_auth'
 */
export function removeLastSegmentFromPath(routePath: string = '/'): string {
  const segments = routePath.split('/')
  segments.pop() // Remove the last segment
  return segments.join('/')
}

/**
 * Find parent route using RoutePrefixMap for O(k) lookups instead of O(n).
 */
export function hasParentRoute(
  prefixMap: RoutePrefixMap,
  node: RouteNode,
  routePathToCheck: string | undefined,
): RouteNode | null {
  if (!routePathToCheck || routePathToCheck === '/') {
    return null
  }

  return prefixMap.findParent(routePathToCheck)
}

/**
 * Gets the final variable name for a route
 */
export const getResolvedRouteNodeVariableName = (
  routeNode: RouteNode,
): string => {
  return routeNode.children?.length
    ? `${routeNode.variableName}RouteWithChildren`
    : `${routeNode.variableName}Route`
}

/**
 * Infers the path for use by TS
 */
const inferPath = (routeNode: RouteNode): string => {
  if (routeNode.cleanedPath === '/') {
    return routeNode.cleanedPath ?? ''
  }
  return routeNode.cleanedPath?.replace(/\/$/, '') ?? ''
}

/**
 * Infers the full path for use by TS
 */
export const inferFullPath = (routeNode: RouteNode): string => {
  const fullPath = removeGroups(
    removeLayoutSegmentsAndUnderscoresWithEscape(
      routeNode.routePath,
      routeNode.originalRoutePath,
      routeNode._routePathSegmentMetadata,
    ),
  )

  if (fullPath === '') {
    return '/'
  }

  // Preserve trailing slash for index routes (routePath ends with '/')
  // This ensures types match runtime behavior
  const isIndexRoute = routeNode.routePath?.endsWith('/')
  if (isIndexRoute) {
    return fullPath
  }

  return fullPath.replace(/\/$/, '')
}

const shouldPreferIndexRoute = (
  current: RouteNode,
  existing: RouteNode,
): boolean => {
  return existing.cleanedPath === '/' && current.cleanedPath !== '/'
}

const isIndexRouteNode = (routeNode: RouteNode): boolean => {
  return routeNode.routePath?.endsWith('/') ?? false
}

const isPathlessRouteNode = (routeNode: RouteNode): boolean => {
  return routeNode._fsRouteType === 'pathless_layout'
}

const shouldReplaceRouteNodeForTo = (
  current: RouteNode,
  existing: RouteNode,
): boolean => {
  const currentIsIndex = isIndexRouteNode(current)
  const existingIsIndex = isIndexRouteNode(existing)
  if (currentIsIndex !== existingIsIndex) {
    return currentIsIndex
  }

  const currentIsPathless = isPathlessRouteNode(current)
  const existingIsPathless = isPathlessRouteNode(existing)
  if (currentIsPathless !== existingIsPathless) {
    return !currentIsPathless
  }

  return true
}

const shouldReplaceRouteNodeForFullPath = (
  current: RouteNode,
  existing: RouteNode,
): boolean => {
  const currentIsPathless = isPathlessRouteNode(current)
  const existingIsPathless = isPathlessRouteNode(existing)
  if (currentIsPathless !== existingIsPathless) {
    return !currentIsPathless
  }

  return true
}

/**
 * Creates a map from fullPath to routeNode
 */
export const createRouteNodesByFullPath = (
  routeNodes: Array<RouteNode>,
): Map<string, RouteNode> => {
  const map = new Map<string, RouteNode>()

  for (const routeNode of routeNodes) {
    const fullPath = inferFullPath(routeNode)

    if (fullPath === '/' && map.has('/')) {
      const existing = map.get('/')!
      if (shouldPreferIndexRoute(routeNode, existing)) {
        continue
      }
    }

    const existing = map.get(fullPath)
    if (existing && !shouldReplaceRouteNodeForFullPath(routeNode, existing)) {
      continue
    }

    map.set(fullPath, routeNode)
  }

  return map
}

/**
 * Create a map from 'to' to a routeNode
 */
export const createRouteNodesByTo = (
  routeNodes: Array<RouteNode>,
): Map<string, RouteNode> => {
  const map = new Map<string, RouteNode>()

  for (const routeNode of dedupeBranchesAndIndexRoutes(routeNodes)) {
    const to = inferTo(routeNode)

    const existing = map.get(to)
    if (existing && !shouldReplaceRouteNodeForTo(routeNode, existing)) {
      continue
    }

    map.set(to, routeNode)
  }

  return map
}

/**
 * Create a map from 'id' to a routeNode
 */
export const createRouteNodesById = (
  routeNodes: Array<RouteNode>,
): Map<string, RouteNode> => {
  return new Map(
    routeNodes.map((routeNode) => {
      const id = routeNode.routePath ?? ''
      return [id, routeNode]
    }),
  )
}

/**
 * Infers to path
 */
const inferTo = (routeNode: RouteNode): string => {
  const fullPath = inferFullPath(routeNode)

  if (fullPath === '/') return fullPath

  return fullPath.replace(/\/$/, '')
}

/**
 * Dedupes branches and index routes
 */
const dedupeBranchesAndIndexRoutes = (
  routes: Array<RouteNode>,
): Array<RouteNode> => {
  return routes.filter((route) => {
    if (route.children?.find((child) => child.cleanedPath === '/')) return false
    return true
  })
}

function checkUnique<TElement>(routes: Array<TElement>, key: keyof TElement) {
  // Check no two routes have the same `key`
  // if they do, throw an error with the conflicting filePaths
  const keys = routes.map((d) => d[key])
  const uniqueKeys = new Set(keys)
  if (keys.length !== uniqueKeys.size) {
    const duplicateKeys = keys.filter((d, i) => keys.indexOf(d) !== i)
    const conflictingFiles = routes.filter((d) =>
      duplicateKeys.includes(d[key]),
    )
    return conflictingFiles
  }
  return undefined
}

export function checkRouteFullPathUniqueness(
  _routes: Array<RouteNode>,
  config: Config,
) {
  const emptyPathRoutes = _routes.filter((d) => d.routePath === '')
  if (emptyPathRoutes.length) {
    const errorMessage = `Invalid route path "" was found. Root routes must be defined via __root.tsx (createRootRoute), not createFileRoute('') or a route file that resolves to an empty path.
Conflicting files: \n ${emptyPathRoutes
      .map((d) => path.resolve(config.routesDirectory, d.filePath))
      .join('\n ')}\n`
    throw new Error(errorMessage)
  }

  const routes = _routes.map((d) => {
    const inferredFullPath = inferFullPath(d)
    return { ...d, inferredFullPath }
  })

  const conflictingFiles = checkUnique(routes, 'inferredFullPath')

  if (conflictingFiles !== undefined) {
    const errorMessage = `Conflicting configuration paths were found for the following route${conflictingFiles.length > 1 ? 's' : ''}: ${conflictingFiles
      .map((p) => `"${p.inferredFullPath}"`)
      .join(', ')}.
Please ensure each Route has a unique full path.
Conflicting files: \n ${conflictingFiles.map((d) => path.resolve(config.routesDirectory, d.filePath)).join('\n ')}\n`
    throw new Error(errorMessage)
  }
}

export function buildRouteTreeConfig(
  nodes: Array<RouteNode>,
  disableTypes: boolean,
  depth = 1,
): Array<string> {
  const children = nodes.map((node) => {
    if (node._fsRouteType === '__root') {
      return
    }

    if (node._fsRouteType === 'pathless_layout' && !node.children?.length) {
      return
    }

    const route = `${node.variableName}`

    if (node.children?.length) {
      const childConfigs = buildRouteTreeConfig(
        node.children,
        disableTypes,
        depth + 1,
      )

      const childrenDeclaration = disableTypes
        ? ''
        : `interface ${route}RouteChildren {
  ${node.children
    .map(
      (child) =>
        `${child.variableName}Route: typeof ${getResolvedRouteNodeVariableName(child)}`,
    )
    .join(',')}
}`

      const children = `const ${route}RouteChildren${disableTypes ? '' : `: ${route}RouteChildren`} = {
  ${node.children
    .map(
      (child) =>
        `${child.variableName}Route: ${getResolvedRouteNodeVariableName(child)}`,
    )
    .join(',')}
}`

      const routeWithChildren = `const ${route}RouteWithChildren = ${route}Route._addFileChildren(${route}RouteChildren)`

      return [
        childConfigs.join('\n'),
        childrenDeclaration,
        children,
        routeWithChildren,
      ].join('\n\n')
    }

    return undefined
  })

  return children.filter((x) => x !== undefined)
}

export function buildImportString(
  importDeclaration: ImportDeclaration,
): string {
  const { source, specifiers, importKind } = importDeclaration
  return specifiers.length
    ? `import ${importKind === 'type' ? 'type ' : ''}{ ${specifiers.map((s) => (s.local ? `${s.imported} as ${s.local}` : s.imported)).join(', ')} } from '${source}'`
    : ''
}

export function mergeImportDeclarations(
  imports: Array<ImportDeclaration>,
): Array<ImportDeclaration> {
  const merged = new Map<string, ImportDeclaration>()

  for (const imp of imports) {
    const key = `${imp.source}-${imp.importKind ?? ''}`
    let existing = merged.get(key)
    if (!existing) {
      existing = { ...imp, specifiers: [] }
      merged.set(key, existing)
    }

    const existingSpecs = existing.specifiers
    for (const specifier of imp.specifiers) {
      let found = false
      for (let i = 0; i < existingSpecs.length; i++) {
        const e = existingSpecs[i]!
        if (e.imported === specifier.imported && e.local === specifier.local) {
          found = true
          break
        }
      }
      if (!found) {
        existingSpecs.push(specifier)
      }
    }
  }

  return [...merged.values()]
}

export const findParent = (node: RouteNode | undefined): string => {
  if (!node) {
    return `rootRouteImport`
  }
  if (node.parent) {
    return `${node.parent.variableName}Route`
  }
  return findParent(node.parent)
}

export function buildFileRoutesByPathInterface(opts: {
  routeNodes: Array<RouteNode>
  module: string
  interfaceName: string
  config?: Pick<Config, 'routeToken'>
}): string {
  return `declare module '${opts.module}' {
  interface ${opts.interfaceName} {
    ${opts.routeNodes
      .map((routeNode) => {
        const filePathId = routeNode.routePath
        const preloaderRoute = `typeof ${routeNode.variableName}RouteImport`

        const parent = findParent(routeNode)

        return `'${filePathId}': {
          id: '${filePathId}'
          path: '${inferPath(routeNode)}'
          fullPath: '${inferFullPath(routeNode)}'
          preLoaderRoute: ${preloaderRoute}
          parentRoute: typeof ${parent}
        }`
      })
      .join('\n')}
  }
}`
}

function getImportPath(
  node: RouteNode,
  config: Config,
  generatedRouteTreePath: string,
): string {
  return replaceBackslash(
    removeExt(
      path.relative(
        path.dirname(generatedRouteTreePath),
        path.resolve(config.routesDirectory, node.filePath),
      ),
      config.addExtensions,
    ),
  )
}

export function getImportForRouteNode(
  node: RouteNode,
  config: Config,
  generatedRouteTreePath: string,
  root: string,
): ImportDeclaration {
  let source = ''
  if (config.importRoutesUsingAbsolutePaths) {
    source = replaceBackslash(
      removeExt(
        path.resolve(root, config.routesDirectory, node.filePath),
        config.addExtensions,
      ),
    )
  } else {
    source = `./${getImportPath(node, config, generatedRouteTreePath)}`
  }
  return {
    source,
    specifiers: [
      {
        imported: 'Route',
        local: `${node.variableName}RouteImport`,
      },
    ],
  } satisfies ImportDeclaration
}

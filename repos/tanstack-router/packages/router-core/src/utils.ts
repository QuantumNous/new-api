import { isServer } from '@tanstack/router-core/isServer'
import type { RouteIds } from './routeInfo'
import type { AnyRouter } from './router'

export type Awaitable<T> = T | Promise<T>
export type NoInfer<T> = [T][T extends any ? 0 : never]
export type IsAny<TValue, TYesResult, TNoResult = TValue> = 1 extends 0 & TValue
  ? TYesResult
  : TNoResult

export type PickAsRequired<TValue, TKey extends keyof TValue> = Omit<
  TValue,
  TKey
> &
  Required<Pick<TValue, TKey>>

export type PickRequired<T> = {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K]
}

export type PickOptional<T> = {
  [K in keyof T as undefined extends T[K] ? K : never]: T[K]
}

// from https://stackoverflow.com/a/76458160
export type WithoutEmpty<T> = T extends any ? ({} extends T ? never : T) : never

export type Expand<T> = T extends object
  ? T extends infer O
    ? O extends Function
      ? O
      : { [K in keyof O]: O[K] }
    : never
  : T

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>
    }
  : T

export type MakeDifferenceOptional<TLeft, TRight> = keyof TLeft &
  keyof TRight extends never
  ? TRight
  : Omit<TRight, keyof TLeft & keyof TRight> & {
      [K in keyof TLeft & keyof TRight]?: TRight[K]
    }

// from https://stackoverflow.com/a/53955431
// eslint-disable-next-line @typescript-eslint/naming-convention
export type IsUnion<T, U extends T = T> = (
  T extends any ? (U extends T ? false : true) : never
) extends false
  ? false
  : true

export type IsNonEmptyObject<T> = T extends object
  ? keyof T extends never
    ? false
    : true
  : false

export type Assign<TLeft, TRight> = TLeft extends any
  ? TRight extends any
    ? IsNonEmptyObject<TLeft> extends false
      ? TRight
      : IsNonEmptyObject<TRight> extends false
        ? TLeft
        : keyof TLeft & keyof TRight extends never
          ? TLeft & TRight
          : Omit<TLeft, keyof TRight> & TRight
    : never
  : never

export type IntersectAssign<TLeft, TRight> = TLeft extends any
  ? TRight extends any
    ? IsNonEmptyObject<TLeft> extends false
      ? TRight
      : IsNonEmptyObject<TRight> extends false
        ? TLeft
        : TRight & TLeft
    : never
  : never

export type Timeout = ReturnType<typeof setTimeout>

export type Updater<TPrevious, TResult = TPrevious> =
  | TResult
  | ((prev?: TPrevious) => TResult)

export type NonNullableUpdater<TPrevious, TResult = TPrevious> =
  | TResult
  | ((prev: TPrevious) => TResult)

export type ExtractObjects<TUnion> = TUnion extends MergeAllPrimitive
  ? never
  : TUnion

export type PartialMergeAllObject<TUnion> =
  ExtractObjects<TUnion> extends infer TObj
    ? [TObj] extends [never]
      ? never
      : {
          [TKey in TObj extends any ? keyof TObj : never]?: TObj extends any
            ? TKey extends keyof TObj
              ? TObj[TKey]
              : never
            : never
        }
    : never

export type MergeAllPrimitive =
  | ReadonlyArray<any>
  | number
  | string
  | bigint
  | boolean
  | symbol
  | undefined
  | null

export type ExtractPrimitives<TUnion> = TUnion extends MergeAllPrimitive
  ? TUnion
  : TUnion extends object
    ? never
    : TUnion

export type PartialMergeAll<TUnion> =
  | ExtractPrimitives<TUnion>
  | PartialMergeAllObject<TUnion>

export type Constrain<T, TConstraint, TDefault = TConstraint> =
  | (T extends TConstraint ? T : never)
  | TDefault

export type ConstrainLiteral<T, TConstraint, TDefault = TConstraint> =
  | (T & TConstraint)
  | TDefault

/**
 * To be added to router types
 */
export type UnionToIntersection<T> = (
  T extends any ? (arg: T) => any : never
) extends (arg: infer T) => any
  ? T
  : never

/**
 * Merges everything in a union into one object.
 * This mapped type is homomorphic which means it preserves stuff! :)
 */
export type MergeAllObjects<
  TUnion,
  TIntersected = UnionToIntersection<ExtractObjects<TUnion>>,
> = [keyof TIntersected] extends [never]
  ? never
  : {
      [TKey in keyof TIntersected]: TUnion extends any
        ? TUnion[TKey & keyof TUnion]
        : never
    }

export type MergeAll<TUnion> =
  | MergeAllObjects<TUnion>
  | ExtractPrimitives<TUnion>

export type ValidateJSON<T> = ((...args: Array<any>) => any) extends T
  ? unknown extends T
    ? never
    : 'Function is not serializable'
  : { [K in keyof T]: ValidateJSON<T[K]> }

export type LooseReturnType<T> = T extends (
  ...args: Array<any>
) => infer TReturn
  ? TReturn
  : never

export type LooseAsyncReturnType<T> = T extends (
  ...args: Array<any>
) => infer TReturn
  ? TReturn extends Promise<infer TReturn>
    ? TReturn
    : TReturn
  : never

/**
 * Return the last element of an array.
 * Intended for non-empty arrays used within router internals.
 */
export function last<T>(arr: ReadonlyArray<T>) {
  return arr[arr.length - 1]
}

function isFunction(d: any): d is Function {
  return typeof d === 'function'
}

/**
 * Apply a value-or-updater to a previous value.
 * Accepts either a literal value or a function of the previous value.
 */
export function functionalUpdate<TPrevious, TResult = TPrevious>(
  updater: Updater<TPrevious, TResult> | NonNullableUpdater<TPrevious, TResult>,
  previous: TPrevious,
): TResult {
  if (isFunction(updater)) {
    return updater(previous)
  }

  return updater
}

export const hasOwn = Object.prototype.hasOwnProperty
const isEnumerable = Object.prototype.propertyIsEnumerable

export function hasKeys(obj: Record<string, unknown>) {
  for (const key in obj) {
    if (hasOwn.call(obj, key)) return true
  }
  return false
}

export const createNull = () => Object.create(null)
export const nullReplaceEqualDeep: typeof replaceEqualDeep = (prev, next) =>
  replaceEqualDeep(prev, next, createNull)

/**
 * This function returns `prev` if `_next` is deeply equal.
 * If not, it will replace any deeply equal children of `b` with those of `a`.
 * This can be used for structural sharing between immutable JSON values for example.
 * Do not use this with signals
 */
export function replaceEqualDeep<T>(
  prev: any,
  _next: T,
  _makeObj = () => ({}),
  _depth = 0,
): T {
  if (isServer) {
    return _next
  }
  if (prev === _next) {
    return prev
  }

  if (_depth > 500) return _next

  const next = _next as any

  const array = isPlainArray(prev) && isPlainArray(next)

  if (!array && !(isPlainObject(prev) && isPlainObject(next))) return next

  const prevItems = array ? prev : getEnumerableOwnKeys(prev)
  if (!prevItems) return next
  const nextItems = array ? next : getEnumerableOwnKeys(next)
  if (!nextItems) return next
  const prevSize = prevItems.length
  const nextSize = nextItems.length
  const copy: any = array ? new Array(nextSize) : _makeObj()

  let equalItems = 0

  for (let i = 0; i < nextSize; i++) {
    const key = array ? i : (nextItems[i] as any)
    const p = prev[key]
    const n = next[key]

    if (p === n) {
      copy[key] = p
      if (array ? i < prevSize : hasOwn.call(prev, key)) equalItems++
      continue
    }

    if (
      p === null ||
      n === null ||
      typeof p !== 'object' ||
      typeof n !== 'object'
    ) {
      copy[key] = n
      continue
    }

    const v = replaceEqualDeep(p, n, _makeObj, _depth + 1)
    copy[key] = v
    if (v === p) equalItems++
  }

  return prevSize === nextSize && equalItems === prevSize ? prev : copy
}

/**
 * Equivalent to `Reflect.ownKeys`, but ensures that objects are "clone-friendly":
 * will return false if object has any non-enumerable properties.
 *
 * Optimized for the common case where objects have no symbol properties.
 */
function getEnumerableOwnKeys(o: object) {
  const names = Object.getOwnPropertyNames(o)

  // Fast path: check all string property names are enumerable
  for (const name of names) {
    if (!isEnumerable.call(o, name)) return false
  }

  // Only check symbols if the object has any (most plain objects don't)
  const symbols = Object.getOwnPropertySymbols(o)

  // Fast path: no symbols, return names directly (avoids array allocation/concat)
  if (symbols.length === 0) return names

  // Slow path: has symbols, need to check and merge
  const keys: Array<string | symbol> = names
  for (const symbol of symbols) {
    if (!isEnumerable.call(o, symbol)) return false
    keys.push(symbol)
  }
  return keys
}

// Copied from: https://github.com/jonschlinkert/is-plain-object
export function isPlainObject(o: any) {
  if (!hasObjectPrototype(o)) {
    return false
  }

  // If has modified constructor
  const ctor = o.constructor
  if (typeof ctor === 'undefined') {
    return true
  }

  // If has modified prototype
  const prot = ctor.prototype
  if (!hasObjectPrototype(prot)) {
    return false
  }

  // If constructor does not have an Object-specific method
  if (!prot.hasOwnProperty('isPrototypeOf')) {
    return false
  }

  // Most likely a plain Object
  return true
}

function hasObjectPrototype(o: any) {
  return Object.prototype.toString.call(o) === '[object Object]'
}

/**
 * Check if a value is a "plain" array (no extra enumerable keys).
 */
export function isPlainArray(value: unknown): value is Array<unknown> {
  return Array.isArray(value) && value.length === Object.keys(value).length
}

/**
 * Perform a deep equality check with options for partial comparison and
 * ignoring `undefined` values. Optimized for router state comparisons.
 */
export function deepEqual(
  a: any,
  b: any,
  opts?: { partial?: boolean; ignoreUndefined?: boolean },
): boolean {
  if (a === b) {
    return true
  }

  if (typeof a !== typeof b) {
    return false
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0, l = a.length; i < l; i++) {
      if (!deepEqual(a[i], b[i], opts)) return false
    }
    return true
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const ignoreUndefined = opts?.ignoreUndefined ?? true

    if (opts?.partial) {
      for (const k in b) {
        if (!ignoreUndefined || b[k] !== undefined) {
          if (!deepEqual(a[k], b[k], opts)) return false
        }
      }
      return true
    }

    let aCount = 0
    if (!ignoreUndefined) {
      aCount = Object.keys(a).length
    } else {
      for (const k in a) {
        if (a[k] !== undefined) aCount++
      }
    }

    let bCount = 0
    for (const k in b) {
      if (!ignoreUndefined || b[k] !== undefined) {
        bCount++
        if (bCount > aCount || !deepEqual(a[k], b[k], opts)) return false
      }
    }

    return aCount === bCount
  }

  return false
}

export type StringLiteral<T> = T extends string
  ? string extends T
    ? string
    : T
  : never

export type ThrowOrOptional<T, TThrow extends boolean> = TThrow extends true
  ? T
  : T | undefined

export type StrictOrFrom<
  TRouter extends AnyRouter,
  TFrom,
  TStrict extends boolean = true,
> = TStrict extends false
  ? {
      from?: never
      strict: TStrict
    }
  : {
      from: ConstrainLiteral<TFrom, RouteIds<TRouter['routeTree']>>
      strict?: TStrict
    }

export type ThrowConstraint<
  TStrict extends boolean,
  TThrow extends boolean,
> = TStrict extends false ? (TThrow extends true ? never : TThrow) : TThrow

export type ControlledPromise<T> = Promise<T> & {
  resolve: (value: T) => void
  reject: (value: any) => void
  status: 'pending' | 'resolved' | 'rejected'
  value?: T
}

/**
 * Create a promise with exposed resolve/reject and status fields.
 * Useful for coordinating async router lifecycle operations.
 */
export function createControlledPromise<T>(onResolve?: (value: T) => void) {
  let resolveLoadPromise!: (value: T) => void
  let rejectLoadPromise!: (value: any) => void

  const controlledPromise = new Promise<T>((resolve, reject) => {
    resolveLoadPromise = resolve
    rejectLoadPromise = reject
  }) as ControlledPromise<T>

  controlledPromise.status = 'pending'

  controlledPromise.resolve = (value: T) => {
    controlledPromise.status = 'resolved'
    controlledPromise.value = value
    resolveLoadPromise(value)
    onResolve?.(value)
  }

  controlledPromise.reject = (e) => {
    controlledPromise.status = 'rejected'
    rejectLoadPromise(e)
  }

  return controlledPromise
}

/**
 * Heuristically detect dynamic import "module not found" errors
 * across major browsers for lazy route component handling.
 */
export function isModuleNotFoundError(error: any): boolean {
  // chrome: "Failed to fetch dynamically imported module: http://localhost:5173/src/routes/posts.index.tsx?tsr-split"
  // firefox: "error loading dynamically imported module: http://localhost:5173/src/routes/posts.index.tsx?tsr-split"
  // safari: "Importing a module script failed."
  if (typeof error?.message !== 'string') return false
  return (
    error.message.startsWith('Failed to fetch dynamically imported module') ||
    error.message.startsWith('error loading dynamically imported module') ||
    error.message.startsWith('Importing a module script failed')
  )
}

export function isPromise<T>(
  value: Promise<Awaited<T>> | T,
): value is Promise<Awaited<T>> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as Promise<T>).then === 'function',
  )
}

export function findLast<T>(
  array: ReadonlyArray<T>,
  predicate: (item: T) => boolean,
): T | undefined {
  for (let i = array.length - 1; i >= 0; i--) {
    const item = array[i]!
    if (predicate(item)) return item
  }
  return undefined
}

/**
 * Re-encode characters that are unsafe in URL paths.
 * Includes ASCII control characters (0x00-0x1F, 0x7F) and a subset of the
 * WHATWG URL "path percent-encode set" (", <, >, `, {, }).
 *
 * Space (0x20) is intentionally excluded — decodeURI decodes %20 to space
 * and the router stores decoded spaces in location.pathname. The existing
 * encodePathLikeUrl already handles re-encoding spaces for outgoing URLs.
 *
 * These characters are decoded by decodeURI but must remain percent-encoded
 * in paths to match how upstream layers (CDNs, edge middleware, browsers)
 * interpret the URL, preventing infinite redirect loops and path mismatches.
 */
// eslint-disable-next-line no-control-regex
const PATH_UNSAFE_RE = /[\x00-\x1f\x7f"<>`{}]/g

function sanitizePathSegment(segment: string): string {
  return segment.replace(
    PATH_UNSAFE_RE,
    (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'),
  )
}

function decodeSegment(segment: string): string {
  let decoded: string
  try {
    decoded = decodeURI(segment)
  } catch {
    // if the decoding fails, try to decode the various parts leaving the malformed tags in place
    decoded = segment.replaceAll(/%[0-9A-F]{2}/gi, (match) => {
      try {
        return decodeURI(match)
      } catch {
        return match
      }
    })
  }
  return sanitizePathSegment(decoded)
}

/**
 * Default list of URL protocols to allow in links, redirects, and navigation.
 * Any absolute URL protocol not in this list is treated as dangerous by default.
 */
export const DEFAULT_PROTOCOL_ALLOWLIST = [
  // Standard web navigation
  'http:',
  'https:',

  // Common browser-safe actions
  'mailto:',
  'tel:',
]

/**
 * Check if a URL string uses a protocol that is not in the allowlist.
 * Returns true for blocked protocols like javascript:, blob:, data:, etc.
 *
 * The URL constructor correctly normalizes:
 * - Mixed case (JavaScript: → javascript:)
 * - Whitespace/control characters (java\nscript: → javascript:)
 * - Leading whitespace
 *
 * For relative URLs (no protocol), returns false (safe).
 *
 * @param url - The URL string to check
 * @param allowlist - Set of protocols to allow
 * @returns true if the URL uses a protocol that is not allowed
 */
export function isDangerousProtocol(
  url: string,
  allowlist: Set<string>,
): boolean {
  if (!url) return false

  try {
    // Use the URL constructor - it correctly normalizes protocols
    // per WHATWG URL spec, handling all bypass attempts automatically
    const parsed = new URL(url)
    return !allowlist.has(parsed.protocol)
  } catch {
    // URL constructor throws for relative URLs (no protocol)
    // These are safe - they can't execute scripts
    return false
  }
}

// This utility is based on https://github.com/zertosh/htmlescape
// License: https://github.com/zertosh/htmlescape/blob/0527ca7156a524d256101bb310a9f970f63078ad/LICENSE
const HTML_ESCAPE_LOOKUP: { [match: string]: string } = {
  '&': '\\u0026',
  '>': '\\u003e',
  '<': '\\u003c',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
}

const HTML_ESCAPE_REGEX = /[&><\u2028\u2029]/g

/**
 * Escape HTML special characters in a string to prevent XSS attacks
 * when embedding strings in script tags during SSR.
 *
 * This is essential for preventing XSS vulnerabilities when user-controlled
 * content is embedded in inline scripts.
 */
export function escapeHtml(str: string): string {
  return str.replace(HTML_ESCAPE_REGEX, (match) => HTML_ESCAPE_LOOKUP[match]!)
}

export function decodePath(path: string) {
  if (!path) return { path, handledProtocolRelativeURL: false }

  // Fast path: most paths are already decoded and safe.
  // Only fall back to the slower scan/regex path when we see a '%' (encoded),
  // a backslash (explicitly handled), a control character, or a protocol-relative
  // prefix which needs collapsing.
  // eslint-disable-next-line no-control-regex
  if (!/[%\\\x00-\x1f\x7f]/.test(path) && !path.startsWith('//')) {
    return { path, handledProtocolRelativeURL: false }
  }

  const re = /%25|%5C/gi
  let cursor = 0
  let result = ''
  let match
  while (null !== (match = re.exec(path))) {
    result += decodeSegment(path.slice(cursor, match.index)) + match[0]
    cursor = re.lastIndex
  }
  result = result + decodeSegment(cursor ? path.slice(cursor) : path)

  // Prevent open redirect via protocol-relative URLs (e.g. "//evil.com")
  // This is defense-in-depth: since control characters are no longer decoded,
  // paths like "/%0d/evil.com" can no longer become "//evil.com". But we keep
  // this check to guard against other edge cases.
  let handledProtocolRelativeURL = false
  if (result.startsWith('//')) {
    handledProtocolRelativeURL = true
    result = '/' + result.replace(/^\/+/, '')
  }

  return { path: result, handledProtocolRelativeURL }
}

/**
 * Encodes a path the same way `new URL()` would, but without the overhead of full URL parsing.
 *
 * This function encodes:
 * - Whitespace characters (spaces → %20, tabs → %09, etc.)
 * - Non-ASCII/Unicode characters (emojis, accented characters, etc.)
 *
 * It preserves:
 * - Already percent-encoded sequences (won't double-encode %2F, %25, etc.)
 * - ASCII special characters valid in URL paths (@, $, &, +, etc.)
 * - Forward slashes as path separators
 *
 * Used to generate proper href values for SSR without constructing URL objects.
 *
 * @example
 * encodePathLikeUrl('/path/file name.pdf') // '/path/file%20name.pdf'
 * encodePathLikeUrl('/path/日本語') // '/path/%E6%97%A5%E6%9C%AC%E8%AA%9E'
 * encodePathLikeUrl('/path/already%20encoded') // '/path/already%20encoded' (preserved)
 */
export function encodePathLikeUrl(path: string): string {
  // Encode whitespace and non-ASCII characters that browsers encode in URLs

  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ASCII range check
  // eslint-disable-next-line no-control-regex
  if (!/\s|[^\u0000-\u007F]/.test(path)) return path
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ASCII range check
  // eslint-disable-next-line no-control-regex
  return path.replace(/\s|[^\u0000-\u007F]/gu, encodeURIComponent)
}

/**
 * Builds the dev-mode CSS styles URL for route-scoped CSS collection.
 * Used by HeadContent components in all framework implementations to construct
 * the URL for the `/@tanstack-start/styles.css` endpoint.
 *
 * @param basepath - The router's basepath (may or may not have leading slash)
 * @param routeIds - Array of matched route IDs to include in the CSS collection
 * @returns The full URL path for the dev styles CSS endpoint
 */
export function buildDevStylesUrl(
  basepath: string,
  routeIds: Array<string>,
): string {
  // Trim all leading and trailing slashes from basepath
  const trimmedBasepath = basepath.replace(/^\/+|\/+$/g, '')
  // Build normalized basepath: empty string for root, or '/path' for non-root
  const normalizedBasepath = trimmedBasepath === '' ? '' : `/${trimmedBasepath}`
  return `${normalizedBasepath}/@tanstack-start/styles.css?routes=${encodeURIComponent(routeIds.join(','))}`
}

export function arraysEqual<T>(a: Array<T>, b: Array<T>) {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

import { invariant } from './invariant'
import { createLRUCache } from './lru-cache'
import { last } from './utils'
import type { LRUCache } from './lru-cache'

export const SEGMENT_TYPE_PATHNAME = 0
export const SEGMENT_TYPE_PARAM = 1
export const SEGMENT_TYPE_WILDCARD = 2
export const SEGMENT_TYPE_OPTIONAL_PARAM = 3
const SEGMENT_TYPE_INDEX = 4
const SEGMENT_TYPE_PATHLESS = 5 // only used in matching to represent pathless routes that need to carry more information

/**
 * All the kinds of segments that can be present in a route path.
 */
export type SegmentKind =
  | typeof SEGMENT_TYPE_PATHNAME
  | typeof SEGMENT_TYPE_PARAM
  | typeof SEGMENT_TYPE_WILDCARD
  | typeof SEGMENT_TYPE_OPTIONAL_PARAM

/**
 * All the kinds of segments that can be present in the segment tree.
 */
type ExtendedSegmentKind =
  | SegmentKind
  | typeof SEGMENT_TYPE_INDEX
  | typeof SEGMENT_TYPE_PATHLESS

function getOpenAndCloseBraces(
  part: string,
): [openBrace: number, closeBrace: number] | null {
  const openBrace = part.indexOf('{')
  if (openBrace === -1) return null
  const closeBrace = part.indexOf('}', openBrace)
  if (closeBrace === -1) return null
  const afterOpen = openBrace + 1
  if (afterOpen >= part.length) return null
  return [openBrace, closeBrace]
}

type ParsedSegment = Uint16Array & {
  /** segment type (0 = pathname, 1 = param, 2 = wildcard, 3 = optional param) */
  0: SegmentKind
  /** index of the end of the prefix */
  1: number
  /** index of the start of the value */
  2: number
  /** index of the end of the value */
  3: number
  /** index of the start of the suffix */
  4: number
  /** index of the end of the segment */
  5: number
}

/**
 * Populates the `output` array with the parsed representation of the given `segment` string.
 *
 * Usage:
 * ```ts
 * let output
 * let cursor = 0
 * while (cursor < path.length) {
 *   output = parseSegment(path, cursor, output)
 *   const end = output[5]
 *   cursor = end + 1
 * ```
 *
 * `output` is stored outside to avoid allocations during repeated calls. It doesn't need to be typed
 * or initialized, it will be done automatically.
 */
export function parseSegment(
  /** The full path string containing the segment. */
  path: string,
  /** The starting index of the segment within the path. */
  start: number,
  /** A Uint16Array (length: 6) to populate with the parsed segment data. */
  output: Uint16Array = new Uint16Array(6),
): ParsedSegment {
  const next = path.indexOf('/', start)
  const end = next === -1 ? path.length : next
  const part = path.substring(start, end)

  if (!part || !part.includes('$')) {
    // early escape for static pathname
    output[0] = SEGMENT_TYPE_PATHNAME
    output[1] = start
    output[2] = start
    output[3] = end
    output[4] = end
    output[5] = end
    return output as ParsedSegment
  }

  // $ (wildcard)
  if (part === '$') {
    const total = path.length
    output[0] = SEGMENT_TYPE_WILDCARD
    output[1] = start
    output[2] = start
    output[3] = total
    output[4] = total
    output[5] = total
    return output as ParsedSegment
  }

  // $paramName
  if (part.charCodeAt(0) === 36) {
    output[0] = SEGMENT_TYPE_PARAM
    output[1] = start
    output[2] = start + 1 // skip '$'
    output[3] = end
    output[4] = end
    output[5] = end
    return output as ParsedSegment
  }

  const braces = getOpenAndCloseBraces(part)
  if (braces) {
    const [openBrace, closeBrace] = braces
    const firstChar = part.charCodeAt(openBrace + 1)

    // Check for {-$...} (optional param)
    // prefix{-$paramName}suffix
    // /^([^{]*)\{-\$([a-zA-Z_$][a-zA-Z0-9_$]*)\}([^}]*)$/
    if (firstChar === 45) {
      // '-'
      if (
        openBrace + 2 < part.length &&
        part.charCodeAt(openBrace + 2) === 36 // '$'
      ) {
        const paramStart = openBrace + 3
        const paramEnd = closeBrace
        // Validate param name exists
        if (paramStart < paramEnd) {
          output[0] = SEGMENT_TYPE_OPTIONAL_PARAM
          output[1] = start + openBrace
          output[2] = start + paramStart
          output[3] = start + paramEnd
          output[4] = start + closeBrace + 1
          output[5] = end
          return output as ParsedSegment
        }
      }
    } else if (firstChar === 36) {
      // '$'
      const dollarPos = openBrace + 1
      const afterDollar = openBrace + 2
      // Check for {$} (wildcard)
      if (afterDollar === closeBrace) {
        // For wildcard, value should be '$' (from dollarPos to afterDollar)
        // prefix{$}suffix
        // /^([^{]*)\{\$\}([^}]*)$/
        output[0] = SEGMENT_TYPE_WILDCARD
        output[1] = start + openBrace
        output[2] = start + dollarPos
        output[3] = start + afterDollar
        output[4] = start + closeBrace + 1
        output[5] = path.length
        return output as ParsedSegment
      }
      // Regular param {$paramName} - value is the param name (after $)
      // prefix{$paramName}suffix
      // /^([^{]*)\{\$([a-zA-Z_$][a-zA-Z0-9_$]*)\}([^}]*)$/
      output[0] = SEGMENT_TYPE_PARAM
      output[1] = start + openBrace
      output[2] = start + afterDollar
      output[3] = start + closeBrace
      output[4] = start + closeBrace + 1
      output[5] = end
      return output as ParsedSegment
    }
  }

  // fallback to static pathname (should never happen)
  output[0] = SEGMENT_TYPE_PATHNAME
  output[1] = start
  output[2] = start
  output[3] = end
  output[4] = end
  output[5] = end
  return output as ParsedSegment
}

/**
 * Recursively parses the segments of the given route tree and populates a segment trie.
 *
 * @param data A reusable Uint16Array for parsing segments. (non important, we're just avoiding allocations)
 * @param route The current route to parse.
 * @param start The starting index for parsing within the route's full path.
 * @param node The current segment node in the trie to populate.
 * @param onRoute Callback invoked for each route processed.
 */
function parseSegments<TRouteLike extends RouteLike>(
  defaultCaseSensitive: boolean,
  data: Uint16Array,
  route: TRouteLike,
  start: number,
  node: AnySegmentNode<TRouteLike>,
  depth: number,
  onRoute?: (route: TRouteLike) => void,
) {
  onRoute?.(route)
  let cursor = start
  {
    const path = route.fullPath ?? route.from
    const length = path.length
    const caseSensitive = route.options?.caseSensitive ?? defaultCaseSensitive
    const parseParams =
      route.options?.params?.parse ?? route.options?.parseParams
    while (cursor < length) {
      const segment = parseSegment(path, cursor, data)
      let nextNode: AnySegmentNode<TRouteLike>
      const start = cursor
      const end = segment[5]
      cursor = end + 1
      depth++
      const kind = segment[0]
      switch (kind) {
        case SEGMENT_TYPE_PATHNAME: {
          const value = path.substring(segment[2], segment[3])
          if (caseSensitive) {
            const existingNode = node.static?.get(value)
            if (existingNode) {
              nextNode = existingNode
            } else {
              node.static ??= new Map()
              const next = createStaticNode<TRouteLike>(
                route.fullPath ?? route.from,
              )
              next.parent = node
              next.depth = depth
              nextNode = next
              node.static.set(value, next)
            }
          } else {
            const name = value.toLowerCase()
            const existingNode = node.staticInsensitive?.get(name)
            if (existingNode) {
              nextNode = existingNode
            } else {
              node.staticInsensitive ??= new Map()
              const next = createStaticNode<TRouteLike>(
                route.fullPath ?? route.from,
              )
              next.parent = node
              next.depth = depth
              nextNode = next
              node.staticInsensitive.set(name, next)
            }
          }
          break
        }
        case SEGMENT_TYPE_PARAM: {
          const prefix_raw = path.substring(start, segment[1])
          const suffix_raw = path.substring(segment[4], end)
          const actuallyCaseSensitive =
            caseSensitive && !!(prefix_raw || suffix_raw)
          const prefix = !prefix_raw
            ? undefined
            : actuallyCaseSensitive
              ? prefix_raw
              : prefix_raw.toLowerCase()
          const suffix = !suffix_raw
            ? undefined
            : actuallyCaseSensitive
              ? suffix_raw
              : suffix_raw.toLowerCase()
          const existingNode =
            !parseParams &&
            node.dynamic?.find(
              (s) =>
                !s.parse &&
                s.caseSensitive === actuallyCaseSensitive &&
                s.prefix === prefix &&
                s.suffix === suffix,
            )
          if (existingNode) {
            nextNode = existingNode
          } else {
            const next = createDynamicNode<TRouteLike>(
              SEGMENT_TYPE_PARAM,
              route.fullPath ?? route.from,
              actuallyCaseSensitive,
              prefix,
              suffix,
            )
            nextNode = next
            next.depth = depth
            next.parent = node
            node.dynamic ??= []
            node.dynamic.push(next)
          }
          break
        }
        case SEGMENT_TYPE_OPTIONAL_PARAM: {
          const prefix_raw = path.substring(start, segment[1])
          const suffix_raw = path.substring(segment[4], end)
          const actuallyCaseSensitive =
            caseSensitive && !!(prefix_raw || suffix_raw)
          const prefix = !prefix_raw
            ? undefined
            : actuallyCaseSensitive
              ? prefix_raw
              : prefix_raw.toLowerCase()
          const suffix = !suffix_raw
            ? undefined
            : actuallyCaseSensitive
              ? suffix_raw
              : suffix_raw.toLowerCase()
          const existingNode =
            !parseParams &&
            node.optional?.find(
              (s) =>
                !s.parse &&
                s.caseSensitive === actuallyCaseSensitive &&
                s.prefix === prefix &&
                s.suffix === suffix,
            )
          if (existingNode) {
            nextNode = existingNode
          } else {
            const next = createDynamicNode<TRouteLike>(
              SEGMENT_TYPE_OPTIONAL_PARAM,
              route.fullPath ?? route.from,
              actuallyCaseSensitive,
              prefix,
              suffix,
            )
            nextNode = next
            next.parent = node
            next.depth = depth
            node.optional ??= []
            node.optional.push(next)
          }
          break
        }
        case SEGMENT_TYPE_WILDCARD: {
          const prefix_raw = path.substring(start, segment[1])
          const suffix_raw = path.substring(segment[4], end)
          const actuallyCaseSensitive =
            caseSensitive && !!(prefix_raw || suffix_raw)
          const prefix = !prefix_raw
            ? undefined
            : actuallyCaseSensitive
              ? prefix_raw
              : prefix_raw.toLowerCase()
          const suffix = !suffix_raw
            ? undefined
            : actuallyCaseSensitive
              ? suffix_raw
              : suffix_raw.toLowerCase()
          const next = createDynamicNode<TRouteLike>(
            SEGMENT_TYPE_WILDCARD,
            route.fullPath ?? route.from,
            actuallyCaseSensitive,
            prefix,
            suffix,
          )
          nextNode = next
          next.parent = node
          next.depth = depth
          node.wildcard ??= []
          node.wildcard.push(next)
        }
      }
      node = nextNode
    }

    // create pathless node
    if (
      parseParams &&
      route.children &&
      !route.isRoot &&
      route.id &&
      route.id.charCodeAt(route.id.lastIndexOf('/') + 1) === 95 /* '_' */
    ) {
      const pathlessNode = createStaticNode<TRouteLike>(
        route.fullPath ?? route.from,
      )
      pathlessNode.kind = SEGMENT_TYPE_PATHLESS
      pathlessNode.parent = node
      depth++
      pathlessNode.depth = depth
      node.pathless ??= []
      node.pathless.push(pathlessNode)
      node = pathlessNode
    }

    const isLeaf = (route.path || !route.children) && !route.isRoot
    // create index node
    if (isLeaf && path.endsWith('/')) {
      const indexNode = createStaticNode<TRouteLike>(
        route.fullPath ?? route.from,
      )
      indexNode.kind = SEGMENT_TYPE_INDEX
      indexNode.parent = node
      depth++
      indexNode.depth = depth
      node.index = indexNode
      node = indexNode
    }

    node.parse = parseParams ?? null
    node.priority = route.options?.params?.priority ?? 0

    // make node "matchable"
    if (isLeaf && !node.route) {
      node.route = route
      node.fullPath = route.fullPath ?? route.from
    }
  }
  if (route.children)
    for (const child of route.children) {
      parseSegments(
        defaultCaseSensitive,
        data,
        child as TRouteLike,
        cursor,
        node,
        depth,
        onRoute,
      )
    }
}

function sortDynamic(
  a: {
    prefix?: string
    suffix?: string
    caseSensitive: boolean
    parse: null | ((params: Record<string, string>) => unknown)
    priority: number
  },
  b: {
    prefix?: string
    suffix?: string
    caseSensitive: boolean
    parse: null | ((params: Record<string, string>) => unknown)
    priority: number
  },
) {
  if (a.parse && !b.parse) return -1
  if (!a.parse && b.parse) return 1
  if (a.parse && b.parse && (a.priority || b.priority))
    return b.priority - a.priority
  if (a.prefix && b.prefix && a.prefix !== b.prefix) {
    if (a.prefix.startsWith(b.prefix)) return -1
    if (b.prefix.startsWith(a.prefix)) return 1
  }
  if (a.suffix && b.suffix && a.suffix !== b.suffix) {
    if (a.suffix.endsWith(b.suffix)) return -1
    if (b.suffix.endsWith(a.suffix)) return 1
  }
  if (a.prefix && !b.prefix) return -1
  if (!a.prefix && b.prefix) return 1
  if (a.suffix && !b.suffix) return -1
  if (!a.suffix && b.suffix) return 1
  if (a.caseSensitive && !b.caseSensitive) return -1
  if (!a.caseSensitive && b.caseSensitive) return 1

  // Equal specificity preserves route declaration order through stable sort.
  return 0
}

function sortTreeNodes(node: SegmentNode<RouteLike>) {
  if (node.pathless) {
    for (const child of node.pathless) {
      sortTreeNodes(child)
    }
  }
  if (node.static) {
    for (const child of node.static.values()) {
      sortTreeNodes(child)
    }
  }
  if (node.staticInsensitive) {
    for (const child of node.staticInsensitive.values()) {
      sortTreeNodes(child)
    }
  }
  if (node.dynamic?.length) {
    node.dynamic.sort(sortDynamic)
    for (const child of node.dynamic) {
      sortTreeNodes(child)
    }
  }
  if (node.optional?.length) {
    node.optional.sort(sortDynamic)
    for (const child of node.optional) {
      sortTreeNodes(child)
    }
  }
  if (node.wildcard?.length) {
    node.wildcard.sort(sortDynamic)
    for (const child of node.wildcard) {
      sortTreeNodes(child)
    }
  }
}

function createStaticNode<T extends RouteLike>(
  fullPath: string,
): StaticSegmentNode<T> {
  return {
    kind: SEGMENT_TYPE_PATHNAME,
    depth: 0,
    pathless: null,
    index: null,
    static: null,
    staticInsensitive: null,
    dynamic: null,
    optional: null,
    wildcard: null,
    route: null,
    fullPath,
    parent: null,
    parse: null,
    priority: 0,
  }
}

/**
 * Keys must be declared in the same order as in `SegmentNode` type,
 * to ensure they are represented as the same object class in the engine.
 */
function createDynamicNode<T extends RouteLike>(
  kind:
    | typeof SEGMENT_TYPE_PARAM
    | typeof SEGMENT_TYPE_WILDCARD
    | typeof SEGMENT_TYPE_OPTIONAL_PARAM,
  fullPath: string,
  caseSensitive: boolean,
  prefix?: string,
  suffix?: string,
): DynamicSegmentNode<T> {
  return {
    kind,
    depth: 0,
    pathless: null,
    index: null,
    static: null,
    staticInsensitive: null,
    dynamic: null,
    optional: null,
    wildcard: null,
    route: null,
    fullPath,
    parent: null,
    parse: null,
    priority: 0,
    caseSensitive,
    prefix,
    suffix,
  }
}

type StaticSegmentNode<T extends RouteLike> = SegmentNode<T> & {
  kind:
    | typeof SEGMENT_TYPE_PATHNAME
    | typeof SEGMENT_TYPE_PATHLESS
    | typeof SEGMENT_TYPE_INDEX
}

type DynamicSegmentNode<T extends RouteLike> = SegmentNode<T> & {
  kind:
    | typeof SEGMENT_TYPE_PARAM
    | typeof SEGMENT_TYPE_WILDCARD
    | typeof SEGMENT_TYPE_OPTIONAL_PARAM
  prefix?: string
  suffix?: string
  caseSensitive: boolean
}

type AnySegmentNode<T extends RouteLike> =
  | StaticSegmentNode<T>
  | DynamicSegmentNode<T>

type SegmentNode<T extends RouteLike> = {
  kind: ExtendedSegmentKind

  pathless: Array<StaticSegmentNode<T>> | null

  /** Exact index segment (highest priority) */
  index: StaticSegmentNode<T> | null

  /** Static segments (2nd priority) */
  static: Map<string, StaticSegmentNode<T>> | null

  /** Case insensitive static segments (3rd highest priority) */
  staticInsensitive: Map<string, StaticSegmentNode<T>> | null

  /** Dynamic segments ($param) */
  dynamic: Array<DynamicSegmentNode<T>> | null

  /** Optional dynamic segments ({-$param}) */
  optional: Array<DynamicSegmentNode<T>> | null

  /** Wildcard segments ($ - lowest priority) */
  wildcard: Array<DynamicSegmentNode<T>> | null

  /** Terminal route (if this path can end here) */
  route: T | null

  /** The full path for this segment node (will only be valid on leaf nodes) */
  fullPath: string

  parent: AnySegmentNode<T> | null

  depth: number

  /** route.options.params.parse function, set on the last node of the route */
  parse: null | ((params: Record<string, string>) => unknown)

  /** route.options.params.priority ?? 0 */
  priority: number
}

type RouteLike = {
  id?: string
  path?: string // relative path from the parent,
  children?: Array<RouteLike> // child routes,
  parentRoute?: RouteLike // parent route,
  isRoot?: boolean
  options?: {
    caseSensitive?: boolean
    parseParams?: (params: Record<string, string>) => unknown
    params?: {
      parse?: (params: Record<string, string>) => unknown
      priority?: number
    }
  }
} &
  // router tree
  (| { fullPath: string; from?: never } // full path from the root
    // flat route masks list
    | { fullPath?: never; from: string } // full path from the root
  )

export type ProcessedTree<
  TTree extends Extract<RouteLike, { fullPath: string }>,
  TFlat extends Extract<RouteLike, { from: string }>,
  TSingle extends Extract<RouteLike, { from: string }>,
> = {
  /** a representation of the `routeTree` as a segment tree */
  segmentTree: AnySegmentNode<TTree>
  /** a mini route tree generated from the flat `routeMasks` list */
  masksTree: AnySegmentNode<TFlat> | null
  /** @deprecated keep until v2 so that `router.matchRoute` can keep not caring about the actual route tree */
  singleCache: LRUCache<string, AnySegmentNode<TSingle>>
  /** a cache of route matches from the `segmentTree` */
  matchCache: LRUCache<string, RouteMatch<TTree> | null>
  /** a cache of route matches from the `masksTree` */
  flatCache: LRUCache<string, ReturnType<typeof findMatch<TFlat>>> | null
}

export function processRouteMasks<
  TRouteLike extends Extract<RouteLike, { from: string }>,
>(
  routeList: Array<TRouteLike>,
  processedTree: ProcessedTree<any, TRouteLike, any>,
) {
  const segmentTree = createStaticNode<TRouteLike>('/')
  const data = new Uint16Array(6)
  for (const route of routeList) {
    parseSegments(false, data, route, 1, segmentTree, 0)
  }
  sortTreeNodes(segmentTree)
  processedTree.masksTree = segmentTree
  processedTree.flatCache = createLRUCache<
    string,
    ReturnType<typeof findMatch<TRouteLike>>
  >(1000)
}

/**
 * Take an arbitrary list of routes, create a tree from them (if it hasn't been created already), and match a path against it.
 */
export function findFlatMatch<T extends Extract<RouteLike, { from: string }>>(
  /** The path to match. */
  path: string,
  /** The `processedTree` returned by the initial `processRouteTree` call. */
  processedTree: ProcessedTree<any, T, any>,
) {
  path ||= '/'
  const cached = processedTree.flatCache!.get(path)
  if (cached) return cached
  const result = findMatch(path, processedTree.masksTree!)
  processedTree.flatCache!.set(path, result)
  return result
}

/**
 * @deprecated keep until v2 so that `router.matchRoute` can keep not caring about the actual route tree
 */
export function findSingleMatch(
  from: string,
  caseSensitive: boolean,
  fuzzy: boolean,
  path: string,
  processedTree: ProcessedTree<any, any, { from: string }>,
) {
  from ||= '/'
  path ||= '/'
  const key = caseSensitive ? `case\0${from}` : from
  let tree = processedTree.singleCache.get(key)
  if (!tree) {
    // single flat routes (router.matchRoute) are not eagerly processed,
    // if we haven't seen this route before, process it now
    tree = createStaticNode<{ from: string }>('/')
    const data = new Uint16Array(6)
    parseSegments(caseSensitive, data, { from }, 1, tree, 0)
    processedTree.singleCache.set(key, tree)
  }
  return findMatch(path, tree, fuzzy)
}

type RouteMatch<T extends Extract<RouteLike, { fullPath: string }>> = {
  route: T
  rawParams: Record<string, string>
  branch: ReadonlyArray<T>
}

export function findRouteMatch<
  T extends Extract<RouteLike, { fullPath: string }>,
>(
  /** The path to match against the route tree. */
  path: string,
  /** The `processedTree` returned by the initial `processRouteTree` call. */
  processedTree: ProcessedTree<T, any, any>,
  /** If `true`, allows fuzzy matching (partial matches), i.e. which node in the tree would have been an exact match if the `path` had been shorter? */
  fuzzy = false,
): RouteMatch<T> | null {
  const key = fuzzy ? path : `nofuzz\0${path}` // the main use for `findRouteMatch` is fuzzy:true, so we optimize for that case
  const cached = processedTree.matchCache.get(key)
  if (cached !== undefined) return cached
  path ||= '/'
  let result: RouteMatch<T> | null

  try {
    result = findMatch(
      path,
      processedTree.segmentTree,
      fuzzy,
    ) as RouteMatch<T> | null
  } catch (err) {
    if (err instanceof URIError) {
      result = null
    } else {
      throw err
    }
  }

  if (result) result.branch = buildRouteBranch(result.route)
  processedTree.matchCache.set(key, result)
  return result
}

/** Trim trailing slashes (except preserving root '/'). */
export function trimPathRight(path: string) {
  return path === '/' ? path : path.replace(/\/{1,}$/, '')
}

export interface ProcessRouteTreeResult<
  TRouteLike extends Extract<RouteLike, { fullPath: string }> & { id: string },
> {
  /** Should be considered a black box, needs to be provided to all matching functions in this module. */
  processedTree: ProcessedTree<TRouteLike, any, any>
  /** A lookup map of routes by their unique IDs. */
  routesById: Record<string, TRouteLike>
  /** A lookup map of routes by their trimmed full paths. */
  routesByPath: Record<string, TRouteLike>
}

/**
 * Processes a route tree into a segment trie for efficient path matching.
 * Also builds lookup maps for routes by ID and by trimmed full path.
 */
export function processRouteTree<
  TRouteLike extends Extract<RouteLike, { fullPath: string }> & { id: string },
>(
  /** The root of the route tree to process. */
  routeTree: TRouteLike,
  /** Whether matching should be case sensitive by default (overridden by individual route options). */
  caseSensitive: boolean = false,
  /** Optional callback invoked for each route during processing. */
  initRoute?: (route: TRouteLike, index: number) => void,
): ProcessRouteTreeResult<TRouteLike> {
  const segmentTree = createStaticNode<TRouteLike>(routeTree.fullPath)
  const data = new Uint16Array(6)
  const routesById = {} as Record<string, TRouteLike>
  const routesByPath = {} as Record<string, TRouteLike>
  let index = 0
  parseSegments(caseSensitive, data, routeTree, 1, segmentTree, 0, (route) => {
    initRoute?.(route, index)

    if (route.id in routesById) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error(
          `Invariant failed: Duplicate routes found with id: ${String(route.id)}`,
        )
      }

      invariant()
    }

    routesById[route.id] = route

    if (index !== 0 && route.path) {
      const trimmedFullPath = trimPathRight(route.fullPath)
      if (!routesByPath[trimmedFullPath] || route.fullPath.endsWith('/')) {
        routesByPath[trimmedFullPath] = route
      }
    }

    index++
  })
  sortTreeNodes(segmentTree)
  const processedTree: ProcessedTree<TRouteLike, any, any> = {
    segmentTree,
    singleCache: createLRUCache<string, AnySegmentNode<any>>(1000),
    matchCache: createLRUCache<string, RouteMatch<TRouteLike> | null>(1000),
    flatCache: null,
    masksTree: null,
  }
  return {
    processedTree,
    routesById,
    routesByPath,
  }
}

function findMatch<T extends RouteLike>(
  path: string,
  segmentTree: AnySegmentNode<T>,
  fuzzy = false,
): {
  route: T
  /**
   * The raw (unparsed) params extracted from the path.
   * This will be the exhaustive list of all params defined in the route's path.
   */
  rawParams: Record<string, string>
} | null {
  const parts = path.split('/')
  const leaf = getNodeMatch(path, parts, segmentTree, fuzzy)
  if (!leaf) return null
  const [rawParams] = extractParams(path, parts, leaf)
  return {
    route: leaf.node.route!,
    rawParams,
  }
}

type ParamExtractionState = {
  part: number
  node: number
  path: number
  segment: number
}

/**
 * This function is "resumable":
 * - the `leaf` input can contain `extract` and `rawParams` properties from a previous `extractParams` call
 * - the returned `state` can be passed back as `extract` in a future call to continue extracting params from where we left off
 *
 * Inputs are *not* mutated.
 */
function extractParams<T extends RouteLike>(
  path: string,
  parts: Array<string>,
  leaf: {
    node: AnySegmentNode<T>
    skipped: number
    extract?: ParamExtractionState
    rawParams?: Record<string, string>
  },
): [rawParams: Record<string, string>, state: ParamExtractionState] {
  const list = buildBranch(leaf.node)
  let nodeParts: Array<string> | null = null
  const rawParams: Record<string, string> = Object.create(null)
  /** which segment of the path we're currently processing */
  let partIndex = leaf.extract?.part ?? 0
  /** which node of the route tree branch we're currently processing */
  let nodeIndex = leaf.extract?.node ?? 0
  /** index of the 1st character of the segment we're processing in the path string */
  let pathIndex = leaf.extract?.path ?? 0
  /** which fullPath segment we're currently processing */
  let segmentCount = leaf.extract?.segment ?? 0
  for (
    ;
    nodeIndex < list.length;
    partIndex++, nodeIndex++, pathIndex++, segmentCount++
  ) {
    const node = list[nodeIndex]!
    // index nodes are terminating nodes, nothing to extract, just leave
    if (node.kind === SEGMENT_TYPE_INDEX) break
    // pathless nodes do not consume a path segment
    if (node.kind === SEGMENT_TYPE_PATHLESS) {
      segmentCount--
      partIndex--
      pathIndex--
      continue
    }
    const part = parts[partIndex]
    const currentPathIndex = pathIndex
    if (part) pathIndex += part.length
    if (node.kind === SEGMENT_TYPE_PARAM) {
      nodeParts ??= leaf.node.fullPath.split('/')
      const nodePart = nodeParts[segmentCount]!
      const preLength = node.prefix?.length ?? 0
      // we can't rely on the presence of prefix/suffix to know whether it's curly-braced or not, because `/{$param}/` is valid, but has no prefix/suffix
      const isCurlyBraced = nodePart.charCodeAt(preLength) === 123 // '{'
      // param name is extracted at match-time so that tree nodes that are identical except for param name can share the same node
      if (isCurlyBraced) {
        const sufLength = node.suffix?.length ?? 0
        const name = nodePart.substring(
          preLength + 2,
          nodePart.length - sufLength - 1,
        )
        const value = part!.substring(preLength, part!.length - sufLength)
        rawParams[name] = decodeURIComponent(value)
      } else {
        const name = nodePart.substring(1)
        rawParams[name] = decodeURIComponent(part!)
      }
    } else if (node.kind === SEGMENT_TYPE_OPTIONAL_PARAM) {
      if (leaf.skipped & (1 << nodeIndex)) {
        partIndex-- // stay on the same part
        pathIndex = currentPathIndex - 1 // undo pathIndex advancement; -1 to account for loop increment
        continue
      }
      nodeParts ??= leaf.node.fullPath.split('/')
      const nodePart = nodeParts[segmentCount]!
      const preLength = node.prefix?.length ?? 0
      const sufLength = node.suffix?.length ?? 0
      const name = nodePart.substring(
        preLength + 3,
        nodePart.length - sufLength - 1,
      )
      const value =
        node.suffix || node.prefix
          ? part!.substring(preLength, part!.length - sufLength)
          : part
      if (value) rawParams[name] = decodeURIComponent(value)
    } else if (node.kind === SEGMENT_TYPE_WILDCARD) {
      const n = node
      const value = path.substring(
        currentPathIndex + (n.prefix?.length ?? 0),
        path.length - (n.suffix?.length ?? 0),
      )
      const splat = decodeURIComponent(value)
      // TODO: Deprecate *
      rawParams['*'] = splat
      rawParams._splat = splat
      break
    }
  }
  if (leaf.rawParams) Object.assign(rawParams, leaf.rawParams)
  return [
    rawParams,
    {
      part: partIndex,
      node: nodeIndex,
      path: pathIndex,
      segment: segmentCount,
    },
  ]
}

export function buildRouteBranch<T extends RouteLike>(route: T) {
  const list = [route]
  while (route.parentRoute) {
    route = route.parentRoute as T
    list.push(route)
  }
  list.reverse()
  return list
}

function buildBranch<T extends RouteLike>(node: AnySegmentNode<T>) {
  const list: Array<AnySegmentNode<T>> = Array(node.depth + 1)
  do {
    list[node.depth] = node
    node = node.parent!
  } while (node)
  return list
}

type MatchStackFrame<T extends RouteLike> = {
  node: AnySegmentNode<T>
  /** index of the segment of path */
  index: number
  /** how many nodes between `node` and the root of the segment tree */
  depth: number
  /**
   * Bitmask of skipped optional segments.
   *
   * This is a very performant way of storing an "array of booleans", but it means beyond 32 segments we can't track skipped optionals.
   * If we really really need to support more than 32 segments we can switch to using a `BigInt` here. It's about 2x slower in worst case scenarios.
   */
  skipped: number
  /** Positional bitmasks tracking which consumed URL segments matched each segment kind. */
  statics: number
  dynamics: number
  optionals: number
  /** intermediary state for param extraction */
  extract?: ParamExtractionState
  /** intermediary params from param extraction */
  rawParams?: Record<string, string>
}

function getNodeMatch<T extends RouteLike>(
  path: string,
  parts: Array<string>,
  segmentTree: AnySegmentNode<T>,
  fuzzy: boolean,
) {
  // quick check for root index
  // this is an optimization, algorithm should work correctly without this block
  if (path === '/' && segmentTree.index)
    return { node: segmentTree.index, skipped: 0 } as Pick<
      Frame,
      'node' | 'skipped'
    >

  const trailingSlash = !last(parts)
  const pathIsIndex = trailingSlash && path !== '/'
  const partsLength = parts.length - (trailingSlash ? 1 : 0)

  type Frame = MatchStackFrame<T>

  // use a stack to explore all possible paths (params cause branching)
  // iterate "backwards" (low priority first) so that we can push() each candidate, and pop() the highest priority candidate first
  // - pros: it is depth-first, so we find full matches faster
  // - cons: we cannot short-circuit, because highest priority matches are at the end of the loop (for loop with i--) (but we have no good short-circuiting anyway)
  // other possible approaches:
  // - shift instead of pop (measure performance difference), this allows iterating "forwards" (effectively breadth-first)
  // - never remove from the stack, keep a cursor instead. Then we can push "forwards" and avoid reversing the order of candidates (effectively breadth-first)
  const stack: Array<Frame> = [
    {
      node: segmentTree,
      index: 1,
      skipped: 0,
      depth: 1,
      statics: 0,
      dynamics: 0,
      optionals: 0,
    },
  ]

  let bestFuzzy: Frame | null = null
  let bestMatch: Frame | null = null

  while (stack.length) {
    const frame = stack.pop()!
    const { node, index, skipped, depth, statics, dynamics, optionals } = frame
    let { extract, rawParams } = frame

    // Wildcard candidates are pushed speculatively as fallbacks in case a
    // higher-priority wildcard later fails params.parse. If a better wildcard
    // has already validated and become bestMatch, lower-priority wildcard
    // fallbacks cannot win anymore and should not run params.parse.
    if (
      node.kind === SEGMENT_TYPE_WILDCARD &&
      node.route &&
      !isFrameMoreSpecific(bestMatch, frame)
    ) {
      continue
    }

    if (node.parse) {
      const result = validateParseParams(path, parts, frame)
      if (!result) continue
      rawParams = frame.rawParams
      extract = frame.extract
    }

    // In fuzzy mode, track the best partial match we've found so far
    if (
      fuzzy &&
      node.route &&
      node.kind !== SEGMENT_TYPE_INDEX &&
      isFrameMoreSpecific(bestFuzzy, frame)
    ) {
      bestFuzzy = frame
    }

    const isBeyondPath = index === partsLength
    if (isBeyondPath) {
      if (
        node.route &&
        (!pathIsIndex ||
          node.kind === SEGMENT_TYPE_INDEX ||
          node.kind === SEGMENT_TYPE_WILDCARD) &&
        isFrameMoreSpecific(bestMatch, frame)
      ) {
        bestMatch = frame
      }
      // beyond the length of the path parts, only some segment types can match
      if (!node.optional && !node.wildcard && !node.index && !node.pathless)
        continue
    }

    const part = isBeyondPath ? undefined : parts[index]!
    let lowerPart: string

    // 0. Try index match
    if (isBeyondPath && node.index) {
      const indexFrame = {
        node: node.index,
        index,
        skipped,
        depth: depth + 1,
        statics,
        dynamics,
        optionals,
        extract,
        rawParams,
      }
      let indexValid = true
      if (node.index.parse) {
        const result = validateParseParams(path, parts, indexFrame)
        if (!result) indexValid = false
      }
      if (indexValid) {
        // perfect match, no need to continue
        // this is an optimization, algorithm should work correctly without this block
        if (
          !dynamics &&
          !optionals &&
          !skipped &&
          isPerfectStaticMatch(statics, partsLength)
        ) {
          return indexFrame
        }
        if (isFrameMoreSpecific(bestMatch, indexFrame)) {
          // index matches skip the stack because they cannot have children
          bestMatch = indexFrame
        }
      }
    }

    // 5. Try wildcard match
    if (node.wildcard) {
      for (let i = node.wildcard.length - 1; i >= 0; i--) {
        const segment = node.wildcard[i]!
        const { prefix, suffix } = segment
        if (prefix) {
          if (isBeyondPath) continue
          const casePart = segment.caseSensitive
            ? part
            : (lowerPart ??= part!.toLowerCase())
          if (!casePart!.startsWith(prefix)) continue
        }
        if (suffix) {
          if (isBeyondPath) continue
          const end = parts.slice(index).join('/').slice(-suffix.length)
          const casePart = segment.caseSensitive ? end : end.toLowerCase()
          if (casePart !== suffix) continue
        }
        // wildcard matches consume the rest of the URL and cannot have children
        stack.push({
          node: segment,
          index: partsLength,
          skipped,
          depth: depth + 1,
          statics,
          dynamics,
          optionals,
          extract,
          rawParams,
        })
      }
    }

    // 4. Try optional match
    if (node.optional) {
      const nextSkipped = skipped | (1 << depth)
      const nextDepth = depth + 1
      for (let i = node.optional.length - 1; i >= 0; i--) {
        const segment = node.optional[i]!
        // when skipping, node and depth advance by 1, but index doesn't
        stack.push({
          node: segment,
          index,
          skipped: nextSkipped,
          depth: nextDepth,
          statics,
          dynamics,
          optionals,
          extract,
          rawParams,
        }) // enqueue skipping the optional
      }
      if (!isBeyondPath) {
        for (let i = node.optional.length - 1; i >= 0; i--) {
          const segment = node.optional[i]!
          const { prefix, suffix } = segment
          if (prefix || suffix) {
            const casePart = segment.caseSensitive
              ? part!
              : (lowerPart ??= part!.toLowerCase())
            if (prefix && !casePart.startsWith(prefix)) continue
            if (suffix && !casePart.endsWith(suffix)) continue
          }
          stack.push({
            node: segment,
            index: index + 1,
            skipped,
            depth: nextDepth,
            statics,
            dynamics,
            optionals: optionals + segmentScore(partsLength, index),
            extract,
            rawParams,
          })
        }
      }
    }

    // 3. Try dynamic match
    if (!isBeyondPath && node.dynamic && part) {
      for (let i = node.dynamic.length - 1; i >= 0; i--) {
        const segment = node.dynamic[i]!
        const { prefix, suffix } = segment
        if (prefix || suffix) {
          const casePart = segment.caseSensitive
            ? part
            : (lowerPart ??= part.toLowerCase())
          if (prefix && !casePart.startsWith(prefix)) continue
          if (suffix && !casePart.endsWith(suffix)) continue
        }
        stack.push({
          node: segment,
          index: index + 1,
          skipped,
          depth: depth + 1,
          statics,
          dynamics: dynamics + segmentScore(partsLength, index),
          optionals,
          extract,
          rawParams,
        })
      }
    }

    // 2. Try case insensitive static match
    if (!isBeyondPath && node.staticInsensitive) {
      const match = node.staticInsensitive.get(
        (lowerPart ??= part!.toLowerCase()),
      )
      if (match) {
        stack.push({
          node: match,
          index: index + 1,
          skipped,
          depth: depth + 1,
          statics: statics + segmentScore(partsLength, index),
          dynamics,
          optionals,
          extract,
          rawParams,
        })
      }
    }

    // 1. Try static match
    if (!isBeyondPath && node.static) {
      const match = node.static.get(part!)
      if (match) {
        stack.push({
          node: match,
          index: index + 1,
          skipped,
          depth: depth + 1,
          statics: statics + segmentScore(partsLength, index),
          dynamics,
          optionals,
          extract,
          rawParams,
        })
      }
    }

    // 0. Try pathless match
    if (node.pathless) {
      const nextDepth = depth + 1
      for (let i = node.pathless.length - 1; i >= 0; i--) {
        const segment = node.pathless[i]!
        stack.push({
          node: segment,
          index,
          skipped,
          depth: nextDepth,
          statics,
          dynamics,
          optionals,
          extract,
          rawParams,
        })
      }
    }
  }

  if (bestMatch) return bestMatch

  if (fuzzy && bestFuzzy) {
    let sliceIndex = bestFuzzy.index
    for (let i = 0; i < bestFuzzy.index; i++) {
      sliceIndex += parts[i]!.length
    }
    const splat = sliceIndex === path.length ? '/' : path.slice(sliceIndex)
    bestFuzzy.rawParams ??= Object.create(null)
    bestFuzzy.rawParams!['**'] = decodeURIComponent(splat)
    return bestFuzzy
  }

  return null
}

function segmentScore(partsLength: number, index: number): number {
  // The specificity scores are bitmasks over consumed URL segments. Earlier
  // URL segments should dominate later ones when comparing scores, so the
  // first real segment gets the highest bit and the last gets bit 0. Since
  // `parts[0]` is the empty string before the leading slash, real URL segments
  // are [1, partsLength), making this segment's bit `partsLength - index - 1`.
  return 2 ** (partsLength - index - 1)
}

function isPerfectStaticMatch(statics: number, partsLength: number): boolean {
  return statics === 2 ** (partsLength - 1) - 1
}

function validateParseParams<T extends RouteLike>(
  path: string,
  parts: Array<string>,
  frame: MatchStackFrame<T>,
) {
  let rawParams: Record<string, string>
  let state: ParamExtractionState

  try {
    ;[rawParams, state] = extractParams(path, parts, frame)
  } catch {
    return null
  }

  frame.rawParams = rawParams
  frame.extract = state

  if (!frame.node.parse) return true

  try {
    if (frame.node.parse(rawParams) === false) return null
  } catch {
    // Thrown parse errors should be surfaced on the selected match by
    // extractStrictParams, not used as fallback route selection.
  }

  return true
}

function isFrameMoreSpecific(
  // the stack frame previously saved as "best match"
  prev: MatchStackFrame<any> | null,
  // the candidate stack frame
  next: MatchStackFrame<any>,
): boolean {
  if (!prev) return true
  return (
    next.statics > prev.statics ||
    (next.statics === prev.statics &&
      (next.dynamics > prev.dynamics ||
        (next.dynamics === prev.dynamics &&
          (next.optionals > prev.optionals ||
            (next.optionals === prev.optionals &&
              ((next.node.kind === SEGMENT_TYPE_INDEX) >
                (prev.node.kind === SEGMENT_TYPE_INDEX) ||
                ((next.node.kind === SEGMENT_TYPE_INDEX) ===
                  (prev.node.kind === SEGMENT_TYPE_INDEX) &&
                  next.depth > prev.depth)))))))
  )
}

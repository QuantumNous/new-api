export type RoutePathSegmentMetadata = {
  literalLeadingUnderscore?: boolean
  literalTrailingUnderscore?: boolean
}

export type RouteNode = {
  filePath: string
  fullPath: string
  variableName: string
  _fsRouteType: FsRouteType
  routePath?: string
  originalRoutePath?: string
  cleanedPath?: string
  path?: string
  isNonPath?: boolean
  isVirtualParentRoute?: boolean
  isVirtual?: boolean
  children?: Array<RouteNode>
  parent?: RouteNode
  createFileRouteProps?: Set<string>
  /**
   * For virtual routes: the routePath of the explicit parent from virtual config.
   * Used to prevent auto-nesting siblings based on path prefix matching (#5822, #5431).
   * Falls back to path-based inference if the explicit parent is not found
   * (e.g., when the parent is a virtual file-less route that gets filtered out).
   */
  _virtualParentRoutePath?: string
  /** Internal routePath segment metadata for escaped or explicit literal syntax. */
  _routePathSegmentMetadata?: Array<RoutePathSegmentMetadata | undefined>
}

export interface GetRouteNodesResult {
  rootRouteNode?: RouteNode
  routeNodes: Array<RouteNode>
  physicalDirectories: Array<string>
}

export type FsRouteType =
  | '__root'
  | 'static'
  | 'layout'
  | 'pathless_layout'
  | 'lazy'
  | 'loader' // @deprecated
  | 'component' // @deprecated
  | 'pendingComponent' // @deprecated
  | 'errorComponent' // @deprecated
  | 'notFoundComponent' // @deprecated

export type RouteSubNode = {
  component?: RouteNode
  errorComponent?: RouteNode
  notFoundComponent?: RouteNode
  pendingComponent?: RouteNode
  loader?: RouteNode
  lazy?: RouteNode
}

export type ImportSpecifier = {
  imported: string
  local?: string
}
export type ImportDeclaration = {
  source: string
  specifiers: Array<ImportSpecifier>
  importKind?: 'type' | 'value'
}

export type HandleNodeAccumulator = {
  routeTree: Array<RouteNode>
  routePiecesByPath: Record<string, RouteSubNode>
  routeNodes: Array<RouteNode>
  /** O(1) lookup by routePath - avoids O(n) .find() on every node */
  routeNodesByPath: Map<string, RouteNode>
}

export type GetRoutesByFileMapResultValue = { routeId: string }
export type GetRoutesByFileMapResult = Map<
  string,
  GetRoutesByFileMapResultValue
>

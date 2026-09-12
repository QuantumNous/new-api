import type {
  ComponentInfo,
  RenderEdge,
  RenderGraph,
} from './render-graph-builder'

export type ClientReason =
  | { type: 'use-client'; fileName: string }
  | {
      type: 'route-option'
      fileName: string
      usageFile?: string
      usageNode?: unknown
      usageLine?: number
    }
  | { type: 'rendered-by-client'; parentComponent: string; parentFile: string }

export interface ComponentContext {
  key: string
  component: ComponentInfo
  isServerContext: boolean
  isClientContext: boolean
  clientReason?: ClientReason
}

export interface ContextAnalysisResult {
  /** Map of component key -> context info */
  contexts: Map<string, ComponentContext>
  /** Edges where caller is in client context (for usage-site reporting) */
  clientEdges: Array<RenderEdge>
}

/**
 * Analyzes the render graph to propagate server/client context.
 *
 * Algorithm:
 * 1. Mark server roots as server context, propagate to descendants
 * 2. Stop propagation at 'use client' boundaries
 * 3. Mark client roots as client context, propagate to descendants
 * 4. Components reachable from both => client wins (tainted)

 */
export function analyzeContext(graph: RenderGraph): ContextAnalysisResult {
  const contexts = new Map<string, ComponentContext>()

  // Initialize all components with unknown context
  for (const [key, component] of graph.components) {
    contexts.set(key, {
      key,
      component,
      isServerContext: false,
      isClientContext: false,
    })
  }

  // Build adjacency list for efficient traversal
  const adjacency = buildAdjacencyList(graph.edges)

  // Phase 1: Propagate server context from server roots
  const serverVisited = new Set<string>()
  for (const serverRoot of graph.serverRoots) {
    propagateServerContext(
      serverRoot,
      serverVisited,
      graph,
      contexts,
      adjacency,
    )
  }

  // Phase 2: Propagate client context from client roots
  const clientVisited = new Set<string>()
  for (const clientRoot of graph.clientRoots) {
    const ctx = contexts.get(clientRoot)
    if (!ctx) continue

    let reason: ClientReason
    if (graph.useClientFiles.has(ctx.component.fileName)) {
      reason = { type: 'use-client', fileName: ctx.component.fileName }
    } else {
      const routeUsage = graph.routeOptionUsages.get(clientRoot)
      reason = {
        type: 'route-option',
        fileName: ctx.component.fileName,
        usageFile: routeUsage?.fileName,
        usageNode: routeUsage?.usageNode,
        usageLine: routeUsage?.usageLine,
      }
    }

    propagateClientContext(
      clientRoot,
      clientVisited,
      contexts,
      adjacency,
      reason,
    )
  }

  // Phase 3: Components in 'use client' files are always client
  for (const [_key, ctx] of contexts) {
    if (
      graph.useClientFiles.has(ctx.component.fileName) &&
      !ctx.isClientContext
    ) {
      ctx.isClientContext = true
      ctx.clientReason = {
        type: 'use-client',
        fileName: ctx.component.fileName,
      }
    }
  }

  // Collect edges where caller is in client context
  const clientEdges: Array<RenderEdge> = []
  for (const edge of graph.edges) {
    const fromKey = `${edge.fromFile}:${edge.fromComponent}`
    const fromCtx = contexts.get(fromKey)
    if (fromCtx?.isClientContext) {
      clientEdges.push(edge)
    }
  }

  return { contexts, clientEdges }
}

function buildAdjacencyList(
  edges: Array<RenderEdge>,
): Map<string, Array<RenderEdge>> {
  const adj = new Map<string, Array<RenderEdge>>()
  for (const edge of edges) {
    const fromKey = `${edge.fromFile}:${edge.fromComponent}`
    if (!adj.has(fromKey)) {
      adj.set(fromKey, [])
    }
    adj.get(fromKey)!.push(edge)
  }
  return adj
}

function propagateServerContext(
  key: string,
  visited: Set<string>,
  graph: RenderGraph,
  contexts: Map<string, ComponentContext>,
  adjacency: Map<string, Array<RenderEdge>>,
): void {
  if (visited.has(key)) return
  visited.add(key)

  const ctx = contexts.get(key)
  if (!ctx) return

  // Stop at 'use client' boundary
  if (graph.useClientFiles.has(ctx.component.fileName)) {
    ctx.isClientContext = true
    ctx.clientReason = { type: 'use-client', fileName: ctx.component.fileName }
    return
  }

  ctx.isServerContext = true

  // Propagate to children
  const edges = adjacency.get(key) ?? []
  for (const edge of edges) {
    propagateServerContext(
      edge.toComponentKey,
      visited,
      graph,
      contexts,
      adjacency,
    )
  }
}

function propagateClientContext(
  key: string,
  visited: Set<string>,
  contexts: Map<string, ComponentContext>,
  adjacency: Map<string, Array<RenderEdge>>,
  reason: ClientReason,
): void {
  if (visited.has(key)) return
  visited.add(key)

  const ctx = contexts.get(key)
  if (!ctx) return

  ctx.isClientContext = true
  if (!ctx.clientReason) {
    ctx.clientReason = reason
  }

  // Propagate to children
  const edges = adjacency.get(key) ?? []
  for (const edge of edges) {
    propagateClientContext(edge.toComponentKey, visited, contexts, adjacency, {
      type: 'rendered-by-client',
      parentComponent: ctx.component.name,
      parentFile: ctx.component.fileName,
    })
  }
}

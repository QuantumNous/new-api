import { SERVER_PROP } from './constants'
import type {
  HandleNodeAccumulator,
  RouteNode,
} from '@tanstack/router-generator'

export function pruneServerOnlySubtrees({
  rootRouteNode,
  acc,
}: {
  rootRouteNode: RouteNode
  acc: HandleNodeAccumulator
}) {
  const routeNodes: Array<RouteNode> = []
  const routeTree =
    prune({ ...rootRouteNode, children: acc.routeTree }, routeNodes)
      ?.children || []
  // remove root node from routeNodes
  routeNodes.pop()
  return {
    routeTree,
    routeNodes,
  }
}
function prune(
  node: RouteNode,
  collectedRouteNodes: Array<RouteNode>,
): RouteNode | null {
  const newChildren: Array<RouteNode> = []
  let allChildrenServerOnly = true

  for (const child of node.children || []) {
    const newChild = prune(child, collectedRouteNodes)
    if (newChild) {
      newChildren.push(newChild)
      // at least one child survived pruning
      allChildrenServerOnly = false
    }
  }

  const allServerOnly =
    node.createFileRouteProps?.has(SERVER_PROP) &&
    node.createFileRouteProps.size === 1 &&
    allChildrenServerOnly
  // prune this subtree
  if (allServerOnly) {
    return null
  }
  collectedRouteNodes.push(node)
  return { ...node, children: newChildren }
}

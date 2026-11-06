import type { HandleNodeAccumulator, RouteNode } from '../types'
import type { Generator } from '../generator'

export interface GeneratorPlugin {
  name: string
  init?: (opts: { generator: Generator }) => void
  onRouteTreeChanged?: (opts: {
    routeTree: Array<RouteNode>
    routeNodes: Array<RouteNode>
    rootRouteNode: RouteNode
    acc: HandleNodeAccumulator
  }) => void

  afterTransform?: (opts: {
    node: RouteNode
    prevNode: RouteNode | undefined
  }) => void
}

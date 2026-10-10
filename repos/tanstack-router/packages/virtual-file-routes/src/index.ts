export { rootRoute, index, route, layout, physical } from './api'
export type {
  LayoutRoute,
  Route,
  IndexRoute,
  PhysicalSubtree,
  VirtualRootRoute,
  VirtualRouteNode,
} from './types'

export { defineVirtualSubtreeConfig } from './defineConfig'
export type {
  ConfigExport,
  ConfigFn,
  ConfigFnObject,
  ConfigFnPromise,
  VirtualRouteSubtreeConfig,
} from './defineConfig'

/**
 * Route option names that accept component references.
 * These make the referenced component a "client root".
 */
export const ROUTE_COMPONENT_OPTION_NAMES = [
  'component',
  'pendingComponent',
  'errorComponent',
  'notFoundComponent',
] as const

/**
 * Function names that create routes (client entry points).
 */
export const ROUTE_CREATOR_NAMES = [
  'createFileRoute',
  'createRootRoute',
  'createRootRouteWithContext',
] as const

/**
 * Function names that create server-component roots.
 */
export const SERVER_COMPONENT_ROOTS = [
  'renderServerComponent',
  'createCompositeComponent',
] as const

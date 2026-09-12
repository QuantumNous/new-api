import { inferFullPath } from '@tanstack/router-generator'
import type { GeneratorPlugin, RouteNode } from '@tanstack/router-generator'

/**
 * this plugin gets the prerenderable paths and stores it on globalThis
 * so that it can be accessed later (e.g. from a vite plugin)
 */
export function prerenderRoutesPlugin(): GeneratorPlugin {
  return {
    name: 'prerender-routes-plugin',
    onRouteTreeChanged: ({ routeNodes }) => {
      globalThis.TSS_PRERENDABLE_PATHS = getPrerenderablePaths(routeNodes)
    },
  }
}

function getPrerenderablePaths(
  routeNodes: Array<RouteNode>,
): Array<{ path: string }> {
  const paths = new Set<string>(['/'])

  for (const route of routeNodes) {
    if (!route.routePath) continue
    // filter routes that are layout
    if (route.isNonPath === true) continue

    // filter dynamic routes
    // if routePath contains $ it is dynamic
    if (route.routePath.includes('$')) continue

    // filter routes that do not have a component, i.e api routes
    if (!route.createFileRouteProps?.has('component')) continue

    paths.add(inferFullPath(route))
  }

  return Array.from(paths).map((path) => ({ path }))
}

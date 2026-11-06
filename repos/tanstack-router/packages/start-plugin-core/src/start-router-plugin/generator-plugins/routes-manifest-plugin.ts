import { rootRouteId } from '@tanstack/router-core'

import type { GeneratorPlugin } from '@tanstack/router-generator'

/**
 * this plugin builds the routes manifest and stores it on globalThis
 * so that it can be accessed later (e.g. from a vite plugin)
 */
export function routesManifestPlugin(): GeneratorPlugin {
  return {
    name: 'routes-manifest-plugin',
    onRouteTreeChanged: ({ routeTree, rootRouteNode, routeNodes }) => {
      const allChildren = routeTree.map((d) => d.routePath)
      const routes: Record<
        string,
        {
          filePath: string
          children: Array<string>
        }
      > = {
        [rootRouteId]: {
          filePath: rootRouteNode.fullPath,
          children: allChildren,
        },
        ...Object.fromEntries(
          routeNodes.map((d) => {
            const filePathId = d.routePath

            return [
              filePathId,
              {
                filePath: d.fullPath,
                children: d.children?.map((childRoute) => childRoute.routePath),
              },
            ]
          }),
        ),
      }

      globalThis.TSS_ROUTES_MANIFEST = routes
    },
  }
}

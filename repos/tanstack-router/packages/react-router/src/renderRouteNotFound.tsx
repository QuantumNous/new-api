import * as React from 'react'
import { DefaultGlobalNotFound } from './not-found'
import type { AnyRoute, AnyRouter } from '@tanstack/router-core'

/**
 * Renders a not found component for a route when no matching route is found.
 *
 * @param router - The router instance containing the route configuration
 * @param route - The route that triggered the not found state
 * @param data - Additional data to pass to the not found component
 * @returns The rendered not found component or a default fallback component
 */
export function renderRouteNotFound(
  router: AnyRouter,
  route: AnyRoute,
  data: any,
) {
  if (!route.options.notFoundComponent) {
    if (router.options.defaultNotFoundComponent) {
      return <router.options.defaultNotFoundComponent {...data} />
    }

    if (process.env.NODE_ENV !== 'production') {
      if (!route.options.notFoundComponent) {
        console.warn(
          `Warning: A notFoundError was encountered on the route with ID "${route.id}", but a notFoundComponent option was not configured, nor was a router level defaultNotFoundComponent configured. Consider configuring at least one of these to avoid TanStack Router's overly generic defaultNotFoundComponent (<p>Not Found</p>)`,
        )
      }
    }

    return <DefaultGlobalNotFound />
  }

  return <route.options.notFoundComponent {...data} />
}

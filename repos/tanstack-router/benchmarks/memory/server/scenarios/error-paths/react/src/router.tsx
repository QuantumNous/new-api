import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: false,
    scrollRestoration: false,
    defaultNotFoundComponent: DefaultNotFound,
  })
}

// Without this, every unmatched-URL request logs a router warning in
// non-production ad-hoc runs.
function DefaultNotFound() {
  return <p data-bench="error-paths-unmatched">error-paths-unmatched</p>
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

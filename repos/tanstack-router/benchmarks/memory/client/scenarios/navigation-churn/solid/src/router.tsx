import { createMemoryHistory, createRouter } from '@tanstack/solid-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    history: createMemoryHistory({
      initialEntries: ['/a'],
    }),
    routeTree,
  })
}

declare module '@tanstack/solid-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

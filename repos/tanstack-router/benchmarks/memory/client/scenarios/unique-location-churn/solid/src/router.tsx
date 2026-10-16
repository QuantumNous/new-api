import { createMemoryHistory, createRouter } from '@tanstack/solid-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    history: createMemoryHistory({
      initialEntries: ['/items/initial?q=q-initial'],
    }),
    routeTree,
  })
}

declare module '@tanstack/solid-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

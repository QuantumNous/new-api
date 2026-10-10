import { createMemoryHistory, createRouter } from '@tanstack/vue-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    history: createMemoryHistory({
      initialEntries: ['/'],
    }),
    routeTree,
  })
}

declare module '@tanstack/vue-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

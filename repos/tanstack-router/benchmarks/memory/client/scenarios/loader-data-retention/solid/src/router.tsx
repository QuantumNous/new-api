import { createMemoryHistory, createRouter } from '@tanstack/solid-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    history: createMemoryHistory({
      initialEntries: ['/shell'],
    }),
    routeTree,
    defaultGcTime: 0,
    defaultPreloadGcTime: 0,
  })
}

declare module '@tanstack/solid-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

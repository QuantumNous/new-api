import { createLazyFileRoute, createLazyRoute } from '../../src'

export function Route(id: string) {
  return createLazyRoute(id)({
    component: () => <h1 data-testid="lazy-route-page">I'm a normal route</h1>,
  })
}

export function FileRoute(id: string) {
  return createLazyFileRoute(id as never)({
    component: () => <h1>I'm a normal file route</h1>,
  })
}

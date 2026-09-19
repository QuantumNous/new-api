import { RouterProvider } from '@tanstack/solid-router'
import type { AnyRouter } from '@tanstack/router-core'

export function StartServer<TRouter extends AnyRouter>(props: {
  router: TRouter
}) {
  return <RouterProvider router={props.router} />
}

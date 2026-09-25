import { RouterProvider } from '@tanstack/solid-router'
import type { AnyRouter } from '@tanstack/router-core'

export function StartClient(props: { router: AnyRouter }) {
  return <RouterProvider router={props.router} />
}

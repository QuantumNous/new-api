import { hydrate } from '@tanstack/router-core/ssr/client'
import { Await } from '../awaited'
import { RouterProvider } from '../RouterProvider'
import type { AnyRouter } from '@tanstack/router-core'

let hydrationPromise: Promise<void | Array<Array<void>>> | undefined

export function RouterClient(props: { router: AnyRouter }) {
  if (!hydrationPromise) {
    if (!props.router.stores.matchesId.get().length) {
      hydrationPromise = hydrate(props.router)
    } else {
      hydrationPromise = Promise.resolve()
    }
  }
  return (
    <Await
      promise={hydrationPromise}
      children={() => <RouterProvider router={props.router} />}
    />
  )
}

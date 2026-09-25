import { RouterProvider } from '@tanstack/solid-router'
import { render } from 'solid-js/web'
import { getRouter } from './router'

export { getTrackedItemLoaderCount } from '../../item-payload'

export function mountTestApp(container: Element) {
  const router = getRouter()
  const dispose = render(() => <RouterProvider router={router} />, container)
  let didUnmount = false

  // Full teardown mirrors the mount-unmount scenario: guard double-unmounts,
  // release the devtools global, and detach history listeners.
  return {
    router,
    unmount() {
      if (didUnmount) {
        return
      }

      didUnmount = true
      dispose()

      if (typeof self !== 'undefined' && self.__TSR_ROUTER__ === router) {
        self.__TSR_ROUTER__ = undefined
      }

      router.history.destroy()
    },
  }
}

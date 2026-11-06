import { RouterProvider } from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'
import { getRouter } from './router'

export { getTrackedItemLoaderCount } from '../../item-payload'

export function mountTestApp(container: Element) {
  const router = getRouter()
  const reactRoot = createRoot(container)
  let didUnmount = false

  reactRoot.render(<RouterProvider router={router} />)

  // Full teardown mirrors the mount-unmount scenario: guard double-unmounts,
  // release the devtools global, and detach history listeners.
  return {
    router,
    unmount() {
      if (didUnmount) {
        return
      }

      didUnmount = true
      reactRoot.unmount()

      if (typeof self !== 'undefined' && self.__TSR_ROUTER__ === router) {
        self.__TSR_ROUTER__ = undefined
      }

      router.history.destroy()
    },
  }
}

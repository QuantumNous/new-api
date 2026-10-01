import { RouterProvider } from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'
import { getRouter } from './router'

export function mountTestApp(container: Element) {
  const router = getRouter()
  const reactRoot = createRoot(container)
  let didUnmount = false

  reactRoot.render(<RouterProvider router={router} />)

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

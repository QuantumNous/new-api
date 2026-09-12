import { RouterProvider } from '@tanstack/vue-router'
import { createApp } from 'vue'
import { getRouter } from './router'
import type {} from '@tanstack/router-core'

export { getTrackedItemLoaderCount } from '../../item-payload'

export function mountTestApp(container: Element) {
  const router = getRouter()
  const vueApp = createApp({
    setup() {
      return () => <RouterProvider router={router} />
    },
  })
  let didUnmount = false

  vueApp.mount(container)

  // Full teardown mirrors the mount-unmount scenario: guard double-unmounts,
  // release the devtools global, and detach history listeners.
  return {
    router,
    unmount() {
      if (didUnmount) {
        return
      }

      didUnmount = true
      vueApp.unmount()

      if (typeof self !== 'undefined' && self.__TSR_ROUTER__ === router) {
        self.__TSR_ROUTER__ = undefined
      }

      router.history.destroy()
    },
  }
}

import * as Solid from 'solid-js'
import { routerContext } from './routerContext'
import type { AnyRouter, RegisteredRouter } from '@tanstack/router-core'

export function useRouter<TRouter extends AnyRouter = RegisteredRouter>(opts?: {
  warn?: boolean
}): TRouter {
  const value = Solid.useContext(routerContext)
  if (process.env.NODE_ENV !== 'production') {
    if ((opts?.warn ?? true) && !value) {
      console.warn(
        'Warning: useRouter must be used inside a <RouterProvider> component!',
      )
    }
  }
  return value as TRouter
}

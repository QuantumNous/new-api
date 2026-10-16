'use client'

import * as React from 'react'
import { routerContext } from './routerContext'
import type { AnyRouter, RegisteredRouter } from '@tanstack/router-core'

/**
 * Access the current TanStack Router instance from React context.
 * Must be used within a `RouterProvider`.
 *
 * Options:
 * - `warn`: Log a warning if no router context is found (default: true).
 *
 * @returns The registered router instance.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/useRouterHook
 */
export function useRouter<TRouter extends AnyRouter = RegisteredRouter>(opts?: {
  warn?: boolean
}): TRouter {
  const value = React.useContext(routerContext)
  if (process.env.NODE_ENV !== 'production') {
    if ((opts?.warn ?? true) && !value) {
      console.warn(
        'Warning: useRouter must be used inside a <RouterProvider> component!',
      )
    }
  }
  return value as any
}

'use client'

import * as React from 'react'
import { hasKeys } from '@tanstack/router-core'
import { Matches } from './Matches'
import { routerContext } from './routerContext'
import type {
  AnyRouter,
  RegisteredRouter,
  RouterOptions,
} from '@tanstack/router-core'

/**
 * Low-level provider that places the router into React context and optionally
 * updates router options from props. Most apps should use `RouterProvider`.
 */
export function RouterContextProvider<
  TRouter extends AnyRouter = RegisteredRouter,
  TDehydrated extends Record<string, any> = Record<string, any>,
>({
  router,
  children,
  ...rest
}: RouterProps<TRouter, TDehydrated> & {
  children: React.ReactNode
}) {
  if (hasKeys(rest)) {
    // Allow the router to update options on the router instance
    router.update({
      ...router.options,
      ...rest,
      context: {
        ...router.options.context,
        ...rest.context,
      },
    })
  }

  const provider = (
    <routerContext.Provider value={router as AnyRouter}>
      {children}
    </routerContext.Provider>
  )

  if (router.options.Wrap) {
    return <router.options.Wrap>{provider}</router.options.Wrap>
  }

  return provider
}

/**
 * Top-level component that renders the active route matches and provides the
 * router to the React tree via context.
 *
 * Accepts the same options as `createRouter` via props to update the router
 * instance after creation.
 *
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/createRouterFunction
 */
export function RouterProvider<
  TRouter extends AnyRouter = RegisteredRouter,
  TDehydrated extends Record<string, any> = Record<string, any>,
>({ router, ...rest }: RouterProps<TRouter, TDehydrated>) {
  return (
    <RouterContextProvider router={router} {...rest}>
      <Matches />
    </RouterContextProvider>
  )
}

export type RouterProps<
  TRouter extends AnyRouter = RegisteredRouter,
  TDehydrated extends Record<string, any> = Record<string, any>,
> = Omit<
  RouterOptions<
    TRouter['routeTree'],
    NonNullable<TRouter['options']['trailingSlash']>,
    NonNullable<TRouter['options']['defaultStructuralSharing']>,
    TRouter['history'],
    TDehydrated
  >,
  'context'
> & {
  router: TRouter
  context?: Partial<
    RouterOptions<
      TRouter['routeTree'],
      NonNullable<TRouter['options']['trailingSlash']>,
      NonNullable<TRouter['options']['defaultStructuralSharing']>,
      TRouter['history'],
      TDehydrated
    >['context']
  >
}

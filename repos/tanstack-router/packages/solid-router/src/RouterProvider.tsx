import { routerContext } from './routerContext'
import { SafeFragment } from './SafeFragment'
import { Matches } from './Matches'
import type {
  AnyRouter,
  RegisteredRouter,
  RouterOptions,
} from '@tanstack/router-core'
import type * as Solid from 'solid-js'

export function RouterContextProvider<
  TRouter extends AnyRouter = RegisteredRouter,
  TDehydrated extends Record<string, any> = Record<string, any>,
>({
  router,
  children,
  ...rest
}: RouterProps<TRouter, TDehydrated> & {
  children: () => Solid.JSX.Element
}) {
  // Allow the router to update options on the router instance
  router.update({
    ...router.options,
    ...rest,
    context: {
      ...router.options.context,
      ...rest.context,
    },
  })

  const OptionalWrapper = router.options.Wrap || SafeFragment

  return (
    <OptionalWrapper>
      <routerContext.Provider value={router as AnyRouter}>
        {children()}
      </routerContext.Provider>
    </OptionalWrapper>
  )
}

export function RouterProvider<
  TRouter extends AnyRouter = RegisteredRouter,
  TDehydrated extends Record<string, any> = Record<string, any>,
>({ router, ...rest }: RouterProps<TRouter, TDehydrated>) {
  return (
    <RouterContextProvider router={router} {...rest}>
      {() => <Matches />}
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
    false,
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
      false,
      TRouter['history'],
      TDehydrated
    >['context']
  >
}

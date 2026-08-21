import * as Vue from 'vue'
import { isServer } from '@tanstack/router-core/isServer'
import { useStore } from '@tanstack/vue-store'
import { CatchBoundary } from './CatchBoundary'
import { useRouter } from './useRouter'
import { useTransitionerSetup } from './Transitioner'
import { matchContext } from './matchContext'
import { Match } from './Match'
import type {
  AnyRouter,
  DeepPartial,
  ErrorComponentProps,
  MakeOptionalPathParams,
  MakeOptionalSearchParams,
  MakeRouteMatchUnion,
  MaskOptions,
  MatchRouteOptions,
  RegisteredRouter,
  ResolveRoute,
  ToSubOptionsProps,
} from '@tanstack/router-core'

// Define a type for the error component function
type ErrorRouteComponentType = (props: ErrorComponentProps) => Vue.VNode

declare module '@tanstack/router-core' {
  export interface RouteMatchExtensions {
    meta?: Array<Vue.ComponentOptions['meta'] | undefined>
    links?: Array<Vue.ComponentOptions['link'] | undefined>
    scripts?: Array<Vue.ComponentOptions['script'] | undefined>
    headScripts?: Array<Vue.ComponentOptions['script'] | undefined>
  }
}

// Create a component that renders MatchesInner with Transitioner's setup logic inlined.
// This is critical for proper hydration - we call useTransitionerSetup() as a composable
// rather than rendering it as a component, which avoids Fragment/element mismatches.
const MatchesContent = Vue.defineComponent({
  name: 'MatchesContent',
  setup() {
    // IMPORTANT: We need to ensure Transitioner's setup() runs.
    // Transitioner sets up critical functionality:
    // - router.startTransition
    // - History subscription via router.history.subscribe(router.load)
    // - Watchers for router events
    //
    // We inline Transitioner's setup logic here. Since Transitioner returns null,
    // we can call its setup function directly without affecting the render tree.
    // This is done by importing and calling useTransitionerSetup.
    useTransitionerSetup()

    return () => Vue.h(MatchesInner)
  },
})

export const Matches = Vue.defineComponent({
  name: 'Matches',
  setup() {
    const router = useRouter()

    return () => {
      const pendingElement = router?.options?.defaultPendingComponent
        ? Vue.h(router.options.defaultPendingComponent)
        : null

      // Do not render a root Suspense during SSR or hydrating from SSR
      const inner =
        (isServer ?? router?.isServer ?? false) ||
        (typeof document !== 'undefined' && router?.ssr)
          ? Vue.h(MatchesContent)
          : Vue.h(
              Vue.Suspense,
              { fallback: pendingElement },
              {
                default: () => Vue.h(MatchesContent),
              },
            )

      return router?.options?.InnerWrap
        ? Vue.h(router.options.InnerWrap, null, { default: () => inner })
        : inner
    }
  },
})

// Create a simple error component function that matches ErrorRouteComponent
const errorComponentFn: ErrorRouteComponentType = (
  props: ErrorComponentProps,
) => {
  return Vue.h('div', { class: 'error' }, [
    Vue.h('h1', null, 'Error'),
    Vue.h('p', null, props.error.message || String(props.error)),
    Vue.h('button', { onClick: props.reset }, 'Try Again'),
  ])
}

const MatchesInner = Vue.defineComponent({
  name: 'MatchesInner',
  setup() {
    const router = useRouter()

    const matchId = useStore(router.stores.firstId, (id) => id)
    const resetKey = useStore(router.stores.loadedAt, (loadedAt) => loadedAt)

    // Create a ref for the match id to provide
    const matchIdRef = Vue.computed(() => matchId.value)

    // Provide the matchId for child components using the InjectionKey
    Vue.provide(matchContext, matchIdRef)

    return () => {
      // Generate a placeholder element if matchId.value is not present
      const childElement = matchId.value
        ? Vue.h(Match, { matchId: matchId.value })
        : Vue.h('div')

      // If disableGlobalCatchBoundary is true, don't wrap in CatchBoundary
      if (router.options.disableGlobalCatchBoundary) {
        return childElement
      }

      return Vue.h(CatchBoundary, {
        getResetKey: () => resetKey.value,
        errorComponent: errorComponentFn,
        onCatch:
          process.env.NODE_ENV !== 'production'
            ? (error: Error) => {
                console.warn(
                  `Warning: The following error wasn't caught by any route! At the very least, consider setting an 'errorComponent' in your RootRoute!`,
                )
                console.warn(`Warning: ${error.message || error.toString()}`)
              }
            : undefined,
        children: childElement,
      })
    }
  },
})

export type UseMatchRouteOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = undefined,
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '',
> = ToSubOptionsProps<TRouter, TFrom, TTo> &
  DeepPartial<MakeOptionalSearchParams<TRouter, TFrom, TTo>> &
  DeepPartial<MakeOptionalPathParams<TRouter, TFrom, TTo>> &
  MaskOptions<TRouter, TMaskFrom, TMaskTo> &
  MatchRouteOptions

export function useMatchRoute<TRouter extends AnyRouter = RegisteredRouter>() {
  const router = useRouter()

  const routerState = useStore(router.stores.matchRouteDeps, (value) => value)

  return <
    const TFrom extends string = string,
    const TTo extends string | undefined = undefined,
    const TMaskFrom extends string = TFrom,
    const TMaskTo extends string = '',
  >(
    opts: UseMatchRouteOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>,
  ): Vue.Ref<
    false | ResolveRoute<TRouter, TFrom, TTo>['types']['allParams']
  > => {
    const { pending, caseSensitive, fuzzy, includeSearch, ...rest } = opts

    const matchRoute = Vue.computed(() => {
      // Access routerState to establish dependency

      routerState.value
      return router.matchRoute(rest as any, {
        pending,
        caseSensitive,
        fuzzy,
        includeSearch,
      })
    })

    return matchRoute
  }
}

export type MakeMatchRouteOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = undefined,
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '',
> = UseMatchRouteOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo> & {
  // If a function is passed as a child, it will be given the `isActive` boolean to aid in further styling on the element it returns
  children?:
    | ((
        params?: ResolveRoute<TRouter, TFrom, TTo>['types']['allParams'],
      ) => Vue.VNode)
    | Vue.VNode
}

// Create a type for the MatchRoute component that includes the generics
export interface MatchRouteComponentType {
  <
    TRouter extends AnyRouter = RegisteredRouter,
    TFrom extends string = string,
    TTo extends string | undefined = undefined,
  >(
    props: MakeMatchRouteOptions<TRouter, TFrom, TTo>,
  ): Vue.VNode
  new (): {
    $props: {
      from?: string
      to?: string
      fuzzy?: boolean
      caseSensitive?: boolean
      includeSearch?: boolean
      pending?: boolean
    }
  }
}

export const MatchRoute = Vue.defineComponent({
  name: 'MatchRoute',
  props: {
    // Define props to match MakeMatchRouteOptions
    from: {
      type: String,
      required: false,
    },
    to: {
      type: String,
      required: false,
    },
    fuzzy: {
      type: Boolean,
      required: false,
    },
    caseSensitive: {
      type: Boolean,
      required: false,
    },
    includeSearch: {
      type: Boolean,
      required: false,
    },
    pending: {
      type: Boolean,
      required: false,
    },
  },
  setup(props, { slots }) {
    const router = useRouter()
    const status = useStore(
      router.stores.matchRouteDeps,
      (value) => value.status,
    )

    return () => {
      if (!status.value) return null

      const matchRoute = useMatchRoute()
      const params = matchRoute(props).value as boolean

      // Create a component that renders the slot in a reactive manner
      if (!params || !slots.default) {
        return null
      }

      // For function slots, pass the params
      if (typeof slots.default === 'function') {
        // Use h to create a wrapper component that will call the slot function
        return Vue.h(Vue.Fragment, null, slots.default(params))
      }

      // For normal slots, just render them
      return Vue.h(Vue.Fragment, null, slots.default)
    }
  },
}) as unknown as MatchRouteComponentType

export interface UseMatchesBaseOptions<TRouter extends AnyRouter, TSelected> {
  select?: (matches: Array<MakeRouteMatchUnion<TRouter>>) => TSelected
}

export type UseMatchesResult<
  TRouter extends AnyRouter,
  TSelected,
> = unknown extends TSelected ? Array<MakeRouteMatchUnion<TRouter>> : TSelected

export function useMatches<
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
>(
  opts?: UseMatchesBaseOptions<TRouter, TSelected>,
): Vue.Ref<UseMatchesResult<TRouter, TSelected>> {
  const router = useRouter<TRouter>()
  return useStore(router.stores.matches, (matches) => {
    return opts?.select
      ? opts.select(matches as Array<MakeRouteMatchUnion<TRouter>>)
      : (matches as any)
  })
}

export function useParentMatches<
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
>(
  opts?: UseMatchesBaseOptions<TRouter, TSelected>,
): Vue.Ref<UseMatchesResult<TRouter, TSelected>> {
  // Use matchContext with proper type
  const contextMatchId = Vue.inject<Vue.Ref<string | undefined>>(matchContext)
  const safeMatchId = Vue.computed(() => contextMatchId?.value || '')

  return useMatches({
    select: (matches: Array<MakeRouteMatchUnion<TRouter>>) => {
      matches = matches.slice(
        0,
        matches.findIndex((d) => d.id === safeMatchId.value),
      )
      return opts?.select ? opts.select(matches) : matches
    },
  } as any)
}

export function useChildMatches<
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
>(
  opts?: UseMatchesBaseOptions<TRouter, TSelected>,
): Vue.Ref<UseMatchesResult<TRouter, TSelected>> {
  // Use matchContext with proper type
  const contextMatchId = Vue.inject<Vue.Ref<string | undefined>>(matchContext)
  const safeMatchId = Vue.computed(() => contextMatchId?.value || '')

  return useMatches({
    select: (matches: Array<MakeRouteMatchUnion<TRouter>>) => {
      matches = matches.slice(
        matches.findIndex((d) => d.id === safeMatchId.value) + 1,
      )
      return opts?.select ? opts.select(matches) : matches
    },
  } as any)
}

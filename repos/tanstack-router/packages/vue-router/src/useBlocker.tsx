import * as Vue from 'vue'
import { useRouter } from './useRouter'
import type {
  BlockerFnArgs,
  HistoryAction,
  HistoryLocation,
} from '@tanstack/history'
import type {
  AnyRoute,
  AnyRouter,
  ParseRoute,
  RegisteredRouter,
} from '@tanstack/router-core'

type ShouldBlockFnLocation<
  out TRouteId,
  out TFullPath,
  out TAllParams,
  out TFullSearchSchema,
> = {
  routeId: TRouteId
  fullPath: TFullPath
  pathname: string
  params: TAllParams
  search: TFullSearchSchema
}

type AnyShouldBlockFnLocation = ShouldBlockFnLocation<any, any, any, any>
type MakeShouldBlockFnLocationUnion<
  TRouter extends AnyRouter = RegisteredRouter,
  TRoute extends AnyRoute = ParseRoute<TRouter['routeTree']>,
> = TRoute extends any
  ? ShouldBlockFnLocation<
      TRoute['id'],
      TRoute['fullPath'],
      TRoute['types']['allParams'],
      TRoute['types']['fullSearchSchema']
    >
  : never

type BlockerResolver<TRouter extends AnyRouter = RegisteredRouter> =
  | {
      status: 'blocked'
      current: MakeShouldBlockFnLocationUnion<TRouter>
      next: MakeShouldBlockFnLocationUnion<TRouter>
      action: HistoryAction
      proceed: () => void
      reset: () => void
    }
  | {
      status: 'idle'
      current: undefined
      next: undefined
      action: undefined
      proceed: undefined
      reset: undefined
    }

type ShouldBlockFnArgs<TRouter extends AnyRouter = RegisteredRouter> = {
  current: MakeShouldBlockFnLocationUnion<TRouter>
  next: MakeShouldBlockFnLocationUnion<TRouter>
  action: HistoryAction
}

export type ShouldBlockFn<TRouter extends AnyRouter = RegisteredRouter> = (
  args: ShouldBlockFnArgs<TRouter>,
) => boolean | Promise<boolean>
export type UseBlockerOpts<
  TRouter extends AnyRouter = RegisteredRouter,
  TWithResolver extends boolean = boolean,
> = {
  shouldBlockFn: ShouldBlockFn<TRouter>
  enableBeforeUnload?: boolean | (() => boolean)
  disabled?: boolean
  withResolver?: TWithResolver
}

type LegacyBlockerFn = () => Promise<any> | any
type LegacyBlockerOpts = {
  blockerFn?: LegacyBlockerFn
  condition?: boolean | any
}

function _resolveBlockerOpts(
  opts?: UseBlockerOpts | LegacyBlockerOpts | LegacyBlockerFn,
  condition?: boolean | any,
): UseBlockerOpts {
  if (opts === undefined) {
    return {
      shouldBlockFn: () => true,
      withResolver: false,
    }
  }

  if ('shouldBlockFn' in opts) {
    return opts
  }

  if (typeof opts === 'function') {
    const shouldBlock = Boolean(condition ?? true)

    const _customBlockerFn = async () => {
      if (shouldBlock) return await opts()
      return false
    }

    return {
      shouldBlockFn: _customBlockerFn,
      enableBeforeUnload: shouldBlock,
      withResolver: false,
    }
  }

  const shouldBlock = Boolean(opts.condition ?? true)
  const fn = opts.blockerFn

  const _customBlockerFn = async () => {
    if (shouldBlock && fn !== undefined) {
      return await fn()
    }
    return shouldBlock
  }

  return {
    shouldBlockFn: _customBlockerFn,
    enableBeforeUnload: shouldBlock,
    withResolver: fn === undefined,
  }
}

export function useBlocker<
  TRouter extends AnyRouter = RegisteredRouter,
  TWithResolver extends boolean = false,
>(
  opts: UseBlockerOpts<TRouter, TWithResolver>,
): TWithResolver extends true ? Vue.Ref<BlockerResolver<TRouter>> : void

/**
 * @deprecated Use the shouldBlockFn property instead
 */
export function useBlocker(
  blockerFnOrOpts?: LegacyBlockerOpts,
): Vue.Ref<BlockerResolver>

/**
 * @deprecated Use the UseBlockerOpts object syntax instead
 */
export function useBlocker(
  blockerFn?: LegacyBlockerFn,
  condition?: boolean | any,
): Vue.Ref<BlockerResolver>

export function useBlocker(
  opts?: UseBlockerOpts | LegacyBlockerOpts | LegacyBlockerFn,
  condition?: boolean | any,
): Vue.Ref<BlockerResolver> | void {
  const {
    shouldBlockFn,
    enableBeforeUnload = true,
    disabled = false,
    withResolver = false,
  } = _resolveBlockerOpts(opts, condition)

  const router = useRouter()
  const { history } = router

  const resolver = Vue.ref<BlockerResolver>({
    status: 'idle',
    current: undefined,
    next: undefined,
    action: undefined,
    proceed: undefined,
    reset: undefined,
  })

  Vue.watchEffect((onCleanup) => {
    const blockerFnComposed = async (blockerFnArgs: BlockerFnArgs) => {
      function getLocation(
        location: HistoryLocation,
      ): AnyShouldBlockFnLocation {
        const parsedLocation = router.parseLocation(location)
        const matchedRoutes = router.getMatchedRoutes(parsedLocation.pathname)
        if (matchedRoutes.foundRoute === undefined) {
          return {
            routeId: '__notFound__',
            fullPath: parsedLocation.pathname,
            pathname: parsedLocation.pathname,
            params: matchedRoutes.routeParams,
            search: parsedLocation.search,
          }
        }
        return {
          routeId: matchedRoutes.foundRoute.id,
          fullPath: matchedRoutes.foundRoute.fullPath,
          pathname: parsedLocation.pathname,
          params: matchedRoutes.routeParams,
          search: parsedLocation.search,
        }
      }

      const current = getLocation(blockerFnArgs.currentLocation)
      const next = getLocation(blockerFnArgs.nextLocation)

      // Allow navigation away from 404 pages to valid routes
      if (
        current.routeId === '__notFound__' &&
        next.routeId !== '__notFound__'
      ) {
        return false
      }

      const shouldBlock = await shouldBlockFn({
        action: blockerFnArgs.action,
        current,
        next,
      })
      if (!withResolver) {
        return shouldBlock
      }

      if (!shouldBlock) {
        return false
      }

      const promise = new Promise<boolean>((resolve) => {
        resolver.value = {
          status: 'blocked',
          current,
          next,
          action: blockerFnArgs.action,
          proceed: () => resolve(false),
          reset: () => resolve(true),
        }
      })

      const canNavigateAsync = await promise
      resolver.value = {
        status: 'idle',
        current: undefined,
        next: undefined,
        action: undefined,
        proceed: undefined,
        reset: undefined,
      }

      return canNavigateAsync
    }

    if (disabled) {
      return
    }

    const unsubscribe = history.block({
      blockerFn: blockerFnComposed,
      enableBeforeUnload,
    })

    onCleanup(() => {
      if (unsubscribe) unsubscribe()
    })
  })

  return withResolver ? resolver : undefined
}

const _resolvePromptBlockerArgs = (
  props: PromptProps | LegacyPromptProps,
): UseBlockerOpts => {
  if ('shouldBlockFn' in props) {
    return { ...props }
  }

  const shouldBlock = Boolean(props.condition ?? true)
  const fn = props.blockerFn

  const _customBlockerFn = async () => {
    if (shouldBlock && fn !== undefined) {
      return await fn()
    }
    return shouldBlock
  }

  return {
    shouldBlockFn: _customBlockerFn,
    enableBeforeUnload: shouldBlock,
    withResolver: fn === undefined,
  }
}

// Internal Block implementation as a proper Vue component for reactivity
const BlockImpl = Vue.defineComponent({
  name: 'Block',
  props: {
    shouldBlockFn: {
      type: Function as Vue.PropType<ShouldBlockFn<any>>,
      required: false,
    },
    enableBeforeUnload: {
      type: [Boolean, Function] as Vue.PropType<boolean | (() => boolean)>,
      default: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    withResolver: {
      type: Boolean,
      default: false,
    },
    // Legacy props
    blockerFn: {
      type: Function as Vue.PropType<LegacyBlockerFn>,
      required: false,
    },
    condition: {
      type: [Boolean, Object] as Vue.PropType<boolean | any>,
      required: false,
    },
  },
  setup(props, { slots }) {
    // Create a computed that resolves the blocker args reactively
    const blockerArgs = Vue.computed<UseBlockerOpts>(() => {
      if (props.shouldBlockFn) {
        return {
          shouldBlockFn: props.shouldBlockFn,
          enableBeforeUnload: props.enableBeforeUnload,
          disabled: props.disabled,
          withResolver: props.withResolver,
        }
      }

      // Legacy handling
      const shouldBlock = Boolean(props.condition ?? true)
      const fn = props.blockerFn

      const _customBlockerFn = async () => {
        if (shouldBlock && fn !== undefined) {
          return await fn()
        }
        return shouldBlock
      }

      return {
        shouldBlockFn: _customBlockerFn,
        enableBeforeUnload: shouldBlock,
        disabled: props.disabled,
        withResolver: fn === undefined,
      }
    })

    // Use a reactive useBlocker that re-subscribes when args change
    const router = useRouter()
    const { history } = router

    const resolver = Vue.ref<BlockerResolver>({
      status: 'idle',
      current: undefined,
      next: undefined,
      action: undefined,
      proceed: undefined,
      reset: undefined,
    })

    Vue.watchEffect((onCleanup) => {
      const args = blockerArgs.value

      if (args.disabled) {
        return
      }

      const blockerFnComposed = async (blockerFnArgs: BlockerFnArgs) => {
        function getLocation(
          location: HistoryLocation,
        ): AnyShouldBlockFnLocation {
          const parsedLocation = router.parseLocation(location)
          const matchedRoutes = router.getMatchedRoutes(parsedLocation.pathname)
          if (matchedRoutes.foundRoute === undefined) {
            return {
              routeId: '__notFound__',
              fullPath: parsedLocation.pathname,
              pathname: parsedLocation.pathname,
              params: matchedRoutes.routeParams,
              search: parsedLocation.search,
            }
          }
          return {
            routeId: matchedRoutes.foundRoute.id,
            fullPath: matchedRoutes.foundRoute.fullPath,
            pathname: parsedLocation.pathname,
            params: matchedRoutes.routeParams,
            search: parsedLocation.search,
          }
        }

        const current = getLocation(blockerFnArgs.currentLocation)
        const next = getLocation(blockerFnArgs.nextLocation)

        // Allow navigation away from 404 pages to valid routes
        if (
          current.routeId === '__notFound__' &&
          next.routeId !== '__notFound__'
        ) {
          return false
        }

        const shouldBlock = await args.shouldBlockFn({
          action: blockerFnArgs.action,
          current,
          next,
        })
        if (!args.withResolver) {
          return shouldBlock
        }

        if (!shouldBlock) {
          return false
        }

        const promise = new Promise<boolean>((resolve) => {
          resolver.value = {
            status: 'blocked',
            current,
            next,
            action: blockerFnArgs.action,
            proceed: () => resolve(false),
            reset: () => resolve(true),
          }
        })

        const canNavigateAsync = await promise
        resolver.value = {
          status: 'idle',
          current: undefined,
          next: undefined,
          action: undefined,
          proceed: undefined,
          reset: undefined,
        }

        return canNavigateAsync
      }

      const unsubscribe = history.block({
        blockerFn: blockerFnComposed,
        enableBeforeUnload: args.enableBeforeUnload,
      })

      onCleanup(() => {
        if (unsubscribe) unsubscribe()
      })
    })

    return () => {
      const defaultSlot = slots.default
      if (!defaultSlot) {
        return Vue.h(Vue.Fragment, null)
      }

      // If slot is a function that takes resolver, call it with the resolver
      const slotContent = defaultSlot(resolver.value)
      return Vue.h(Vue.Fragment, null, slotContent)
    }
  },
})

export function Block<
  TRouter extends AnyRouter = RegisteredRouter,
  TWithResolver extends boolean = boolean,
>(opts: PromptProps<TRouter, TWithResolver>): Vue.VNode

/**
 *  @deprecated Use the UseBlockerOpts property instead
 */
export function Block(opts: LegacyPromptProps): Vue.VNode

export function Block(opts: PromptProps | LegacyPromptProps): Vue.VNode {
  const { children, ...rest } = opts

  // Convert children to slot format for the component
  const slots = children
    ? typeof children === 'function'
      ? { default: children }
      : { default: () => children }
    : undefined

  return Vue.h(BlockImpl, rest, slots)
}

type LegacyPromptProps = {
  blockerFn?: LegacyBlockerFn
  condition?: boolean | any
  children?: Vue.VNode | ((params: BlockerResolver) => Vue.VNode)
}

type PromptProps<
  TRouter extends AnyRouter = RegisteredRouter,
  TWithResolver extends boolean = boolean,
  TParams = TWithResolver extends true ? BlockerResolver<TRouter> : void,
> = UseBlockerOpts<TRouter, TWithResolver> & {
  children?: Vue.VNode | ((params: TParams) => Vue.VNode)
}

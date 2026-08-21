import * as Solid from 'solid-js'
import { useRouter } from './useRouter'
import type {
  BlockerFnArgs,
  HistoryAction,
  HistoryLocation,
} from '@tanstack/history'
import type { SolidNode } from './route'
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

  const shouldBlock = Solid.createMemo(() => Boolean(opts.condition ?? true))

  const _customBlockerFn = async () => {
    if (shouldBlock() && opts.blockerFn !== undefined) {
      return await opts.blockerFn()
    }
    return shouldBlock()
  }

  return {
    get shouldBlockFn() {
      return _customBlockerFn
    },
    get enableBeforeUnload() {
      return shouldBlock()
    },
    get withResolver() {
      return opts.blockerFn === undefined
    },
  }
}

export function useBlocker<
  TRouter extends AnyRouter = RegisteredRouter,
  TWithResolver extends boolean = false,
>(
  opts: UseBlockerOpts<TRouter, TWithResolver>,
): TWithResolver extends true ? Solid.Accessor<BlockerResolver<TRouter>> : void

/**
 * @deprecated Use the shouldBlockFn property instead
 */
export function useBlocker(
  blockerFnOrOpts?: LegacyBlockerOpts,
): Solid.Accessor<BlockerResolver>

/**
 * @deprecated Use the UseBlockerOpts object syntax instead
 */
export function useBlocker(
  blockerFn?: LegacyBlockerFn,
  condition?: boolean | any,
): Solid.Accessor<BlockerResolver>

export function useBlocker(
  opts?: UseBlockerOpts | LegacyBlockerOpts | LegacyBlockerFn,
  condition?: boolean | any,
): Solid.Accessor<BlockerResolver> | void {
  const props = Solid.mergeProps(
    {
      enableBeforeUnload: true,
      disabled: false,
      withResolver: false,
    },
    _resolveBlockerOpts(opts, condition),
  )

  const router = useRouter()

  const [resolver, setResolver] = Solid.createSignal<BlockerResolver>({
    status: 'idle',
    current: undefined,
    next: undefined,
    action: undefined,
    proceed: undefined,
    reset: undefined,
  })

  Solid.createEffect(() => {
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

      if (
        current.routeId === '__notFound__' &&
        next.routeId !== '__notFound__'
      ) {
        return false
      }

      const shouldBlock = await props.shouldBlockFn({
        action: blockerFnArgs.action,
        current,
        next,
      })
      if (!props.withResolver) {
        return shouldBlock
      }

      if (!shouldBlock) {
        return false
      }

      const promise = new Promise<boolean>((resolve) => {
        setResolver({
          status: 'blocked',
          current,
          next,
          action: blockerFnArgs.action,
          proceed: () => resolve(false),
          reset: () => resolve(true),
        })
      })

      const canNavigateAsync = await promise
      setResolver({
        status: 'idle',
        current: undefined,
        next: undefined,
        action: undefined,
        proceed: undefined,
        reset: undefined,
      })

      return canNavigateAsync
    }

    const disposeBlock = props.disabled
      ? undefined
      : router.history.block({
          blockerFn: blockerFnComposed,
          enableBeforeUnload: props.enableBeforeUnload,
        })

    Solid.onCleanup(() => disposeBlock?.())
  })

  return resolver
}

const _resolvePromptBlockerArgs = (
  props: PromptProps | LegacyPromptProps,
): UseBlockerOpts => {
  if ('shouldBlockFn' in props) {
    return props
  }

  const shouldBlock = Solid.createMemo(() => Boolean(props.condition ?? true))

  const _customBlockerFn = async () => {
    if (shouldBlock() && props.blockerFn !== undefined) {
      return await props.blockerFn()
    }
    return shouldBlock
  }

  return {
    shouldBlockFn: _customBlockerFn,
    get enableBeforeUnload() {
      return shouldBlock()
    },
    get withResolver() {
      return props.blockerFn === undefined
    },
  }
}

interface BlockComponent {
  <
    TRouter extends AnyRouter = RegisteredRouter,
    TWithResolver extends boolean = boolean,
  >(
    opts: PromptProps<TRouter, TWithResolver>,
  ): SolidNode
  /**
   *  @deprecated Use the UseBlockerOpts property instead
   */
  (opts: LegacyPromptProps): SolidNode
}

export const Block: BlockComponent = function Block(
  opts: PromptProps | LegacyPromptProps,
): SolidNode {
  const [propsWithChildren, rest] = Solid.splitProps(opts, ['children'])
  const args = _resolvePromptBlockerArgs(rest)

  const resolver = useBlocker(args)
  const children = Solid.createMemo(() => {
    const child = propsWithChildren.children
    if (resolver && typeof child === 'function') return child(resolver())
    return child
  })

  return <>{children()}</>
}

type LegacyPromptProps = {
  blockerFn?: LegacyBlockerFn
  condition?: boolean | any
  children?: SolidNode | ((params: BlockerResolver) => SolidNode)
}

type PromptProps<
  TRouter extends AnyRouter = RegisteredRouter,
  TWithResolver extends boolean = boolean,
  TParams = TWithResolver extends true ? BlockerResolver<TRouter> : void,
> = UseBlockerOpts<TRouter, TWithResolver> & {
  children?: SolidNode | ((params: TParams) => SolidNode)
}

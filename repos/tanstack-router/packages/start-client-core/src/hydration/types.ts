export type HydrationWhen =
  | 'load'
  | 'idle'
  | 'visible'
  | 'media'
  | 'interaction'
  | 'condition'
  | 'never'
  | 'dynamic'

export type HydrationInteractionEvent =
  | 'auxclick'
  | 'click'
  | 'contextmenu'
  | 'dblclick'
  | 'focusin'
  | 'keydown'
  | 'keyup'
  | 'mousedown'
  | 'mouseenter'
  | 'mouseover'
  | 'mouseup'
  | 'pointerdown'
  | 'pointerenter'
  | 'pointerover'
  | 'pointerup'

export type HydrationInteractionEvents =
  | HydrationInteractionEvent
  | ReadonlyArray<HydrationInteractionEvent>

export type HydrationMarkerAttributes = Record<string, string | undefined>

export type HydrationRuntimeGate = {
  id?: string
  when?: HydrationWhen
  resolved: boolean
  resolve: () => void
}

export type HydrationRuntimeContext = {
  element: Element | null
  gate?: HydrationRuntimeGate
  prefetch?: () => void
  delegated?: boolean
}

export type HydrationStrategyTypes<
  TWhen extends HydrationWhen = HydrationWhen,
  TCanPrefetch extends boolean = boolean,
> = {
  when: TWhen
  canPrefetch: TCanPrefetch
}

export type HydrationStrategy<
  TWhen extends HydrationWhen = HydrationWhen,
  TCanPrefetch extends boolean = boolean,
> = {
  _t?: TWhen
  readonly '~types'?: HydrationStrategyTypes<TWhen, TCanPrefetch>
  _d?: () => boolean
  _s?: (context: HydrationRuntimeContext) => void | (() => void)
  _o?: (id: string) => void
  _a?: () => HydrationMarkerAttributes | undefined
}

export type HydrationPrefetchWhen = Exclude<
  HydrationWhen,
  'condition' | 'never' | 'dynamic'
>

export type HydrationPrefetchStrategy<
  TWhen extends HydrationPrefetchWhen = HydrationPrefetchWhen,
> = HydrationStrategy<TWhen, true>

export type HydrationPrefetchWaitReason = 'prefetch' | 'hydrate' | 'abort'

export type HydrationPrefetchContext = {
  element: Element | null
  signal: AbortSignal
  preload: () => Promise<void>
  waitFor: (
    strategy: HydrationPrefetchStrategy,
  ) => Promise<HydrationPrefetchWaitReason>
}

export type HydrationPrefetchFunction = (
  context: HydrationPrefetchContext,
) => void | Promise<void>

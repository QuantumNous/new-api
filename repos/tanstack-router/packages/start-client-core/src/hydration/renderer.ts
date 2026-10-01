import type { HydrationStrategy } from './types'

export type HydrationStrategyWithRenderer<
  TStrategy extends HydrationStrategy,
  TRenderer,
> = TStrategy & {
  _h: TRenderer
}

/* @__NO_SIDE_EFFECTS__ */
export function withHydrationRenderer<
  TStrategy extends HydrationStrategy,
  TRenderer,
>(
  strategy: TStrategy,
  renderer: TRenderer,
): HydrationStrategyWithRenderer<TStrategy, TRenderer> {
  return /* @__PURE__ */ Object.assign(strategy, {
    _h: renderer,
  })
}

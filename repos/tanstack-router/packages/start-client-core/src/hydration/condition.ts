import type { HydrationStrategy } from './types'

const conditionType = 'condition'

export type HydrationCondition = boolean | (() => boolean)

/* @__NO_SIDE_EFFECTS__ */
export function condition(
  condition: HydrationCondition,
): HydrationStrategy<typeof conditionType, false> {
  return {
    _t: conditionType,
    _d: () => !(typeof condition === 'function' ? condition() : condition),
    _s: ({ gate }) => {
      if (typeof condition === 'function' ? condition() : condition) {
        gate!.resolve()
      }
    },
  }
}

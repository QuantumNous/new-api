import type { HydrationPrefetchStrategy } from './types'

const idleType = 'idle'

export type IdleHydrationOptions = {
  timeout?: number
}

export function idle(
  options: IdleHydrationOptions = {},
): HydrationPrefetchStrategy<typeof idleType> {
  const timeout = options.timeout ?? 2000

  return {
    _t: idleType,
    _s: ({ gate, prefetch }) => {
      const schedule = globalThis as unknown as {
        requestIdleCallback?: (
          callback: IdleRequestCallback,
          options?: IdleRequestOptions,
        ) => number
        cancelIdleCallback?: (handle: number) => void
      }
      const callback = prefetch ?? gate!.resolve

      if (schedule.requestIdleCallback) {
        const handle = schedule.requestIdleCallback(callback, { timeout })
        return () => schedule.cancelIdleCallback?.(handle)
      }

      const timeoutId = globalThis.setTimeout(callback, timeout)
      return () => globalThis.clearTimeout(timeoutId)
    },
  }
}

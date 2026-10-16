import type { HydrationPrefetchStrategy } from './types'

const mediaType = 'media'

/* @__NO_SIDE_EFFECTS__ */
export function media(
  query: string,
): HydrationPrefetchStrategy<typeof mediaType> {
  return {
    _t: mediaType,
    _s: ({ gate, prefetch }) => {
      if (!query) return

      const callback = prefetch ?? gate!.resolve
      const mediaQuery = window.matchMedia(query)
      const onChange = () => {
        if (mediaQuery.matches) callback()
      }
      mediaQuery.addEventListener('change', onChange)
      onChange()

      return () => mediaQuery.removeEventListener('change', onChange)
    },
  }
}

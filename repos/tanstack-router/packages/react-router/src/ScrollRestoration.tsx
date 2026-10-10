import {
  getElementScrollRestorationEntry,
  setupScrollRestoration,
} from '@tanstack/router-core'
import { useRouter } from './useRouter'
import type {
  ParsedLocation,
  ScrollRestorationEntry,
  ScrollRestorationOptions,
} from '@tanstack/router-core'

function useScrollRestoration() {
  const router = useRouter()
  setupScrollRestoration(router, true)
}

/**
 * @deprecated Use the `scrollRestoration` router option instead.
 */
export function ScrollRestoration(_props: ScrollRestorationOptions) {
  useScrollRestoration()

  if (process.env.NODE_ENV === 'development') {
    console.warn(
      "The ScrollRestoration component is deprecated. Use createRouter's `scrollRestoration` option instead.",
    )
  }

  return null
}

export function useElementScrollRestoration(
  options: (
    | {
        id: string
        getElement?: () => Window | Element | undefined | null
      }
    | {
        id?: string
        getElement: () => Window | Element | undefined | null
      }
  ) & {
    getKey?: (location: ParsedLocation) => string
  },
): ScrollRestorationEntry | undefined {
  useScrollRestoration()

  return getElementScrollRestorationEntry(useRouter(), options)
}

import { isServer } from '@tanstack/router-core/isServer'
import type { AnyRouter } from './router'
import type { ParsedLocation } from './location'

export type ScrollRestorationEntry = { scrollX: number; scrollY: number }

type ScrollRestorationByElement = Record<string, ScrollRestorationEntry>

type ScrollRestorationByKey = Record<string, ScrollRestorationByElement>

export type ScrollRestorationOptions = {
  getKey?: (location: ParsedLocation) => string
  scrollBehavior?: ScrollToOptions['behavior']
}

function getSafeSessionStorage() {
  try {
    // Accessing sessionStorage itself can throw SecurityError in locked-down
    // contexts, e.g. sandboxed/opaque origins or blocked storage policies.
    return sessionStorage
  } catch {
    return
  }
}

// SessionStorage key used to store scroll positions across navigations.
export const storageKey = 'tsr-scroll-restoration-v1_3'
const safeSessionStorage = getSafeSessionStorage()

function createScrollRestorationCache() {
  try {
    return JSON.parse(
      safeSessionStorage?.getItem(storageKey) || '{}',
    ) as ScrollRestorationByKey
  } catch {
    // ignore invalid session storage payloads
    return {}
  }
}

function persistScrollRestorationCache() {
  try {
    safeSessionStorage?.setItem(
      storageKey,
      JSON.stringify(scrollRestorationCache),
    )
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[ts-router] Could not persist scroll restoration state to sessionStorage.',
      )
    }
  }
}

const scrollRestorationCache = /* @__PURE__ */ createScrollRestorationCache()
const scrollRestorationIdAttribute = 'data-scroll-restoration-id'

/**
 * The default `getKey` function for `useScrollRestoration`.
 * It returns the `key` from the location state or the `href` of the location.
 *
 * The `location.href` is used as a fallback to support the use case where the location state is not available like the initial render.
 */
export const defaultGetScrollRestorationKey = (location: ParsedLocation) => {
  return location.state.__TSR_key! || location.href
}

function getScrollRestorationSelector(element: Element): string {
  const attrId = element.getAttribute(scrollRestorationIdAttribute)
  if (attrId) {
    return `[${scrollRestorationIdAttribute}="${attrId}"]`
  }

  let selector = ''
  let el: any = element
  let parent: HTMLElement

  while ((parent = el.parentNode)) {
    let index = 1
    let sibling = el
    while ((sibling = sibling.previousElementSibling)) {
      index++
    }

    const part = `${el.localName}:nth-child(${index})`
    selector = selector ? `${part} > ${selector}` : part
    el = parent
  }

  return selector
}

export function getElementScrollRestorationEntry(
  router: AnyRouter,
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
  const getKey = options.getKey || defaultGetScrollRestorationKey
  const restoreKey = getKey(router.latestLocation)
  const entries = scrollRestorationCache[restoreKey]

  if (!entries) {
    return
  }

  if (options.id) {
    return entries[`[${scrollRestorationIdAttribute}="${options.id}"]`]
  }

  const element = options.getElement?.()
  if (!element) {
    return
  }

  return entries[
    element === window
      ? windowScrollTarget
      : getScrollRestorationSelector(element as Element)
  ]
}

let ignoreScroll = false
const windowScrollTarget = 'window'

function getElement(selector: string | (() => Element | null | undefined)) {
  try {
    return typeof selector === 'function'
      ? selector()
      : document.querySelector(selector)
  } catch {}
  return
}

function getScrollToTopElements(
  scrollToTopSelectors: NonNullable<
    AnyRouter['options']['scrollToTopSelectors']
  >,
) {
  const elements = new Set<Element>()

  for (const selector of scrollToTopSelectors) {
    if (selector === windowScrollTarget) {
      continue
    }

    const element = getElement(selector)
    if (element) {
      elements.add(element)
    }
  }

  return elements
}

export function setupScrollRestoration(router: AnyRouter, force?: boolean) {
  // Keep hash/top scrolling active even when sessionStorage is unavailable.
  const shouldSetupScrollRestoration = force ?? router.options.scrollRestoration
  const scroll = router._scroll

  if (shouldSetupScrollRestoration) {
    scroll.restoring = true
  }

  if (isServer ?? router.isServer) {
    return
  }

  const getKey =
    router.options.getScrollRestorationKey || defaultGetScrollRestorationKey
  const trackedScrollTargets = new Set<Document | Element>()

  // Snapshot the current page's tracked scroll targets before navigation or unload.
  const snapshotCurrentScrollTargets = (restoreKey: string) => {
    const keyEntry = (scrollRestorationCache[restoreKey] ||=
      {} as ScrollRestorationByElement)

    for (const target of trackedScrollTargets) {
      if (target === document) {
        keyEntry[windowScrollTarget] = { scrollX, scrollY }
      } else if ((target as Element).isConnected) {
        keyEntry[getScrollRestorationSelector(target as Element)] = {
          scrollX: (target as Element).scrollLeft,
          scrollY: (target as Element).scrollTop,
        }
      }
    }
  }

  if (shouldSetupScrollRestoration && !scroll.restoration) {
    scroll.restoration = true
    ignoreScroll = false

    history.scrollRestoration = 'manual'

    document.addEventListener(
      'scroll',
      (event) => {
        if (ignoreScroll) {
          return
        }
        trackedScrollTargets.add(event.target as Document | Element)
      },
      true,
    )
    router.subscribe('onBeforeLoad', (event) => {
      if (event.fromLocation) {
        snapshotCurrentScrollTargets(getKey(event.fromLocation))
      }
      trackedScrollTargets.clear()
    })
    addEventListener('pagehide', () => {
      snapshotCurrentScrollTargets(
        getKey(
          router.stores.resolvedLocation.get() ?? router.stores.location.get(),
        ),
      )
      persistScrollRestorationCache()
    })
  }

  if (scroll.reset) {
    return
  }

  scroll.reset = true

  // Restore destination scroll after the new route has rendered.
  router.subscribe('onRendered', (event) => {
    const behavior = router.options.scrollRestorationBehavior
    const scrollToTopSelectors = router.options.scrollToTopSelectors
    const shouldResetScroll = scroll.next
    const hashNavigation = scroll.hash
    let scrollToTopElements: Set<Element> | undefined
    trackedScrollTargets.clear()
    scroll.next = true
    scroll.hash = false

    if (
      typeof router.options.scrollRestoration === 'function' &&
      !router.options.scrollRestoration({ location: router.latestLocation })
    ) {
      return
    }

    const cacheKey = getKey(event.toLocation)
    const fromCacheKey = event.fromLocation && getKey(event.fromLocation)

    if (scroll.restoring && fromCacheKey && fromCacheKey !== cacheKey) {
      const fromElementEntries = scrollRestorationCache[fromCacheKey]

      if (fromElementEntries) {
        let toElementEntries = scrollRestorationCache[cacheKey]

        for (const elementSelector in fromElementEntries) {
          if (elementSelector === windowScrollTarget) {
            if (shouldResetScroll) {
              continue
            }
          } else {
            const element = getElement(elementSelector)
            if (!element) {
              continue
            }

            if (shouldResetScroll && scrollToTopSelectors) {
              scrollToTopElements ??=
                getScrollToTopElements(scrollToTopSelectors)
              if (scrollToTopElements.has(element)) {
                continue
              }
            }
          }

          if (!toElementEntries) {
            toElementEntries = scrollRestorationCache[cacheKey] =
              {} as ScrollRestorationByElement
          }

          toElementEntries[elementSelector] ??=
            fromElementEntries[elementSelector]!
        }
      }
    }

    ignoreScroll = true

    try {
      const hash = event.toLocation.hash
      const hashScrollIntoViewOptions =
        event.toLocation.state.__hashScrollIntoViewOptions ?? true
      let windowRestored = false

      if (shouldResetScroll) {
        if (!hash && scrollToTopSelectors) {
          scrollToTopElements ??= getScrollToTopElements(scrollToTopSelectors)
        }

        const skipWindowRestore =
          hash && hashScrollIntoViewOptions && hashNavigation

        const elementEntries = scroll.restoring
          ? scrollRestorationCache[cacheKey]
          : undefined

        if (elementEntries) {
          for (const elementSelector in elementEntries) {
            const { scrollX, scrollY } = elementEntries[elementSelector]!

            if (elementSelector === windowScrollTarget) {
              if (skipWindowRestore) {
                continue
              }

              scrollTo({
                top: scrollY,
                left: scrollX,
                behavior,
              })
              windowRestored = true
            } else {
              const element = getElement(elementSelector)
              if (element) {
                element.scrollLeft = scrollX
                element.scrollTop = scrollY
                scrollToTopElements?.delete(element)
              }
            }
          }
        }

        if (!hash) {
          const scrollOptions = {
            top: 0,
            left: 0,
            behavior,
          }

          if (!windowRestored) {
            scrollTo(scrollOptions)
          }
          if (scrollToTopElements) {
            for (const element of scrollToTopElements) {
              element.scrollTo(scrollOptions)
            }
          }
        }
      }

      if (!windowRestored && hash && hashScrollIntoViewOptions) {
        document.getElementById(hash)?.scrollIntoView(hashScrollIntoViewOptions)
      }
    } finally {
      ignoreScroll = false
    }
  })
}

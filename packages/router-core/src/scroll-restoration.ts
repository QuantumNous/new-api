import { isServer } from '@tanstack/router-core/isServer'
import { locationHistoryActions } from './router'
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
type ScrollTarget = typeof windowScrollTarget | Element

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
): Array<Element> {
  const elements: Array<Element> = []

  for (const selector of scrollToTopSelectors) {
    if (selector === windowScrollTarget) {
      continue
    }

    const element = getElement(selector)
    if (element) {
      elements.push(element)
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
  const trackedScrollEntries = new Map<ScrollTarget, ScrollRestorationEntry>()
  const setTrackedScrollEntry = (
    target: ScrollTarget,
    scrollX: number,
    scrollY: number,
  ) => {
    const entry =
      trackedScrollEntries.get(target) || ({} as ScrollRestorationEntry)
    entry.scrollX = scrollX
    entry.scrollY = scrollY
    trackedScrollEntries.set(target, entry)
  }

  const onScroll = (event: Event) => {
    if (ignoreScroll || !scroll.restoring) {
      return
    }

    if (event.target === document) {
      setTrackedScrollEntry(windowScrollTarget, scrollX, scrollY)
    } else {
      const target = event.target as Element
      setTrackedScrollEntry(target, target.scrollLeft, target.scrollTop)
    }
  }

  // Snapshot the current page's tracked scroll targets before navigation or unload.
  const snapshotCurrentScrollTargets = (restoreKey: string) => {
    if (!scroll.restoring) {
      return
    }

    const keyEntry = (scrollRestorationCache[restoreKey] ||=
      {} as ScrollRestorationByElement)

    for (const [target, position] of trackedScrollEntries) {
      if (target === windowScrollTarget) {
        keyEntry[windowScrollTarget] = position
      } else if (target.isConnected) {
        keyEntry[getScrollRestorationSelector(target)] = position
      }
    }
  }

  if (shouldSetupScrollRestoration && !scroll.restoration) {
    scroll.restoration = true
    ignoreScroll = false

    history.scrollRestoration = 'manual'

    document.addEventListener('scroll', onScroll, true)
    router.subscribe('onBeforeLoad', (event) => {
      if (event.fromLocation) {
        snapshotCurrentScrollTargets(getKey(event.fromLocation))
      }
      trackedScrollEntries.clear()
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
    let scrollToTopElements: Array<Element> | undefined
    trackedScrollEntries.clear()

    if (!shouldResetScroll) {
      scroll.next = true
    }

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
              if (scrollToTopElements.includes(element)) {
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
        const action = locationHistoryActions.get(event.toLocation)
        const skipWindowRestore =
          hash &&
          hashScrollIntoViewOptions &&
          (action === 'PUSH' || action === 'REPLACE')

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
              }
            }
          }
        }

        if (!windowRestored && !hash) {
          const scrollOptions = {
            top: 0,
            left: 0,
            behavior,
          }

          scrollTo(scrollOptions)
          if (scrollToTopSelectors) {
            scrollToTopElements ??= getScrollToTopElements(scrollToTopSelectors)
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

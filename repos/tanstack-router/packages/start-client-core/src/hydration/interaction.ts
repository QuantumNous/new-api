import {
  hydrateIdAttribute,
  hydrateInteractionEventsAttribute,
  hydrateWhenAttribute,
} from './constants'
import {
  clearResolvedGateIdsInMarker,
  getMarkerGate,
  resolveHydrationMarker,
} from './runtime'
import type {
  HydrationInteractionEvents,
  HydrationPrefetchStrategy,
  HydrationRuntimeContext,
} from './types'

export type InteractionHydrationOptions = {
  events?: HydrationInteractionEvents
}

const hydrateIdSelector = `[${hydrateIdAttribute}]`

type PendingReplayEvent = {
  marker: Element
  targetPath: Array<number>
  type: string
  event: Event
}

const defaultInteractionEvents = [
  'pointerenter',
  'focusin',
  'pointerdown',
  'click',
] as const
const supportedInteractionEvents = [
  'auxclick',
  'click',
  'contextmenu',
  'dblclick',
  'focusin',
  'keydown',
  'keyup',
  'mousedown',
  'mouseenter',
  'mouseover',
  'mouseup',
  'pointerdown',
  'pointerenter',
  'pointerover',
  'pointerup',
] as const
const interactionType = 'interaction'
const dynamicType = 'dynamic'
const interactionHydrateSelector = `[${hydrateWhenAttribute}="${interactionType}"]`
const delegatedHydrateSelector = `${interactionHydrateSelector},[${hydrateWhenAttribute}="${dynamicType}"]`
const replayEventsByGateId = /* @__PURE__ */ new Map<
  string,
  Array<PendingReplayEvent>
>()

function getIntentListenerEvents(
  marker: Element,
  events: ReadonlyArray<string>,
) {
  const listenerEvents = new Set(events)

  marker.querySelectorAll(delegatedHydrateSelector).forEach((childMarker) => {
    if (childMarker.getAttribute(hydrateWhenAttribute) === dynamicType) {
      supportedInteractionEvents.forEach((eventName) => {
        listenerEvents.add(eventName)
      })
      return
    }

    const attr = childMarker.getAttribute(hydrateInteractionEventsAttribute)
    for (const eventName of attr === null
      ? defaultInteractionEvents
      : attr.split(/\s+/).filter(Boolean)) {
      listenerEvents.add(eventName)
    }
  })

  return [...listenerEvents]
}

function queueHydrationReplayEvent(marker: Element, event: Event) {
  if (!event.bubbles) return

  const id = marker.getAttribute(hydrateIdAttribute)
  const when = marker.getAttribute(hydrateWhenAttribute)
  if (!id || !when || when === 'never') return

  const target = event.target
  if (!target) return

  const gate = getMarkerGate(marker)
  if (gate?.resolved) return

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  let targetPath: Array<number> = []
  if (target instanceof Node && marker.contains(target)) {
    let node: Element | null =
      target instanceof Element ? target : target.parentElement

    while (node && node !== marker) {
      const parent = node.parentElement
      if (!parent) {
        targetPath = []
        break
      }
      targetPath.push(Array.prototype.indexOf.call(parent.children, node))
      node = parent
    }
    targetPath.reverse()
  }

  const pendingEvents = replayEventsByGateId.get(id) ?? []
  pendingEvents.push({
    marker,
    targetPath,
    type: event.type,
    event,
  })
  replayEventsByGateId.set(id, pendingEvents)
}

if (typeof document !== 'undefined') {
  const onIntent = (event: Event) => {
    const target = event.target
    if (!(target instanceof Element)) return

    let marker: Element | null = target.closest(hydrateIdSelector)
    const markers: Array<Element> = []
    let shouldHandle = false

    while (marker) {
      markers.push(marker)

      const when = marker.getAttribute(hydrateWhenAttribute)
      if (when === dynamicType) {
        shouldHandle ||= event.type === 'click'
      } else if (when === interactionType) {
        const attr = marker.getAttribute(hydrateInteractionEventsAttribute)
        const events: ReadonlyArray<string> =
          attr === null
            ? defaultInteractionEvents
            : attr.split(/\s+/).filter(Boolean)
        shouldHandle ||= events.includes(event.type)
      }

      marker = marker.parentElement?.closest(hydrateIdSelector) ?? null
    }

    if (!shouldHandle) return

    markers.reverse()
    if (markers.every((marker) => getMarkerGate(marker))) return

    markers.forEach((marker) => {
      queueHydrationReplayEvent(marker, event)
      resolveHydrationMarker(marker)
    })
  }

  supportedInteractionEvents.forEach((eventName) => {
    document.addEventListener(eventName, onIntent, true)
  })
}

function listenForIntent(
  element: Element,
  events: ReadonlyArray<string>,
  context: HydrationRuntimeContext,
) {
  const onIntent = (event: Event) => {
    const target = event.target
    let marker: Element | null
    if (target instanceof Element) {
      const closestMarker = target.closest(hydrateIdSelector)
      marker =
        closestMarker && element.contains(closestMarker)
          ? closestMarker
          : element
    } else {
      marker = element
    }

    const markers: Array<Element> = []
    while (marker) {
      if (marker.hasAttribute(hydrateIdAttribute)) {
        markers.push(marker)
      }
      if (marker === element) break
      marker = marker.parentElement
    }

    if (!markers.includes(element)) {
      markers.push(element)
    }

    markers.reverse()

    if (
      context.delegated &&
      !markers.some(
        (marker) =>
          marker.getAttribute(hydrateWhenAttribute) === interactionType ||
          marker.getAttribute(hydrateWhenAttribute) === dynamicType,
      )
    ) {
      return
    }

    markers.forEach((marker) => {
      queueHydrationReplayEvent(marker, event)
      resolveHydrationMarker(marker)
    })
  }
  let disposed = false

  events.forEach((eventName) => {
    element.addEventListener(eventName, onIntent, true)
  })

  return () => {
    if (disposed) return
    disposed = true
    events.forEach((eventName) => {
      element.removeEventListener(eventName, onIntent, true)
    })
  }
}

export function listenForDelegatedHydrationIntent(
  element: Element,
  context: HydrationRuntimeContext,
) {
  const listenerEvents = getIntentListenerEvents(element, [])
  if (!listenerEvents.length) return

  const cleanupIntent = listenForIntent(element, listenerEvents, {
    ...context,
    delegated: true,
  })
  return () => {
    cleanupIntent()
    clearResolvedGateIdsInMarker(element)
  }
}

/* @__NO_SIDE_EFFECTS__ */
export function interaction(
  options: InteractionHydrationOptions = {},
): HydrationPrefetchStrategy<typeof interactionType> {
  let events: ReadonlyArray<string> = defaultInteractionEvents
  if (options.events !== undefined) {
    const eventList: ReadonlyArray<string> =
      typeof options.events === 'string' ? [options.events] : options.events
    const normalizedEvents: Array<string> = []
    const seen = new Set<string>()

    for (const eventName of eventList) {
      if (!eventName || seen.has(eventName)) continue
      seen.add(eventName)
      normalizedEvents.push(eventName)
    }

    events = normalizedEvents
  }

  const eventKey = events.join(' ')

  return {
    _t: interactionType,
    _s: (context) => {
      const element = context.element
      if (!element) return
      const prefetch = context.prefetch
      if (prefetch) {
        if (!events.length) return
        let disposed = false

        events.forEach((eventName) => {
          element.addEventListener(eventName, prefetch, true)
        })

        return () => {
          if (disposed) return
          disposed = true
          events.forEach((eventName) => {
            element.removeEventListener(eventName, prefetch, true)
          })
        }
      }

      const listenerEvents = getIntentListenerEvents(element, events)
      const cleanupIntent = listenerEvents.length
        ? listenForIntent(element, listenerEvents, context)
        : undefined
      return () => {
        cleanupIntent?.()
        clearResolvedGateIdsInMarker(element)
      }
    },
    _o: (id) => {
      globalThis.requestAnimationFrame(() => {
        const pendingEvents = replayEventsByGateId.get(id)
        if (!pendingEvents?.length) return

        replayEventsByGateId.delete(id)

        for (const pendingEvent of pendingEvents) {
          let replayTarget: Element | null = pendingEvent.marker
          for (const index of pendingEvent.targetPath) {
            replayTarget = replayTarget.children[index] ?? null
            if (!replayTarget) break
          }

          const event = pendingEvent.event
          replayTarget ??= pendingEvent.marker
          replayTarget.dispatchEvent(
            event instanceof MouseEvent
              ? new MouseEvent(event.type, event)
              : event instanceof FocusEvent
                ? new FocusEvent(event.type, event)
                : new Event(event.type, event),
          )
        }
      })
    },
    _a: () =>
      options.events === undefined
        ? undefined
        : {
            [hydrateInteractionEventsAttribute]: eventKey,
          },
  }
}

import * as Solid from 'solid-js'
import { Dynamic } from 'solid-js/web'

import { useHydrated } from '@tanstack/solid-router'
import { isServer } from '@tanstack/router-core/isServer'
import {
  hydrateIdAttribute,
  hydrateWhenAttribute,
} from '@tanstack/start-client-core/hydration/constants'
import {
  createResolvedGate,
  getFallbackHtml,
  getOrCreateGate,
  onGateResolve,
  releaseGate,
  runHydrationStrategyCleanup,
  saveFallbackHtml,
  waitForHydrationPrefetchStrategy,
} from '@tanstack/start-client-core/hydration/runtime'
import { listenForDelegatedHydrationIntent } from '@tanstack/start-client-core/hydration'
import type {
  HydrationRuntimeContext,
  HydrationStrategy,
  HydrationWhen,
} from '@tanstack/start-client-core/hydration'
import type { HydrationGateRecord } from '@tanstack/start-client-core/hydration/runtime'
import type { InternalHydrateProps } from './Hydrate'
import type { DynamicProps } from 'solid-js/web'

type HydrationFallbackDynamicProps = DynamicProps<'div'>
type HydrationMarkerDynamicProps = DynamicProps<'div'> & {
  [hydrateIdAttribute]: string
  [hydrateWhenAttribute]: HydrationWhen
  [key: `data-${string}`]: string | undefined
}
type PrefetchController = {
  abortController: AbortController
  hydrationRequested: boolean
  hydrationListeners: Set<() => void>
  hydrationResolvePending: boolean
  started: boolean
  promise?: Promise<void>
}

const hydrateIdSelector = `[${hydrateIdAttribute}]`
const dynamicType = 'dynamic'
const dynamicHydrateStrategy = {
  _t: dynamicType,
  _d: () => true,
} satisfies HydrationStrategy<typeof dynamicType, false>

function shouldDeferHydration(strategy: HydrationStrategy) {
  return strategy._d ? strategy._d() : strategy._t !== 'load'
}

/* @__NO_SIDE_EFFECTS__ */
function HydratedBoundary(props: {
  id: string
  onHydrated?: () => void
  onStrategyHydrated?: (id: string) => void
  children: Solid.JSX.Element
}) {
  let didHydrate = false

  Solid.onMount(() => {
    if (didHydrate) return
    didHydrate = true
    props.onHydrated?.()
    props.onStrategyHydrated?.(props.id)
  })

  return props.children
}

/* @__NO_SIDE_EFFECTS__ */
export function GenericHydrate(props: InternalHydrateProps) {
  const when = props.when
  const dynamicHydrate = typeof when === 'function'
  const initialHydrateStrategy: HydrationStrategy = dynamicHydrate
    ? // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      (isServer ?? typeof window === 'undefined')
      ? dynamicHydrateStrategy
      : when()
    : when
  const markerHydrateType: HydrationWhen = dynamicHydrate
    ? dynamicType
    : initialHydrateStrategy._t!
  const prefetchStrategy = () => props.prefetch
  const hydrated = useHydrated()
  const uniqueId = Solid.createUniqueId()
  const id = props.h ? `${props.h}${uniqueId}` : uniqueId
  const initialHydrateType = initialHydrateStrategy._t!
  const shouldPreserveServerHTML =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (isServer ?? typeof window === 'undefined') || !hydrated()
  const shouldDeferInitialHydration =
    !hydrated() && shouldDeferHydration(initialHydrateStrategy)
  const gate: HydrationGateRecord =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (isServer ?? typeof window === 'undefined')
      ? createResolvedGate(id, initialHydrateType)
      : getOrCreateGate(id, initialHydrateType)
  const [ready, setReady] = Solid.createSignal(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (isServer ?? typeof window === 'undefined') ||
      (!shouldDeferInitialHydration && initialHydrateType !== 'never'),
  )
  const [prefetchError, setPrefetchError] = Solid.createSignal<unknown>()
  const controller: PrefetchController = {
    abortController: new AbortController(),
    hydrationRequested: false,
    hydrationListeners: new Set<() => void>(),
    hydrationResolvePending: false,
    started: false,
  }
  let didPrefetch = false
  let markerElement: HTMLDivElement | undefined

  if (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    !(isServer ?? typeof window === 'undefined') &&
    initialHydrateType !== 'never' &&
    (!shouldDeferInitialHydration ||
      !shouldDeferHydration(initialHydrateStrategy))
  ) {
    gate.resolve()
  }

  const onHydrate = (listener: () => void) => {
    if (controller.hydrationRequested) {
      listener()
      return () => {}
    }

    controller.hydrationListeners.add(listener)
    return () => {
      controller.hydrationListeners.delete(listener)
    }
  }

  const requestHydration = () => {
    if (!controller.hydrationRequested) {
      controller.hydrationRequested = true
      controller.hydrationListeners.forEach((listener) => listener())
      controller.hydrationListeners.clear()
    }

    if (!controller.promise) {
      resolveGate()
      return
    }
    if (controller.hydrationResolvePending) return
    controller.hydrationResolvePending = true

    controller.promise.then(
      () => resolveGate(),
      (error) => {
        if (!controller.abortController.signal.aborted) {
          setPrefetchError(() => error)
        }
      },
    )
  }
  const resolveGate = gate.resolve

  Solid.onMount(() => {
    const currentHydrateStrategy = initialHydrateStrategy
    const currentPrefetchStrategy = prefetchStrategy()
    const currentHydrateType = currentHydrateStrategy._t!
    gate.when = currentHydrateType
    for (const element of document.querySelectorAll<HTMLDivElement>(
      hydrateIdSelector,
    )) {
      if (element.getAttribute(hydrateIdAttribute) === id) {
        markerElement = element
        saveFallbackHtml(id, element)
        break
      }
    }

    if (
      currentHydrateType === 'never' &&
      !shouldPreserveServerHTML &&
      markerElement
    ) {
      markerElement.replaceChildren()
    }

    if (currentPrefetchStrategy && !controller.started) {
      controller.started = true
      const preload = () => props.p?.() ?? Promise.resolve()

      if (typeof currentPrefetchStrategy === 'function') {
        const promise = Promise.resolve()
          .then(() =>
            currentPrefetchStrategy({
              element: markerElement ?? null,
              signal: controller.abortController.signal,
              preload,
              waitFor: (strategy) =>
                waitForHydrationPrefetchStrategy(strategy, {
                  element: markerElement ?? null,
                  signal: controller.abortController.signal,
                  onHydrate,
                }),
            }),
          )
          .then(() => undefined)

        controller.promise = promise
        promise.catch((error) => {
          if (!controller.abortController.signal.aborted) {
            setPrefetchError(() => error)
          }
        })
      } else if (props.p) {
        const currentStrategy = currentPrefetchStrategy
        const prefetch = () => {
          if (didPrefetch) return
          didPrefetch = true
          void preload()
        }
        const cleanupPrefetch = runHydrationStrategyCleanup(
          currentStrategy._s?.({
            element: markerElement ?? null,
            prefetch,
          }),
        )
        if (cleanupPrefetch) Solid.onCleanup(cleanupPrefetch)
      }
    }

    if (
      currentHydrateType !== 'never' &&
      (!shouldDeferInitialHydration ||
        !shouldDeferHydration(currentHydrateStrategy))
    ) {
      gate.resolve()
      setReady(true)
    }

    const cleanups: Array<() => void> = []
    let removeResolveListener = () => {}
    let disposed = false

    const resolveBoundary = () => {
      setReady(true)
    }

    const cleanup = () => {
      if (disposed) return
      disposed = true
      if (gate.resolve === requestHydration) {
        gate.resolve = resolveGate
      }
      removeResolveListener()
      cleanups.forEach((fn) => fn())
    }

    const addCleanup = (fn: void | (() => void)) => {
      if (!fn) return
      if (disposed || gate.resolved) {
        fn()
        return
      }
      cleanups.push(fn)
    }

    Solid.onCleanup(() => {
      controller.abortController.abort()
      controller.hydrationListeners.clear()
      cleanup()
      releaseGate(gate)
    })

    removeResolveListener = onGateResolve(gate, () => {
      cleanup()
      resolveBoundary()
    })

    if (
      gate.resolved ||
      !shouldDeferInitialHydration ||
      currentHydrateType === 'never'
    ) {
      if (gate.resolved) resolveBoundary()
      return
    }

    gate.resolve = requestHydration
    const context: HydrationRuntimeContext = {
      element: markerElement ?? null,
      gate,
    }
    addCleanup(
      runHydrationStrategyCleanup(currentHydrateStrategy._s?.(context)),
    )

    if (currentHydrateStrategy._t !== 'interaction') {
      addCleanup(
        runHydrationStrategyCleanup(
          markerElement
            ? listenForDelegatedHydrationIntent(markerElement, context)
            : undefined,
        ),
      )
    }
  })

  Solid.createRenderEffect(() => {
    if (
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      (isServer ?? typeof window === 'undefined') ||
      gate.resolved ||
      initialHydrateStrategy._t === 'never' ||
      shouldDeferHydration(initialHydrateStrategy)
    ) {
      return
    }

    gate.resolve()
  })

  const markerAttributes =
    markerHydrateType === dynamicType
      ? undefined
      : initialHydrateStrategy._a?.()
  const markerProps: HydrationMarkerDynamicProps = {
    component: 'div',
    [hydrateIdAttribute]: id,
    [hydrateWhenAttribute]: markerHydrateType,
    ...markerAttributes,
  }
  const fallback = () => {
    if (!shouldPreserveServerHTML) return props.fallback ?? null

    const html = getFallbackHtml(id)
    if (!html) return null

    const fallbackProps: HydrationFallbackDynamicProps = {
      component: 'div',
      style: { display: 'contents' },
      innerHTML: html,
    }

    return <Dynamic {...fallbackProps} />
  }

  return (
    <Dynamic {...markerProps}>
      {(() => {
        const error = prefetchError()
        if (error) throw error
        return null
      })()}
      {initialHydrateType === 'never' && !shouldPreserveServerHTML ? (
        (props.fallback ?? null)
      ) : (
        <Solid.Suspense fallback={fallback()}>
          <Solid.Show when={ready()} fallback={fallback()}>
            <HydratedBoundary
              id={id}
              onHydrated={props.onHydrated}
              onStrategyHydrated={(id) => {
                markerElement?.removeAttribute(hydrateWhenAttribute)
                initialHydrateStrategy._o?.(id)
              }}
            >
              {props.children}
            </HydratedBoundary>
          </Solid.Show>
        </Solid.Suspense>
      )}
    </Dynamic>
  )
}

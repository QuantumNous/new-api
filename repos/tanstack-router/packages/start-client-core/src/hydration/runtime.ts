import { hydrateIdAttribute, hydrateWhenAttribute } from './constants'
import type {
  HydrationPrefetchStrategy,
  HydrationPrefetchWaitReason,
  HydrationRuntimeGate,
  HydrationWhen,
} from './types'

const hydrateIdSelector = `[${hydrateIdAttribute}]`

export type HydrationGateRecord = HydrationRuntimeGate & {
  id: string
  when: HydrationWhen
  promise: Promise<void>
  consumers: number
  resolveListeners: Set<() => void>
}

const gateRegistry = /* @__PURE__ */ new Map<string, HydrationGateRecord>()
const resolvedGateIds = /* @__PURE__ */ new Set<string>()
const fallbackHtmlByGateId = /* @__PURE__ */ new Map<string, string>()

export function createResolvedGate(
  id: string,
  when: HydrationWhen,
): HydrationGateRecord {
  return {
    id,
    when,
    promise: Promise.resolve(),
    resolve: () => {},
    resolved: true,
    consumers: 0,
    resolveListeners: new Set<() => void>(),
  }
}

export function getOrCreateGate(
  id: string,
  when: HydrationWhen,
): HydrationGateRecord {
  const existing = gateRegistry.get(id)
  if (existing?.when === when) {
    existing.consumers++
    return existing
  }

  let resolvePromise!: () => void
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
  })

  const gate: HydrationGateRecord = {
    id,
    promise,
    resolved: false,
    consumers: 1,
    when,
    resolveListeners: new Set(),
    resolve: () => {
      if (gate.resolved) return
      gate.resolved = true
      resolvePromise()
      gate.resolveListeners.forEach((listener) => listener())
      gate.resolveListeners.clear()
    },
  }

  gateRegistry.set(id, gate)
  if (when !== 'never' && resolvedGateIds.has(id)) {
    resolvedGateIds.delete(id)
    gate.resolve()
  }
  return gate
}

export function releaseGate(gate: HydrationGateRecord) {
  resolvedGateIds.delete(gate.id)
  gate.consumers--
  if (gate.consumers > 0) return
  if (gateRegistry.get(gate.id) === gate) {
    gateRegistry.delete(gate.id)
    fallbackHtmlByGateId.delete(gate.id)
    gate.resolveListeners.clear()
  }
}

export function onGateResolve(gate: HydrationGateRecord, listener: () => void) {
  if (gate.resolved) {
    listener()
    return () => {}
  }

  gate.resolveListeners.add(listener)
  return () => {
    gate.resolveListeners.delete(listener)
  }
}

export function runHydrationStrategyCleanup(cleanup: void | (() => void)) {
  if (typeof cleanup === 'function') return cleanup
  return undefined
}

export function waitForHydrationPrefetchStrategy(
  strategy: HydrationPrefetchStrategy,
  options: {
    element: Element | null
    signal: AbortSignal
    onHydrate: (listener: () => void) => () => void
  },
): Promise<HydrationPrefetchWaitReason> {
  if (options.signal.aborted) {
    return Promise.resolve('abort')
  }

  return new Promise((resolve) => {
    const state = { disposed: false }
    const cleanupStrategyRef: { current: void | (() => void) } = {
      current: undefined,
    }
    let cleanupHydrate = () => {}

    const finish = (reason: HydrationPrefetchWaitReason) => {
      if (state.disposed) return
      state.disposed = true
      options.signal.removeEventListener('abort', onAbort)
      cleanupHydrate()
      runHydrationStrategyCleanup(cleanupStrategyRef.current)?.()
      resolve(reason)
    }

    const onAbort = () => finish('abort')

    options.signal.addEventListener('abort', onAbort, { once: true })
    cleanupHydrate = options.onHydrate(() => finish('hydrate'))
    const cleanupStrategy = strategy._s?.({
      element: options.element,
      prefetch: () => finish('prefetch'),
    })
    cleanupStrategyRef.current = cleanupStrategy
    if (state.disposed) {
      runHydrationStrategyCleanup(cleanupStrategy)?.()
    }
  })
}

export function getMarkerGate(marker: Element) {
  const id = marker.getAttribute(hydrateIdAttribute)
  return id ? gateRegistry.get(id) : undefined
}

export function resolveHydrationMarker(marker: Element) {
  const id = marker.getAttribute(hydrateIdAttribute)
  const when = marker.getAttribute(hydrateWhenAttribute)
  if (!id || !when || when === 'never') {
    return
  }

  const gate = gateRegistry.get(id)
  if (gate) {
    if (gate.when !== 'never') gate.resolve()
    return
  }

  resolvedGateIds.add(id)
}

export function clearResolvedGateIdsInMarker(marker: Element) {
  const ownId = marker.getAttribute(hydrateIdAttribute)
  if (ownId) {
    resolvedGateIds.delete(ownId)
  }

  marker.querySelectorAll(hydrateIdSelector).forEach((childMarker) => {
    const childId = childMarker.getAttribute(hydrateIdAttribute)
    if (childId) {
      resolvedGateIds.delete(childId)
    }
  })
}

export function saveFallbackHtml(id: string, element: Element) {
  if (!fallbackHtmlByGateId.has(id)) {
    fallbackHtmlByGateId.set(id, element.innerHTML)
  }
}

export function getFallbackHtml(id: string) {
  return fallbackHtmlByGateId.get(id)
}

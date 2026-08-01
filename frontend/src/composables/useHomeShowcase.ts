import { computed, getCurrentScope, onScopeDispose, ref } from 'vue'

import {
  HOME_LAUNCHED_AT,
  HOME_MARKET_LISTINGS,
  HOME_REQUEST_SEED,
  HOME_SELL_LISTINGS,
  HOME_TOKEN_ROUTES,
} from '@/constants/home/showcase'
import type {
  HomeExchangeStage,
  HomeMarketListing,
  HomeMarketMode,
  HomeRouteChannel,
  HomeRouteMode,
  HomeRouteSimulation,
  HomeRuntime,
  HomeTokenRoute,
} from '@/types/homeShowcase'

const EMPTY_SIMULATION: HomeRouteSimulation = {
  eventId: 0,
  phase: 'idle',
  primaryChannelId: null,
  fallbackChannelId: null,
  activeChannelId: null,
  latency: null,
}

export function calculateRuntime(
  now: number,
  launchedAt = HOME_LAUNCHED_AT
): HomeRuntime {
  const total = Math.max(0, Math.floor((now - Date.parse(launchedAt)) / 1000))
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  }
}

export function clampRouteWeight(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(100, Math.max(1, Math.round(value)))
}

export function reorderRouteChannels(
  channels: HomeRouteChannel[],
  channelId: string,
  targetIndex: number
): boolean {
  const currentIndex = channels.findIndex((channel) => channel.id === channelId)
  if (currentIndex < 0 || channels.length < 2) return false
  const boundedTarget = Math.min(
    channels.length - 1,
    Math.max(0, Math.round(targetIndex))
  )
  if (currentIndex === boundedTarget) return false
  const [channel] = channels.splice(currentIndex, 1)
  channels.splice(boundedTarget, 0, channel)
  return true
}

const ROUTE_HEALTH_RANK: Record<HomeRouteChannel['health'], number> = {
  online: 0,
  degraded: 1,
  offline: 2,
}

export function rankRouteChannels(
  channels: HomeRouteChannel[]
): HomeRouteChannel[] {
  const originalIndex = new Map(
    channels.map((channel, index) => [channel.id, index])
  )

  return [...channels].sort((left, right) => {
    const health =
      ROUTE_HEALTH_RANK[left.health] - ROUTE_HEALTH_RANK[right.health]
    if (health !== 0) return health
    if (left.latency !== right.latency) return left.latency - right.latency
    if (left.qualityScore !== right.qualityScore) {
      return right.qualityScore - left.qualityScore
    }
    return originalIndex.get(left.id)! - originalIndex.get(right.id)!
  })
}

export function selectRoutePrimary(
  channels: HomeRouteChannel[],
  loadBalance: boolean,
  eventId: number
): HomeRouteChannel | null {
  const candidates = channels.filter(
    (channel) => channel.enabled && channel.health !== 'offline'
  )
  if (candidates.length === 0) return null
  if (!loadBalance) return candidates[0] ?? null

  const totalWeight = candidates.reduce(
    (total, channel) => total + channel.weight,
    0
  )
  let cursor = (Math.max(1, eventId) * 37 + 11) % totalWeight
  for (const channel of candidates) {
    cursor -= channel.weight
    if (cursor < 0) return channel
  }
  return candidates[0] ?? null
}

function cloneListing(listing: HomeMarketListing): HomeMarketListing {
  return { ...listing }
}

function cloneToken(token: HomeTokenRoute): HomeTokenRoute {
  return {
    ...token,
    channels: token.channels.map((channel) => ({ ...channel })),
  }
}

export function useHomeShowcase() {
  const now = ref(Date.now())
  const demoRequests = ref(HOME_REQUEST_SEED)
  const sectionVisible = ref(true)
  const marketMode = ref<HomeMarketMode>('buy')
  const exchangeStage = ref<HomeExchangeStage>('draft')
  const marketListings = ref(HOME_MARKET_LISTINGS.map(cloneListing))
  const sellListings = ref(HOME_SELL_LISTINGS.map(cloneListing))
  const tokens = ref(HOME_TOKEN_ROUTES.map(cloneToken))
  const activeTokenId = ref<HomeTokenRoute['id']>('production-key')
  const routeSimulation = ref<HomeRouteSimulation>({ ...EMPTY_SIMULATION })
  const simulationTimers = new Set<ReturnType<typeof setTimeout>>()
  let intervalId: number | null = null
  let disposed = false

  const runtime = computed(() => calculateRuntime(now.value))
  const activeToken = computed(
    () =>
      tokens.value.find((token) => token.id === activeTokenId.value) ??
      tokens.value[0]!
  )
  const activeChannels = computed(() => activeToken.value.channels)

  function stopClock() {
    if (intervalId !== null) window.clearInterval(intervalId)
    intervalId = null
  }

  function clearSimulationTimers() {
    for (const timer of simulationTimers) window.clearTimeout(timer)
    simulationTimers.clear()
  }

  function resetSimulation() {
    clearSimulationTimers()
    routeSimulation.value = {
      ...EMPTY_SIMULATION,
      eventId: routeSimulation.value.eventId,
    }
  }

  function syncClock() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    stopClock()
    if (
      !sectionVisible.value ||
      document.visibilityState === 'hidden' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }
    intervalId = window.setInterval(() => {
      now.value = Date.now()
      demoRequests.value += 5
    }, 1_000)
  }

  function setSectionVisible(next: boolean) {
    sectionVisible.value = next
    if (!next) resetSimulation()
    syncClock()
  }

  function setMarketMode(next: HomeMarketMode) {
    marketMode.value = next
  }

  function publishListing(listingId: string): boolean {
    const listing = sellListings.value.find((item) => item.id === listingId)
    if (!listing || listing.status !== 'draft') return false
    listing.status = 'published'
    exchangeStage.value = 'published'
    if (!marketListings.value.some((item) => item.id === listing.id)) {
      marketListings.value.unshift({ ...listing, status: 'available' })
    }
    return true
  }

  function purchaseListing(listingId: string): boolean {
    const listing = marketListings.value.find((item) => item.id === listingId)
    if (!listing || listing.status !== 'available') return false
    listing.status = 'purchased'
    exchangeStage.value = 'purchased'
    return true
  }

  function bindListing(listingId: string): boolean {
    const listing = marketListings.value.find((item) => item.id === listingId)
    if (!listing || listing.status !== 'purchased') return false
    if (
      !activeToken.value.channels.some((item) => item.listingId === listing.id)
    ) {
      activeToken.value.channels.push({
        id: `bound-${activeToken.value.id}-${listing.id}`,
        listingId: listing.id,
        name: listing.provider,
        nameKey: null,
        provider: listing.provider,
        model: listing.model,
        source: 'market',
        weight: 20,
        enabled: true,
        latency: 264,
        qualityScore: listing.qualityScore,
        health: 'online',
      })
    }
    listing.status = 'bound'
    exchangeStage.value = 'bound'
    return true
  }

  function setActiveToken(tokenId: HomeTokenRoute['id']) {
    if (!tokens.value.some((token) => token.id === tokenId)) return
    activeTokenId.value = tokenId
    resetSimulation()
  }

  function setRouteMode(mode: HomeRouteMode) {
    activeToken.value.mode = mode
    resetSimulation()
  }

  function reorderActiveChannel(channelId: string, targetIndex: number) {
    return reorderRouteChannels(
      activeToken.value.channels,
      channelId,
      targetIndex
    )
  }

  function moveActiveChannel(channelId: string, direction: -1 | 1) {
    const index = activeToken.value.channels.findIndex(
      (channel) => channel.id === channelId
    )
    if (index < 0) return false
    return reorderActiveChannel(channelId, index + direction)
  }

  function setChannelWeight(channelId: string, weight: number) {
    const channel = activeToken.value.channels.find(
      (item) => item.id === channelId
    )
    if (!channel) return false
    channel.weight = clampRouteWeight(weight)
    return true
  }

  function toggleChannel(channelId: string) {
    const channel = activeToken.value.channels.find(
      (item) => item.id === channelId
    )
    if (!channel) return false
    channel.enabled = !channel.enabled
    resetSimulation()
    return true
  }

  function setLoadBalance(enabled: boolean) {
    activeToken.value.loadBalance = enabled
    resetSimulation()
  }

  function applyResponse(
    primary: HomeRouteChannel,
    fallback: HomeRouteChannel | null
  ) {
    const active = fallback ?? primary
    routeSimulation.value = {
      ...routeSimulation.value,
      phase: 'responded',
      fallbackChannelId: fallback?.id ?? null,
      activeChannelId: active.id,
      latency: fallback ? primary.latency + fallback.latency : primary.latency,
    }
    demoRequests.value += 1
  }

  function scheduleSimulation(callback: () => void, delay: number) {
    const timer = window.setTimeout(() => {
      simulationTimers.delete(timer)
      if (!disposed) callback()
    }, delay)
    simulationTimers.add(timer)
  }

  function simulateRequest(): boolean {
    clearSimulationTimers()
    const eventId = routeSimulation.value.eventId + 1
    const simulationChannels =
      activeToken.value.mode === 'auto'
        ? rankRouteChannels(activeToken.value.channels)
        : activeToken.value.channels
    const primary = selectRoutePrimary(
      simulationChannels,
      activeToken.value.loadBalance,
      eventId
    )
    if (!primary) {
      routeSimulation.value = {
        ...EMPTY_SIMULATION,
        eventId,
        phase: 'unavailable',
      }
      return false
    }

    const candidates = simulationChannels.filter(
      (channel) =>
        channel.enabled &&
        channel.health === 'online' &&
        channel.id !== primary.id
    )
    const fallback = candidates[0] ?? null
    routeSimulation.value = {
      eventId,
      phase: 'sending',
      primaryChannelId: primary.id,
      fallbackChannelId: fallback?.id ?? null,
      activeChannelId: primary.id,
      latency: null,
    }

    const shouldFail = primary.health === 'degraded'
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    if (reducedMotion) {
      if (shouldFail && !fallback) {
        routeSimulation.value = {
          ...routeSimulation.value,
          phase: 'unavailable',
          activeChannelId: null,
        }
        return false
      }
      applyResponse(primary, shouldFail ? fallback : null)
      return true
    }

    if (!shouldFail) {
      scheduleSimulation(() => applyResponse(primary, null), 760)
      return true
    }

    scheduleSimulation(() => {
      routeSimulation.value = {
        ...routeSimulation.value,
        phase: 'failed',
      }
      if (!fallback) {
        routeSimulation.value = {
          ...routeSimulation.value,
          phase: 'unavailable',
          activeChannelId: null,
        }
        return
      }
      scheduleSimulation(() => {
        routeSimulation.value = {
          ...routeSimulation.value,
          phase: 'switching',
          activeChannelId: fallback.id,
        }
        scheduleSimulation(() => applyResponse(primary, fallback), 420)
      }, 320)
    }, 420)
    return true
  }

  function handleVisibilityChange() {
    now.value = Date.now()
    if (document.visibilityState === 'hidden') resetSimulation()
    syncClock()
  }

  function dispose() {
    if (disposed) return
    disposed = true
    stopClock()
    clearSimulationTimers()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    syncClock()
  }
  if (getCurrentScope()) onScopeDispose(dispose)

  return {
    runtime,
    demoRequests,
    marketMode,
    exchangeStage,
    marketListings,
    sellListings,
    tokens,
    activeTokenId,
    activeToken,
    activeChannels,
    routeSimulation,
    setSectionVisible,
    setMarketMode,
    publishListing,
    purchaseListing,
    bindListing,
    setActiveToken,
    setRouteMode,
    reorderActiveChannel,
    moveActiveChannel,
    setChannelWeight,
    toggleChannel,
    setLoadBalance,
    simulateRequest,
    resetSimulation,
    dispose,
  }
}

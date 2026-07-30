import { computed, getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue'

import {
  HOME_STARTED_AT,
  LOCAL_HOME_SHOWCASE_SOURCE,
} from '@/constants/home/showcase'
import type {
  HomeDiscountTier,
  HomeMarketJourneyStage,
  HomeMarketListing,
  HomeMarketSide,
  HomeRouteChannel,
  HomeRouteSimulation,
  HomeRunningMetrics,
  HomeRuntimeBreakdown,
  HomeShowcaseSnapshot,
  HomeShowcaseSource,
} from '@/types/homeShowcase'

const DEFAULT_RUNTIME: HomeRunningMetrics = {
  startedAt: HOME_STARTED_AT,
  requestSeed: 0,
  requestsPerSecond: 0,
  requestsPerTick: 0,
  tickIntervalMs: 1_000,
}

const EMPTY_SIMULATION: HomeRouteSimulation = {
  eventId: 0,
  phase: 'idle',
  primaryChannelId: null,
  fallbackChannelId: null,
  activeChannelId: null,
  latencyMs: null,
}

const FAILOVER_DELAY_MS = 300
const RESPONSE_DELAY_MS = 380

export interface UseHomeShowcaseOptions {
  source?: HomeShowcaseSource
  immediate?: boolean
  now?: () => number
}

export function calculateHomeRuntime(
  now: number | Date,
  startedAt: string | number | Date = HOME_STARTED_AT
): HomeRuntimeBreakdown {
  const nowMs = now instanceof Date ? now.getTime() : now
  const startMs =
    startedAt instanceof Date
      ? startedAt.getTime()
      : typeof startedAt === 'number'
        ? startedAt
        : Date.parse(startedAt)
  const elapsedMs =
    Number.isFinite(nowMs) && Number.isFinite(startMs)
      ? Math.max(0, nowMs - startMs)
      : 0
  const totalSeconds = Math.floor(elapsedMs / 1_000)

  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
  }
}

function localDateKey(now: number | Date): string {
  const date = now instanceof Date ? now : new Date(now)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function stableDateOffset(dateKey: string, seed: number): number {
  let hash = seed >>> 0
  for (let index = 0; index < dateKey.length; index += 1) {
    hash = Math.imul(hash ^ dateKey.charCodeAt(index), 16_777_619) >>> 0
  }
  return hash % 211
}

export function calculateDeterministicTodayRequests(
  now: number | Date,
  metrics: HomeRunningMetrics
): number {
  const date = now instanceof Date ? now : new Date(now)
  if (!Number.isFinite(date.getTime())) return 0
  const seconds =
    date.getHours() * 3_600 + date.getMinutes() * 60 + date.getSeconds()
  return Math.max(
    0,
    Math.floor(seconds * metrics.requestsPerSecond) +
      stableDateOffset(localDateKey(date), metrics.requestSeed)
  )
}

export function resolveHomeDiscountTier(
  tokenUsage: number,
  tiers: readonly HomeDiscountTier[]
): HomeDiscountTier | null {
  if (tiers.length === 0) return null
  const safeUsage = Number.isFinite(tokenUsage) ? Math.max(0, tokenUsage) : 0
  return (
    [...tiers]
      .sort((a, b) => b.thresholdTokens - a.thresholdTokens)
      .find((tier) => safeUsage >= tier.thresholdTokens) ?? tiers[0]
  )
}

function normalizePriorities(channels: HomeRouteChannel[]): void {
  channels.forEach((channel, index) => {
    channel.priority = index + 1
  })
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function useHomeShowcase(options: UseHomeShowcaseOptions = {}) {
  const source = options.source ?? LOCAL_HOME_SHOWCASE_SOURCE
  const now = options.now ?? Date.now

  const loading = ref(false)
  const error = shallowRef<unknown>(null)
  const snapshot = shallowRef<HomeShowcaseSnapshot | null>(null)
  const marketSide = ref<HomeMarketSide>('buy')
  const marketListings = ref<HomeMarketListing[]>([])
  const routeChannels = ref<HomeRouteChannel[]>([])
  const loadBalance = ref(false)
  const discountTiers = ref<HomeDiscountTier[]>([])
  const accountTokens = ref(0)
  const exampleSpendUsd = ref(0)
  const activities = ref<HomeShowcaseSnapshot['activities']>([])
  const running = ref<HomeRunningMetrics>(DEFAULT_RUNTIME)
  const runtime = ref<HomeRuntimeBreakdown>(calculateHomeRuntime(now()))
  const todayRequests = ref(0)
  const qualityReports = ref<HomeShowcaseSnapshot['qualityReports']>([])
  const supportLinks = ref<HomeShowcaseSnapshot['supportLinks']>([])
  const routeSimulation = ref<HomeRouteSimulation>({ ...EMPTY_SIMULATION })

  let loadController: AbortController | null = null
  let loadSequence = 0
  let counterTimer: ReturnType<typeof setInterval> | undefined
  let requestDateKey = localDateKey(now())
  let sectionVisible = true
  let pageVisible =
    typeof document === 'undefined' || document.visibilityState !== 'hidden'
  let disposed = false
  const simulationTimers = new Set<ReturnType<typeof setTimeout>>()

  const journeyListing = computed(
    () => marketListings.value.find((listing) => listing.journey) ?? null
  )
  const marketJourneyStage = computed<HomeMarketJourneyStage>(() => {
    const listing = journeyListing.value
    if (!listing) return 'draft'
    if (
      routeChannels.value.some((channel) => channel.listingId === listing.id)
    ) {
      return 'bound'
    }
    return listing.status
  })
  const activeDiscountTier = computed(() =>
    resolveHomeDiscountTier(accountTokens.value, discountTiers.value)
  )
  const nextDiscountTier = computed(() => {
    return (
      [...discountTiers.value]
        .sort((a, b) => a.thresholdTokens - b.thresholdTokens)
        .find((tier) => tier.thresholdTokens > accountTokens.value) ?? null
    )
  })
  const discountPaymentRate = computed(
    () => 1 - (activeDiscountTier.value?.discountRate ?? 0)
  )
  const discountedSpendUsd = computed(
    () => exampleSpendUsd.value * discountPaymentRate.value
  )
  const discountSavingsUsd = computed(
    () => exampleSpendUsd.value - discountedSpendUsd.value
  )
  const configuredSupportLinks = computed(() =>
    supportLinks.value.filter(
      (link) => link.kind === 'route' || Boolean(link.href)
    )
  )

  function clearSimulationTimers(): void {
    for (const timer of simulationTimers) clearTimeout(timer)
    simulationTimers.clear()
  }

  function scheduleSimulation(callback: () => void, delay: number): void {
    const timer = setTimeout(() => {
      simulationTimers.delete(timer)
      if (!disposed) callback()
    }, delay)
    simulationTimers.add(timer)
  }

  function stopCounter(): void {
    if (counterTimer === undefined) return
    clearInterval(counterTimer)
    counterTimer = undefined
  }

  function updateCounters(): void {
    const timestamp = now()
    runtime.value = calculateHomeRuntime(timestamp, running.value.startedAt)
    const nextDateKey = localDateKey(timestamp)
    if (nextDateKey !== requestDateKey) {
      requestDateKey = nextDateKey
      todayRequests.value = calculateDeterministicTodayRequests(
        timestamp,
        running.value
      )
      return
    }
    todayRequests.value += running.value.requestsPerTick
  }

  function startCounter(): void {
    stopCounter()
    if (
      disposed ||
      !snapshot.value ||
      !sectionVisible ||
      !pageVisible ||
      running.value.tickIntervalMs <= 0
    ) {
      return
    }
    counterTimer = setInterval(updateCounters, running.value.tickIntervalMs)
  }

  function applySnapshot(value: HomeShowcaseSnapshot): void {
    snapshot.value = value
    marketListings.value = value.market.listings
    routeChannels.value = value.routing.channels
    normalizePriorities(routeChannels.value)
    loadBalance.value = value.routing.loadBalance
    discountTiers.value = value.discount.tiers
    accountTokens.value = value.discount.accountTokens
    exampleSpendUsd.value = value.discount.exampleSpendUsd
    activities.value = value.activities
    running.value = value.running
    qualityReports.value = value.qualityReports
    supportLinks.value = value.supportLinks

    const timestamp = now()
    requestDateKey = localDateKey(timestamp)
    runtime.value = calculateHomeRuntime(timestamp, value.running.startedAt)
    todayRequests.value = calculateDeterministicTodayRequests(
      timestamp,
      value.running
    )
    startCounter()
  }

  async function load(): Promise<void> {
    const sequence = ++loadSequence
    loadController?.abort()
    const controller = new AbortController()
    loadController = controller
    loading.value = true
    error.value = null

    try {
      const value = await source.load(controller.signal)
      if (disposed || sequence !== loadSequence || controller.signal.aborted) {
        return
      }
      applySnapshot(value)
    } catch (reason) {
      if (disposed || sequence !== loadSequence || controller.signal.aborted) {
        return
      }
      error.value = reason
    } finally {
      if (sequence === loadSequence) loading.value = false
    }
  }

  function setMarketSide(side: HomeMarketSide): void {
    marketSide.value = side
  }

  function publishListing(listingId = journeyListing.value?.id): boolean {
    const listing = marketListings.value.find((item) => item.id === listingId)
    if (!listing || listing.status !== 'draft') return false
    listing.status = 'listed'
    return true
  }

  function purchaseListing(listingId = journeyListing.value?.id): boolean {
    const listing = marketListings.value.find((item) => item.id === listingId)
    if (!listing || listing.status !== 'listed') return false
    listing.status = 'purchased'
    listing.owned = true
    return true
  }

  function bindListingToRoute(listingId = journeyListing.value?.id): boolean {
    const listing = marketListings.value.find((item) => item.id === listingId)
    if (!listing || !listing.owned || listing.status !== 'purchased') {
      return false
    }
    if (
      routeChannels.value.some((channel) => channel.listingId === listing.id)
    ) {
      return false
    }

    routeChannels.value.push({
      id: `route-${listing.id}`,
      listingId: listing.id,
      nameKey: listing.titleKey,
      vendor: listing.vendor,
      model: listing.model,
      source: 'market',
      enabled: true,
      weight: 20,
      priority: routeChannels.value.length + 1,
      health: 'healthy',
      latencyMs: 488,
      qualityScore: listing.qualityScore,
    })
    normalizePriorities(routeChannels.value)
    return true
  }

  function reorderRoute(channelId: string, targetIndex: number): boolean {
    const currentIndex = routeChannels.value.findIndex(
      (channel) => channel.id === channelId
    )
    if (currentIndex < 0 || routeChannels.value.length < 2) return false
    const boundedIndex = clampInteger(
      targetIndex,
      0,
      routeChannels.value.length - 1
    )
    if (currentIndex === boundedIndex) return false
    const [channel] = routeChannels.value.splice(currentIndex, 1)
    routeChannels.value.splice(boundedIndex, 0, channel)
    normalizePriorities(routeChannels.value)
    return true
  }

  function moveRoute(channelId: string, direction: -1 | 1): boolean {
    const index = routeChannels.value.findIndex(
      (channel) => channel.id === channelId
    )
    if (index < 0) return false
    return reorderRoute(channelId, index + direction)
  }

  function toggleRouteChannel(channelId: string): boolean {
    const channel = routeChannels.value.find((item) => item.id === channelId)
    if (!channel) return false
    channel.enabled = !channel.enabled
    return true
  }

  function setRouteWeight(channelId: string, weight: number): boolean {
    const channel = routeChannels.value.find((item) => item.id === channelId)
    if (!channel) return false
    channel.weight = clampInteger(weight, 1, 100)
    return true
  }

  function setLoadBalance(enabled: boolean): void {
    loadBalance.value = enabled
  }

  function toggleLoadBalance(): void {
    loadBalance.value = !loadBalance.value
  }

  function selectPrimary(channels: HomeRouteChannel[]): HomeRouteChannel {
    if (!loadBalance.value) return channels[0]
    const totalWeight = channels.reduce(
      (sum, channel) => sum + channel.weight,
      0
    )
    let cursor =
      (routeSimulation.value.eventId * 37 + running.value.requestSeed) %
      totalWeight
    for (const channel of channels) {
      cursor -= channel.weight
      if (cursor < 0) return channel
    }
    return channels[0]
  }

  function simulateFailover(): boolean {
    clearSimulationTimers()
    const candidates = routeChannels.value.filter(
      (channel) => channel.enabled && channel.health !== 'offline'
    )
    const eventId = routeSimulation.value.eventId + 1
    if (candidates.length === 0) {
      routeSimulation.value = {
        eventId,
        phase: 'unavailable',
        primaryChannelId: null,
        fallbackChannelId: null,
        activeChannelId: null,
        latencyMs: null,
      }
      return false
    }

    const primary = selectPrimary(candidates)
    const fallback = candidates.find((channel) => channel.id !== primary.id)
    routeSimulation.value = {
      eventId,
      phase: 'sending',
      primaryChannelId: primary.id,
      fallbackChannelId: fallback?.id ?? null,
      activeChannelId: primary.id,
      latencyMs: null,
    }

    scheduleSimulation(() => {
      primary.health = 'degraded'
      if (!fallback) {
        routeSimulation.value = {
          ...routeSimulation.value,
          phase: 'unavailable',
          activeChannelId: null,
        }
        return
      }

      routeSimulation.value = {
        ...routeSimulation.value,
        phase: 'failover',
        activeChannelId: fallback.id,
      }
      scheduleSimulation(() => {
        routeSimulation.value = {
          ...routeSimulation.value,
          phase: 'responded',
          activeChannelId: fallback.id,
          latencyMs: primary.latencyMs + fallback.latencyMs,
        }
        todayRequests.value += 1
      }, RESPONSE_DELAY_MS)
    }, FAILOVER_DELAY_MS)
    return true
  }

  function resetRouteSimulation(): void {
    clearSimulationTimers()
    routeSimulation.value = {
      ...EMPTY_SIMULATION,
      eventId: routeSimulation.value.eventId,
    }
  }

  function setAccountTokens(value: number): void {
    accountTokens.value = Math.max(
      0,
      Number.isFinite(value) ? Math.round(value) : 0
    )
  }

  function setExampleSpendUsd(value: number): void {
    exampleSpendUsd.value = Math.max(0, Number.isFinite(value) ? value : 0)
  }

  function setSectionVisible(visible: boolean): void {
    if (sectionVisible === visible) return
    sectionVisible = visible
    if (visible) startCounter()
    else {
      stopCounter()
      resetRouteSimulation()
    }
  }

  function onVisibilityChange(): void {
    pageVisible = document.visibilityState !== 'hidden'
    if (pageVisible) startCounter()
    else {
      stopCounter()
      resetRouteSimulation()
    }
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    loadSequence += 1
    loadController?.abort()
    stopCounter()
    clearSimulationTimers()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }
  if (getCurrentScope()) onScopeDispose(dispose)
  if (options.immediate !== false) void load()

  return {
    loading,
    error,
    snapshot,
    marketSide,
    marketListings,
    journeyListing,
    marketJourneyStage,
    routeChannels,
    loadBalance,
    routeSimulation,
    discountTiers,
    accountTokens,
    exampleSpendUsd,
    activeDiscountTier,
    nextDiscountTier,
    discountPaymentRate,
    discountedSpendUsd,
    discountSavingsUsd,
    activities,
    running,
    runtime,
    todayRequests,
    qualityReports,
    supportLinks,
    configuredSupportLinks,
    load,
    setMarketSide,
    publishListing,
    purchaseListing,
    bindListingToRoute,
    reorderRoute,
    moveRoute,
    toggleRouteChannel,
    setRouteWeight,
    setLoadBalance,
    toggleLoadBalance,
    simulateFailover,
    resetRouteSimulation,
    setAccountTokens,
    setExampleSpendUsd,
    setSectionVisible,
    dispose,
  }
}

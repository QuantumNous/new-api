import { effectScope, type EffectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  HOME_DISCOUNT_TIERS,
  HOME_STARTED_AT,
  createLocalHomeShowcaseSource,
} from '@/constants/home/showcase'
import {
  calculateDeterministicTodayRequests,
  calculateHomeRuntime,
  resolveHomeDiscountTier,
  useHomeShowcase,
} from '@/composables/useHomeShowcase'

let scope: EffectScope | null = null

async function setupShowcase() {
  scope = effectScope()
  const showcase = scope.run(() =>
    useHomeShowcase({ immediate: false, now: Date.now })
  )
  if (!showcase) throw new Error('expected home showcase state')
  await showcase.load()
  return showcase
}

afterEach(() => {
  scope?.stop()
  scope = null
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('home showcase calculations', () => {
  it.each([
    [0, 'starter', 0.01],
    [999_999, 'starter', 0.01],
    [1_000_000, 'growth', 0.015],
    [5_000_000, 'scale', 0.02],
    [20_000_000, 'pro', 0.025],
    [50_000_000, 'max', 0.03],
  ])('resolves %,d tokens to the expected tier', (tokens, id, discountRate) => {
    expect(resolveHomeDiscountTier(tokens, HOME_DISCOUNT_TIERS)).toMatchObject({
      id,
      discountRate,
    })
  })

  it('splits elapsed uptime and clamps dates before launch', () => {
    const now = new Date('2026-03-17T02:03:04+08:00')
    expect(calculateHomeRuntime(now, HOME_STARTED_AT)).toEqual({
      days: 2,
      hours: 2,
      minutes: 3,
      seconds: 4,
      totalSeconds: 180_184,
    })
    expect(
      calculateHomeRuntime(
        new Date('2026-03-14T23:59:59+08:00'),
        HOME_STARTED_AT
      ).totalSeconds
    ).toBe(0)
  })

  it('produces a repeatable request count that resets for a new day', () => {
    const metrics = {
      startedAt: HOME_STARTED_AT,
      requestSeed: 77,
      requestsPerSecond: 4.5,
      requestsPerTick: 5,
      tickIntervalMs: 1_000,
    }
    const noon = new Date(2026, 6, 30, 12, 0, 0)
    const repeated = calculateDeterministicTodayRequests(noon, metrics)
    expect(calculateDeterministicTodayRequests(noon, metrics)).toBe(repeated)
    expect(
      calculateDeterministicTodayRequests(
        new Date(2026, 6, 31, 0, 0, 0),
        metrics
      )
    ).toBeLessThan(repeated)
  })

  it('returns isolated snapshots from the local source', async () => {
    const source = createLocalHomeShowcaseSource()
    const first = await source.load()
    first.market.listings[0].status = 'purchased'
    const second = await source.load()
    expect(second.market.listings[0].status).toBe('draft')
    expect(second.activities.map((activity) => activity.id)).toEqual([
      'checkin',
      'affiliate',
      'farm',
      'bigame',
    ])
    expect(
      second.routing.channels.every((channel) =>
        second.qualityReports.some((report) => report.channelId === channel.id)
      )
    ).toBe(true)
  })
})

describe('useHomeShowcase state flow', () => {
  it('publishes, purchases and binds a marketplace listing', async () => {
    const showcase = await setupShowcase()
    const listing = showcase.journeyListing.value
    expect(listing?.status).toBe('draft')
    expect(showcase.marketJourneyStage.value).toBe('draft')

    expect(showcase.publishListing()).toBe(true)
    expect(showcase.marketJourneyStage.value).toBe('listed')
    expect(showcase.purchaseListing()).toBe(true)
    expect(showcase.marketJourneyStage.value).toBe('purchased')
    expect(showcase.bindListingToRoute()).toBe(true)
    expect(showcase.marketJourneyStage.value).toBe('bound')
    expect(showcase.routeChannels.value.at(-1)?.listingId).toBe(listing?.id)
    expect(showcase.bindListingToRoute()).toBe(false)
  })

  it('moves, disables and weights route channels explicitly', async () => {
    const showcase = await setupShowcase()
    const firstId = showcase.routeChannels.value[0].id

    expect(showcase.moveRoute(firstId, 1)).toBe(true)
    expect(showcase.routeChannels.value[1].id).toBe(firstId)
    expect(
      showcase.routeChannels.value.map((channel) => channel.priority)
    ).toEqual([1, 2, 3])
    expect(showcase.toggleRouteChannel(firstId)).toBe(true)
    expect(showcase.routeChannels.value[1].enabled).toBe(false)
    expect(showcase.setRouteWeight(firstId, 140)).toBe(true)
    expect(showcase.routeChannels.value[1].weight).toBe(100)
    showcase.setLoadBalance(true)
    expect(showcase.loadBalance.value).toBe(true)
    expect(
      showcase.configuredSupportLinks.value.map((link) => link.id)
    ).toEqual(['ticket'])
  })

  it('animates a deterministic failure and fallback response', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 30, 20, 0, 0))
    const showcase = await setupShowcase()

    expect(showcase.simulateFailover()).toBe(true)
    const primaryId = showcase.routeSimulation.value.primaryChannelId
    const fallbackId = showcase.routeSimulation.value.fallbackChannelId
    expect(showcase.routeSimulation.value.phase).toBe('sending')

    await vi.advanceTimersByTimeAsync(300)
    expect(showcase.routeSimulation.value.phase).toBe('failover')
    expect(
      showcase.routeChannels.value.find((item) => item.id === primaryId)?.health
    ).toBe('degraded')

    await vi.advanceTimersByTimeAsync(380)
    expect(showcase.routeSimulation.value).toMatchObject({
      phase: 'responded',
      activeChannelId: fallbackId,
    })
    expect(showcase.routeSimulation.value.latencyMs).toBeGreaterThan(0)
  })

  it('pauses counters offscreen and clears timers on scope disposal', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 30, 20, 0, 0))
    const showcase = await setupShowcase()
    const initial = showcase.todayRequests.value

    await vi.advanceTimersByTimeAsync(1_000)
    expect(showcase.todayRequests.value).toBe(initial + 5)

    showcase.setSectionVisible(false)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(showcase.todayRequests.value).toBe(initial + 5)

    showcase.setSectionVisible(true)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(showcase.todayRequests.value).toBe(initial + 10)

    showcase.simulateFailover()
    const phaseBeforeDispose = showcase.routeSimulation.value.phase
    scope?.stop()
    scope = null
    await vi.advanceTimersByTimeAsync(2_000)
    expect(showcase.routeSimulation.value.phase).toBe(phaseBeforeDispose)
    expect(showcase.todayRequests.value).toBe(initial + 10)
  })

  it('pauses on document visibility changes without catching up', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 30, 20, 0, 0))
    let visibilityState: DocumentVisibilityState = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
      () => visibilityState
    )
    const showcase = await setupShowcase()
    const initial = showcase.todayRequests.value

    visibilityState = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(3_000)
    expect(showcase.todayRequests.value).toBe(initial)

    visibilityState = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(1_000)
    expect(showcase.todayRequests.value).toBe(initial + 5)
  })
})

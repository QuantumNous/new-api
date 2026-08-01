import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  calculateRuntime,
  clampRouteWeight,
  rankRouteChannels,
  reorderRouteChannels,
  selectRoutePrimary,
  useHomeShowcase,
} from '@/composables/useHomeShowcase'

afterEach(() => {
  vi.useRealTimers()
})

describe('home runtime calculations', () => {
  it('calculates stable runtime from the public launch date', () => {
    expect(
      calculateRuntime(new Date('2026-03-16T01:02:03+08:00').getTime())
    ).toEqual({ days: 1, hours: 1, minutes: 2, seconds: 3 })
  })

  it('clamps weights and reorders a route without duplicating channels', () => {
    const state = useHomeShowcase()
    const channels = state.activeChannels.value
    const movedId = channels[2]!.id

    expect(clampRouteWeight(-10)).toBe(1)
    expect(clampRouteWeight(180)).toBe(100)
    expect(reorderRouteChannels(channels, movedId, 0)).toBe(true)
    expect(channels.map((channel) => channel.id)).toEqual([
      movedId,
      'prod-official-primary',
      'prod-market-backup',
    ])
    expect(new Set(channels.map((channel) => channel.id)).size).toBe(3)
    state.dispose()
  })

  it('moves a listing through publish, purchase, and token binding', () => {
    const state = useHomeShowcase()
    const channelCount = state.activeChannels.value.length

    expect(state.publishListing('personal-vision')).toBe(true)
    expect(state.exchangeStage.value).toBe('published')
    expect(
      state.marketListings.value.find((item) => item.id === 'personal-vision')
        ?.status
    ).toBe('available')

    expect(state.purchaseListing('personal-vision')).toBe(true)
    expect(state.exchangeStage.value).toBe('purchased')
    expect(state.bindListing('personal-vision')).toBe(true)
    expect(state.exchangeStage.value).toBe('bound')
    expect(state.activeChannels.value).toHaveLength(channelCount + 1)
    expect(state.activeChannels.value.at(-1)?.listingId).toBe('personal-vision')
    expect(state.bindListing('personal-vision')).toBe(false)
    state.dispose()
  })

  it('keeps channel configuration isolated between tokens', () => {
    const state = useHomeShowcase()
    const productionFirstWeight = state.activeChannels.value[0]!.weight

    state.setActiveToken('image-worker')
    const imageChannelId = state.activeChannels.value[0]!.id
    expect(state.setChannelWeight(imageChannelId, 88)).toBe(true)
    expect(state.toggleChannel(imageChannelId)).toBe(true)

    state.setActiveToken('production-key')
    expect(state.activeChannels.value[0]!.weight).toBe(productionFirstWeight)
    expect(state.activeChannels.value[0]!.enabled).toBe(true)

    state.setActiveToken('image-worker')
    expect(state.activeChannels.value[0]!.weight).toBe(88)
    expect(state.activeChannels.value[0]!.enabled).toBe(false)
    state.dispose()
  })

  it('derives automatic route order without changing the DIY order', () => {
    const state = useHomeShowcase()
    const channels = state.activeChannels.value
    const manualOrder = channels.map((channel) => channel.id)

    expect(rankRouteChannels(channels).map((channel) => channel.id)).toEqual([
      'prod-market-backup',
      'prod-cold-backup',
      'prod-official-primary',
    ])
    expect(channels.map((channel) => channel.id)).toEqual(manualOrder)

    state.setRouteMode('auto')
    expect(state.activeChannels.value.map((channel) => channel.id)).toEqual(
      manualOrder
    )
    state.setRouteMode('manual')
    expect(state.activeChannels.value.map((channel) => channel.id)).toEqual(
      manualOrder
    )
    state.dispose()
  })

  it('reports unavailable when every candidate is removed', () => {
    const state = useHomeShowcase()
    for (const channel of state.activeChannels.value) {
      if (channel.enabled) expect(state.toggleChannel(channel.id)).toBe(true)
    }

    expect(
      state.activeChannels.value.every((channel) => !channel.enabled)
    ).toBe(true)
    expect(state.simulateRequest()).toBe(false)
    expect(state.routeSimulation.value.phase).toBe('unavailable')
    state.dispose()
  })

  it('selects by priority or weight and completes the degraded-route fallback', () => {
    vi.useFakeTimers()
    const state = useHomeShowcase()
    const channels = state.activeChannels.value

    expect(selectRoutePrimary(channels, false, 1)?.id).toBe(
      'prod-official-primary'
    )
    expect(selectRoutePrimary(channels, true, 2)).not.toBeNull()
    expect(state.simulateRequest()).toBe(true)
    expect(state.routeSimulation.value.phase).toBe('sending')

    vi.advanceTimersByTime(420)
    expect(state.routeSimulation.value.phase).toBe('failed')
    vi.advanceTimersByTime(320)
    expect(state.routeSimulation.value.phase).toBe('switching')
    vi.advanceTimersByTime(420)
    expect(state.routeSimulation.value.phase).toBe('responded')
    expect(state.routeSimulation.value.activeChannelId).toBe(
      'prod-market-backup'
    )
    expect(state.routeSimulation.value.latency).toBe(424)
    state.dispose()
  })

  it('uses the derived automatic order for request selection', () => {
    vi.useFakeTimers()
    const state = useHomeShowcase()
    state.setRouteMode('auto')

    expect(state.simulateRequest()).toBe(true)
    expect(state.routeSimulation.value.primaryChannelId).toBe(
      'prod-market-backup'
    )
    vi.advanceTimersByTime(760)
    expect(state.routeSimulation.value.phase).toBe('responded')
    expect(state.routeSimulation.value.activeChannelId).toBe(
      'prod-market-backup'
    )
    state.dispose()
  })
})

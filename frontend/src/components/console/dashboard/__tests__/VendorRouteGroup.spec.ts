import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import VendorRouteGroup from '@/components/console/dashboard/autoroute/VendorRouteGroup.vue'
import type { RouteChannelRow } from '@/composables/useAutoRoute'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { RouteHealthSummary } from '@/utils/routeHealth'
import { scoreChannels, type ChannelRoutingMetrics } from '@/utils/routeScore'

beforeAll(async () => {
  await loadMessageDomain('console')
  await setLocale('en')
})

function makeChannel(
  overrides: Partial<ChannelRoutingMetrics> = {}
): ChannelRoutingMetrics {
  return {
    id: 1,
    name: 'ch',
    supplier: 'OpenAI',
    latency: 300,
    health: 90,
    upstreamMult: 1,
    channelMult: 1,
    quota: 100,
    weight: 10,
    priority: 1,
    status: 1,
    ...overrides,
  }
}

const channels: RouteChannelRow[] = scoreChannels([
  makeChannel({ id: 1, latency: 900, health: 60, quota: 20 }),
  makeChannel({ id: 2, latency: 120, health: 95, quota: 800 }),
  makeChannel({ id: 3, latency: 400, health: 80, quota: 200 }),
]).map((channel, index) => ({ ...channel, rank: index + 1 }))

const monitor: RouteHealthSummary = {
  checks: Array.from({ length: 6 }, (_, index) => ({
    timestamp: 1_800 + index * 600,
    state: index === 2 ? ('degraded' as const) : ('healthy' as const),
  })),
  state: 'healthy',
  availability: 100,
}

function render(
  overrides: {
    channels?: RouteChannelRow[]
    activeCount?: number
    monitor?: RouteHealthSummary
  } = {}
) {
  return mount(VendorRouteGroup, {
    props: {
      vendor: 'OpenAI',
      channels: overrides.channels ?? channels,
      activeCount: overrides.activeCount ?? channels.length,
      monitor: overrides.monitor ?? monitor,
    },
    global: { plugins: [i18n] },
  })
}

describe('VendorRouteGroup', () => {
  it('shows six monitoring buckets and the group availability', () => {
    const wrapper = render()

    expect(wrapper.findAll('[data-route-health-cell]')).toHaveLength(6)
    expect(wrapper.text()).toContain('1h 100.00%')
    expect(wrapper.text()).toContain('Operational')
  })

  it('shows the best score and crowns exactly one channel after expansion', async () => {
    const wrapper = render()

    expect(wrapper.find('button[aria-expanded]').text()).toContain(
      String(channels[0]!.score)
    )
    expect(wrapper.findAll('[title="Group best"]')).toHaveLength(0)

    await wrapper.find('button[aria-expanded]').trigger('click')
    expect(wrapper.findAll('[title="Group best"]')).toHaveLength(1)
  })

  it('keeps the monitor visible while channel details are expanded', async () => {
    const wrapper = render()
    expect(wrapper.findAll('[title*="≈"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-route-health-cell]')).toHaveLength(6)

    await wrapper.find('button[aria-expanded]').trigger('click')

    expect(
      wrapper.find('button[aria-expanded]').attributes('aria-expanded')
    ).toBe('true')
    expect(wrapper.findAll('[title*="≈"]')).toHaveLength(18)
    expect(wrapper.findAll('[data-route-health-cell]')).toHaveLength(6)
  })

  it('retains an unavailable group and labels disabled channels without scores', async () => {
    const inactive: RouteChannelRow = {
      ...makeChannel({ status: 3, health: 0 }),
      rank: null,
      score: null,
      breakdown: null,
    }
    const wrapper = render({
      channels: [inactive],
      activeCount: 0,
      monitor: {
        checks: monitor.checks.map((check) => ({ ...check, state: 'down' })),
        state: 'down',
        availability: 0,
      },
    })

    expect(wrapper.text()).toContain('0/1 available')
    expect(wrapper.text()).toContain('Outage')
    expect(wrapper.text()).toContain('1h 0.00%')
    expect(wrapper.text()).not.toContain('Auto-disabled')
    expect(wrapper.find('[aria-label^="Score"]').exists()).toBe(false)

    await wrapper.find('button[aria-expanded]').trigger('click')
    expect(wrapper.text()).toContain('Auto-disabled')
  })
})

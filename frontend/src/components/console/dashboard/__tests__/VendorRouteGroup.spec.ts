import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import VendorRouteGroup from '@/components/console/dashboard/autoroute/VendorRouteGroup.vue'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import { scoreChannels, type ChannelRoutingMetrics } from '@/utils/routeScore'

beforeAll(async () => {
  await loadMessageDomain('console')
  setLocale('en')
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

const channels = scoreChannels([
  makeChannel({ id: 1, latency: 900, health: 60, quota: 20 }),
  makeChannel({ id: 2, latency: 120, health: 95, quota: 800 }),
  makeChannel({ id: 3, latency: 400, health: 80, quota: 200 }),
])

function render() {
  return mount(VendorRouteGroup, {
    props: { vendor: 'OpenAI', channels },
    global: { plugins: [i18n] },
  })
}

describe('VendorRouteGroup', () => {
  it('crowns exactly one channel — the group optimum', () => {
    expect(render().findAll('[title="Group best"]')).toHaveLength(1)
  })

  it('shows the group best score in the header badge', () => {
    const header = render().find('button[aria-expanded]')

    expect(header.text()).toContain(String(channels[0]!.score))
  })

  it('collapses the channel rows on header toggle', async () => {
    const wrapper = render()
    // 3 rows × 6 contribution segments while expanded
    expect(wrapper.findAll('[title*="≈"]')).toHaveLength(18)

    await wrapper.find('button[aria-expanded]').trigger('click')

    expect(
      wrapper.find('button[aria-expanded]').attributes('aria-expanded')
    ).toBe('false')
    expect(wrapper.findAll('[title*="≈"]')).toHaveLength(0)
  })
})

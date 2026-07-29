import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import ChannelScoreRow from '@/components/console/dashboard/autoroute/ChannelScoreRow.vue'
import type { RouteChannelRow } from '@/composables/useAutoRoute'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
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

const scored = scoreChannels([
  makeChannel({
    id: 1,
    latency: 200,
    health: 92,
    quota: 800,
    weight: 50,
    priority: 1,
  }),
  makeChannel({
    id: 2,
    latency: 1800,
    health: 55,
    upstreamMult: 1.2,
    channelMult: 1.1,
    quota: 40,
    weight: 10,
    priority: 10,
  }),
])[0]!
const entry: RouteChannelRow = { ...scored, rank: 1 }

function render(row: RouteChannelRow = entry) {
  return mount(ChannelScoreRow, {
    props: { entry: row },
    global: { plugins: [i18n] },
  })
}

describe('ChannelScoreRow', () => {
  it('keeps all six score factors while hiding the concrete quota amount', () => {
    const wrapper = render()
    const segments = wrapper.findAll('[title*="≈"]')

    expect(segments).toHaveLength(6)
    expect(
      Math.round(
        segments.reduce(
          (sum, segment) =>
            sum +
            parseFloat((segment.element as HTMLElement).style.width || '0'),
          0
        )
      )
    ).toBe(entry.score)
    expect(wrapper.text()).not.toContain('$800')
    expect(wrapper.text()).not.toContain('Upstream quota')
  })

  it('renders the local segmented health meter', () => {
    const wrapper = render()
    const meter = wrapper.find(`[aria-label="Health ${entry.health}%"]`)

    expect(meter.exists()).toBe(true)
    const segments = meter.findAll('[data-channel-health-segment]')
    expect(segments).toHaveLength(10)
    expect((segments[0]!.element as HTMLElement).style.background).toBe(
      'var(--status-success)'
    )
  })

  it('crowns and announces the top-ranked channel score', () => {
    const wrapper = render()

    expect(wrapper.find('[title="Group best"]').exists()).toBe(true)
    const ring = wrapper.find(`[aria-label="Score ${entry.score}"]`)
    expect(ring.exists()).toBe(true)
    expect(ring.text()).toContain(String(entry.score))
  })

  it('shows an inactive channel without a rank or score', () => {
    const inactive: RouteChannelRow = {
      ...makeChannel({ status: 2, health: 0 }),
      rank: null,
      score: null,
      breakdown: null,
    }
    const wrapper = render(inactive)

    expect(wrapper.text()).toContain('Manually disabled')
    expect(wrapper.text()).toContain('Excluded from auto routing')
    expect(wrapper.find('[aria-label^="Score"]').exists()).toBe(false)
  })
})

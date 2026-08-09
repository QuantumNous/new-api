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
    quota: 800,
    weight: 50,
    priority: 1,
  }),
  makeChannel({
    id: 2,
    latency: 1800,
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
  it('uses only the four persisted score factors and shows the real balance', () => {
    const wrapper = render()
    const segments = wrapper.findAll('[title*="≈"]')

    expect(segments).toHaveLength(4)
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
    expect(wrapper.text()).toContain('800.00')
    expect(wrapper.find('[data-route-balance]').exists()).toBe(true)
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
      ...makeChannel({ status: 2 }),
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

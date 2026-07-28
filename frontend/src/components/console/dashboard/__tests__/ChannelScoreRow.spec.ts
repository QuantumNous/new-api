import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import ChannelScoreRow from '@/components/console/dashboard/autoroute/ChannelScoreRow.vue'
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

/** Score a two-channel set so every factor has a real normalised spread. */
const channel = scoreChannels([
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

function render() {
  return mount(ChannelScoreRow, {
    props: { channel, rank: 1 },
    global: { plugins: [i18n] },
  })
}

describe('ChannelScoreRow', () => {
  it('renders six contribution segments whose widths sum to the score', () => {
    const segments = render().findAll('[title*="≈"]')

    expect(segments).toHaveLength(6)
    const total = segments.reduce(
      (sum, seg) =>
        sum + parseFloat((seg.element as HTMLElement).style.width || '0'),
      0
    )
    expect(Math.round(total)).toBe(channel.score)
  })

  it('labels each segment with its factor name', () => {
    const titles = render()
      .findAll('[title*="≈"]')
      .map((seg) => seg.attributes('title'))

    expect(titles.some((title) => title?.startsWith('Latency'))).toBe(true)
    expect(titles.some((title) => title?.startsWith('Health'))).toBe(true)
  })

  it('draws the health bar at the health percentage', () => {
    const bar = render().find(`[aria-label="Health ${channel.health}%"]`)

    expect(bar.exists()).toBe(true)
    const fill = bar.find('div')
    expect((fill.element as HTMLElement).style.width).toBe(`${channel.health}%`)
  })

  it('crowns the top-ranked row as the group best', () => {
    expect(render().find('[title="Group best"]').exists()).toBe(true)
  })

  it('announces the composite score on the ring', () => {
    const ring = render().find(`[aria-label="Score ${channel.score}"]`)

    expect(ring.exists()).toBe(true)
    expect(ring.text()).toContain(String(channel.score))
  })
})

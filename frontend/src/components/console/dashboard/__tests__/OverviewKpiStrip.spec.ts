import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import MiniSparkline from '@/components/console/dashboard/MiniSparkline.vue'
import OverviewKpiStrip from '@/components/console/dashboard/OverviewKpiStrip.vue'
import RpmRing from '@/components/console/dashboard/RpmRing.vue'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type {
  DashboardStats,
  FlowPoint,
  TokenTrendPoint,
} from '@/composables/useDashboard'

beforeAll(async () => {
  await loadMessageDomain('console')
  setLocale('en')
})

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

const stats: DashboardStats = {
  quota: 5_200_000,
  used_quota: 2_985_000,
  today_quota: 96_402,
  today_requests: 312,
  total_requests: 18_764,
  month_quota_delta: 16.2,
  month_requests_delta: -5.8,
}

const flowPoints: FlowPoint[] = Array.from({ length: 14 }, (_, i) => ({
  date: `07-${String(i + 13).padStart(2, '0')}`,
  consume: 60_000 + i * 4_000,
  requests: 200 + i * 15,
  topup: 0,
}))

function trendPoint(over: Partial<TokenTrendPoint> = {}): TokenTrendPoint {
  return {
    date: '2026-07-26',
    input: 1_000_000,
    output: 500_000,
    cache_create: 250_000,
    cache_read: 2_250_000,
    hit_rate: 69.2,
    actual: 4_000,
    standard: 6_000,
    ...over,
  }
}

function render(props: Record<string, unknown> = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(OverviewKpiStrip, {
    props: { stats, ...props },
    global: { plugins: [pinia, i18n] },
  })
}

describe('OverviewKpiStrip', () => {
  it('shows five cells and no month-over-month figures', () => {
    const wrapper = render()

    expect(wrapper.findAll('[class*="px-5"]')).toHaveLength(5)
    // The month deltas were removed from this strip entirely.
    expect(wrapper.text()).not.toContain('16.2')
    expect(wrapper.text()).not.toContain('5.8')
  })

  it('draws a sparkline for each series cell and a ring for RPM', () => {
    const wrapper = render({
      flow: flowPoints,
      tokenTrend: [trendPoint({ date: '2026-07-25' }), trendPoint()],
      limits: { rate_limit: 300, current_rpm: 141 },
    })

    // Spend, requests, tokens and TPM get a line; RPM gets the ring instead.
    expect(wrapper.findAllComponents(MiniSparkline)).toHaveLength(4)
    expect(wrapper.findAllComponents(RpmRing)).toHaveLength(1)
  })

  it('omits a sparkline when a series has too few points to draw', () => {
    const wrapper = render({
      flow: flowPoints.slice(0, 1),
      tokenTrend: [trendPoint()],
    })

    expect(wrapper.findAllComponents(MiniSparkline)).toHaveLength(0)
  })

  it('states the ceiling under the RPM figure', () => {
    const wrapper = render({
      limits: { rate_limit: 300, current_rpm: 141 },
    })

    expect(wrapper.text()).toContain('of 300 RPM')
  })

  it('labels an unmetered group instead of showing a ceiling', () => {
    const wrapper = render({
      limits: { rate_limit: 0, current_rpm: 118 },
    })

    expect(wrapper.text()).toContain('Unmetered')
  })

  it("sums every token class for today's total", () => {
    const wrapper = render({
      tokenTrend: [trendPoint({ date: '2026-07-25' }), trendPoint()],
    })

    // 1.0M + 0.5M + 0.25M + 2.25M = 4.0M, taken from the last point only.
    expect(wrapper.text()).toContain('4.0M')
  })

  it('renders a placeholder for RPM when limits have not loaded', () => {
    expect(render().text()).toContain('--')
  })

  it('reads the observed RPM from limits', () => {
    const wrapper = render({
      limits: { rate_limit: 300, current_rpm: 141 },
    })

    expect(wrapper.text()).toContain('141')
  })

  it('floors the TPM divisor at one hour so just-after-midnight is not absurd', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 26, 0, 1))

    const wrapper = render({ tokenTrend: [trendPoint()] })

    // 4M tokens / 60 min = 66.7K, not 4M / 1 min.
    expect(wrapper.text()).toContain('66.7K')
  })

  it('averages TPM over the elapsed day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 26, 10, 0))

    const wrapper = render({ tokenTrend: [trendPoint()] })

    // 4M / 600 min = 6.7K
    expect(wrapper.text()).toContain('6.7K')
  })

  it('only makes the spend and request cells drill down', () => {
    // Passing limits so the ring's own button is present — the count must not
    // include it, which is what a bare findAll('button') would do.
    const wrapper = render({
      limits: { rate_limit: 300, current_rpm: 141 },
    })

    const drillDowns = wrapper
      .findAll('[class*="px-5"]')
      .filter((cell) => cell.element.tagName === 'BUTTON')

    expect(drillDowns).toHaveLength(2)
    expect(drillDowns[0]!.text()).toContain('Today spend')
    expect(drillDowns[1]!.text()).toContain('Today requests')
  })

  it('emits switchTab when a drill-down cell is clicked', async () => {
    const wrapper = render()
    await wrapper.findAll('[class*="px-5"]')[0]!.trigger('click')

    expect(wrapper.emitted('switchTab')).toEqual([['stats']])
  })

  it('does not drill down when the rate-limit ring is focused', async () => {
    const wrapper = render({
      limits: { rate_limit: 300, current_rpm: 141 },
    })

    await wrapper.findComponent(RpmRing).find('button').trigger('click')

    expect(wrapper.emitted('switchTab')).toBeUndefined()
  })

  it('always pairs a divider width with the theme border colour', () => {
    const wrapper = render()

    wrapper.findAll('[class*="px-5"]').forEach((cell) => {
      const classes = cell.classes()
      expect(classes).toContain('border-[var(--border-subtle)]')
      // Every axis is stated at every breakpoint, so no toggle can fall through
      // to Tailwind's default grey.
      ;[
        'border-l',
        'border-t',
        'sm:border-l',
        'sm:border-t',
        'xl:border-l',
      ].forEach((axis) => {
        expect(
          classes.some((c) => c === axis || c === `${axis}-0`),
          `expected ${axis} or ${axis}-0`
        ).toBe(true)
      })
    })
  })

  it('hides spend but not request counts when balances are masked', () => {
    localStorage.setItem('renren_hide_balance', 'true')
    const wrapper = render()

    expect(wrapper.text()).toContain('••••')
    expect(wrapper.text()).toContain('312')
  })
})

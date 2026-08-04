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

import UsageDistributionCard from '@/components/console/dashboard/UsageDistributionCard.vue'
import type { UsageDistributionPoint } from '@/composables/useUsageDistribution'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'

function dateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function points(): UsageDistributionPoint[] {
  const end = new Date(2026, 6, 27)
  return Array.from({ length: 365 }, (_, index) => {
    const date = new Date(end)
    date.setDate(date.getDate() - (364 - index))
    return {
      date: dateKey(date),
      requests: index + 1,
      consume: (index + 1) * 500_000,
      tokens: (index + 1) * 1_000,
    }
  })
}

beforeAll(async () => {
  await loadMessageDomain('console')
  setLocale('zh-CN')
})

beforeEach(async () => {
  await setLocale('zh-CN')
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 6, 27, 12))
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

function render(overrides: Record<string, unknown> = {}) {
  return mount(UsageDistributionCard, {
    props: { points: points(), ...overrides },
    attachTo: document.body,
    global: { plugins: [i18n] },
  })
}

describe('UsageDistributionCard', () => {
  it('defaults to quarter and calls with one roving grid focus', () => {
    const wrapper = render()

    expect(
      wrapper.get('[data-usage-period="quarter"]').attributes('aria-pressed')
    ).toBe('true')
    expect(
      wrapper.get('[data-usage-metric="requests"]').attributes('aria-pressed')
    ).toBe('true')
    expect(wrapper.findAll('[data-usage-date]')).toHaveLength(91)
    expect(wrapper.findAll('.usage-cell')).toHaveLength(91)
    expect(wrapper.findAll('[aria-hidden="true"].usage-cell')).toHaveLength(0)
    expect(
      wrapper
        .findAll('[data-usage-date]')
        .filter((cell) => cell.attributes('tabindex') === '0')
    ).toHaveLength(1)
  })

  it('switches period and metric without replacing the card', async () => {
    const wrapper = render()
    const original = wrapper.get('[data-usage-distribution]').element

    await wrapper.get('[data-usage-period="month"]').trigger('click')
    await wrapper.get('[data-usage-metric="consume"]').trigger('click')

    expect(wrapper.get('[data-usage-distribution]').element).toBe(original)
    expect(wrapper.findAll('[data-usage-date]')).toHaveLength(30)
    expect(wrapper.get('[data-usage-total]').text()).toMatch(/^\$/)
  })

  it('keeps the year inside the dedicated horizontal scroller', async () => {
    const wrapper = render()
    await wrapper.get('[data-usage-period="year"]').trigger('click')

    expect(wrapper.findAll('[data-usage-date]')).toHaveLength(364)
    expect(wrapper.get('[data-usage-scroll]').classes()).toContain(
      'overflow-x-auto'
    )
  })

  it('moves focus by week with horizontal arrow keys', async () => {
    const wrapper = render()
    const focused = wrapper.get('[data-usage-date][tabindex="0"]')
    const start = focused.attributes('data-usage-date')
    await focused.trigger('focus')
    await focused.trigger('keydown', { key: 'ArrowLeft' })
    await Promise.resolve()

    const active = document.activeElement as HTMLElement
    const expected = new Date(`${start}T00:00:00`)
    expected.setDate(expected.getDate() - 7)
    expect(active.dataset.usageDate).toBe(dateKey(expected))
  })

  it('shows stable loading and empty states', () => {
    const loading = render({ loading: true })
    expect(loading.find('[data-usage-loading]').exists()).toBe(true)
    loading.unmount()

    const empty = render({ points: [] })
    expect(empty.text()).toContain('暂无调用分布')
  })
})

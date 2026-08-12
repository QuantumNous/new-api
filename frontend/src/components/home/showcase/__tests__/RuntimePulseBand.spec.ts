import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import RuntimePulseBand from '@/components/home/showcase/RuntimePulseBand.vue'
import i18n from '@/i18n'

const originalMatchMedia = window.matchMedia

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

function mountBand(available: boolean, requests24h = 300) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  const hourlyRequests = Array.from({ length: 24 }, (_, index) => index + 1)
  return mount(RuntimePulseBand, {
    global: { plugins: [i18n] },
    props: {
      runtime: { days: 1, hours: 2, minutes: 3, seconds: 4 },
      uptimeLabel: '99.95%',
      requestMetrics: available
        ? {
            available: true,
            requests_24h: requests24h,
            hourly_requests:
              requests24h === 300
                ? hourlyRequests
                : [requests24h, ...Array(23).fill(0)],
            generated_at: 1_700_000_000,
          }
        : {
            available: false,
            requests_24h: null,
            hourly_requests: Array(24).fill(0),
            generated_at: 1_700_000_000,
          },
    },
  })
}

describe('RuntimePulseBand', () => {
  it('renders the real request total and all 24 trend buckets', () => {
    const wrapper = mountBand(true)

    expect(wrapper.get('[data-home-request-total]').text()).toBe('300')
    const trend = wrapper.get('.runtime-trend polyline')
    expect(trend.attributes('points')?.split(' ')).toHaveLength(24)
    expect(wrapper.get('.runtime-trend svg').attributes('aria-label')).toBe(
      i18n.global.t('showcase.runtime.trend24h')
    )
    wrapper.unmount()
  })

  it('shows an unavailable placeholder without a fake trend', () => {
    const wrapper = mountBand(false)

    expect(wrapper.get('[data-home-request-total]').text()).toBe('--')
    expect(wrapper.find('.runtime-trend polyline').exists()).toBe(false)
    expect(wrapper.find('.runtime-trend svg').exists()).toBe(false)
    expect(wrapper.text()).toContain(
      i18n.global.t('showcase.runtime.metricsUnavailable')
    )
    wrapper.unmount()
  })

  it('uses a stable compact layout class for long real totals', () => {
    const wrapper = mountBand(true, 1_234_567_890_123)

    expect(wrapper.get('[data-home-request-total]').text()).toBe(
      '1,234,567,890,123'
    )
    expect(wrapper.get('[data-home-request-total]').classes()).toContain(
      'runtime-request-total--long'
    )
    expect(wrapper.get('.runtime-ledger-panel--requests').classes()).toContain(
      'runtime-ledger-panel--wide-total'
    )
    wrapper.unmount()
  })

  it('distinguishes a real zero-hour trend from unavailable metrics', () => {
    const wrapper = mountBand(true, 0)

    expect(wrapper.get('[data-home-request-total]').text()).toBe('0')
    expect(wrapper.get('.runtime-trend-placeholder').text()).toBe('0')
    expect(wrapper.text()).not.toContain(
      i18n.global.t('showcase.runtime.metricsUnavailable')
    )
    wrapper.unmount()
  })
})

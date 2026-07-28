import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import LogMobileCard from '@/components/console/log-ui/LogMobileCard.vue'
import LogPerformanceCell from '@/components/console/log-ui/LogPerformanceCell.vue'
import {
  getDurationTone,
  getFirstTokenTone,
  formatLogDuration,
} from '@/components/console/log-ui/logPerformance'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { LogItem } from '@/types/console'

const baseLog: LogItem = {
  id: 1,
  type: 'consume',
  token_name: 'Production key',
  model: 'gpt-4o',
  channel: 'OpenAI',
  prompt_tokens: 320,
  completion_tokens: 680,
  cache_read_tokens: 500,
  cache_write_tokens: 200,
  cache_ttl: '5m',
  quota: 250_000,
  latency: 6.99,
  first_token_latency: 4.04,
  request_mode: 'stream',
  tps: 34,
  content: 'Request completed',
  created: 1_752_000_000,
}

beforeAll(async () => {
  await loadMessageDomain('console')
  setLocale('en')
})

afterAll(() => setLocale('zh-CN'))

describe('log performance presentation', () => {
  it('shows full-width status segments and reveals bordered values after a click', async () => {
    const wrapper = mount(LogPerformanceCell, {
      props: { log: baseLog },
      global: { plugins: [i18n], stubs: { Teleport: true } },
    })

    const triggers = wrapper.findAll('[data-log-performance-trigger]')
    const [durationTrigger, firstTokenTrigger] = triggers

    expect(wrapper.findAll('[data-log-performance-summary]')).toHaveLength(1)
    expect(triggers).toHaveLength(2)
    expect(
      triggers.map((trigger) => trigger.attributes('data-metric'))
    ).toEqual(['duration', 'first-token'])
    expect(wrapper.text()).toContain('Stream')
    expect(wrapper.text()).toContain('34 t/s')
    expect(wrapper.text()).not.toContain('First token')
    expect(wrapper.text()).not.toContain('Total duration')
    expect(wrapper.text()).not.toContain('Healthy')
    expect(wrapper.text()).not.toContain('4.04s')
    expect(wrapper.text()).not.toContain('6.99s')
    expect(durationTrigger.attributes('title')).toBeUndefined()
    expect(durationTrigger.attributes('aria-label')).toBe(
      'Total duration: 6.99s. Show timing details'
    )
    expect(firstTokenTrigger.attributes('aria-label')).toBe(
      'First token: 4.04s. Show timing details'
    )
    expect(wrapper.find('[data-log-performance-details]').exists()).toBe(false)

    await durationTrigger.trigger('pointerenter')

    expect(
      wrapper.get('[data-log-performance-tooltip]').attributes()
    ).toMatchObject({
      'data-metric': 'duration',
      'data-tone': 'success',
    })
    expect(wrapper.get('[data-log-performance-tooltip]').text()).toContain(
      'Total duration'
    )
    expect(wrapper.get('[data-log-performance-tooltip]').text()).toContain(
      '6.99s'
    )

    await durationTrigger.trigger('pointerleave')

    expect(wrapper.find('[data-log-performance-tooltip]').exists()).toBe(false)

    await durationTrigger.trigger('click')

    expect(wrapper.find('[data-log-performance-summary]').exists()).toBe(false)
    expect(wrapper.get('[data-log-performance-details]').text()).toContain(
      '4.04s'
    )
    expect(wrapper.get('[data-log-performance-details]').text()).toContain(
      '6.99s'
    )
    expect(
      wrapper.findAll('[data-log-performance-detail-metric]')
    ).toHaveLength(2)
    expect(
      wrapper
        .get('[data-log-performance-detail-metric][data-metric="first-token"]')
        .classes()
    ).toContain('border')
    expect(
      wrapper.get('[data-metric="first-token"]').attributes()
    ).toMatchObject({
      'data-tone': 'success',
    })

    await wrapper.get('[data-log-performance-details]').trigger('click')

    expect(wrapper.find('[data-log-performance-summary]').exists()).toBe(true)
  })

  it('shows only duration status for synchronous requests', () => {
    const wrapper = mount(LogPerformanceCell, {
      props: {
        log: {
          ...baseLog,
          request_mode: 'sync',
          first_token_latency: null,
          latency: 12,
          tps: 42,
        },
      },
      global: { plugins: [i18n] },
    })

    const triggers = wrapper.findAll('[data-log-performance-trigger]')
    const [durationTrigger] = triggers

    expect(wrapper.text()).toContain('Sync')
    expect(wrapper.text()).toContain('42 t/s')
    expect(wrapper.find('[data-metric="first-token"]').exists()).toBe(false)
    expect(triggers).toHaveLength(1)
    expect(durationTrigger.classes()).toContain('flex-1')
    expect(durationTrigger.attributes('aria-label')).toBe(
      'Total duration: 12.0s. Show timing details'
    )
  })

  it('keeps an explicit neutral first-token status when data is missing', () => {
    const wrapper = mount(LogPerformanceCell, {
      props: { log: { ...baseLog, first_token_latency: null } },
      global: { plugins: [i18n] },
    })

    const firstToken = wrapper.get(
      '[data-log-performance-trigger][data-metric="first-token"]'
    )

    expect(firstToken.attributes()).toMatchObject({
      'data-tone': 'neutral',
    })
    expect(firstToken.attributes('aria-label')).toBe(
      'First token: \u2014. Show timing details'
    )
  })

  it('shows and clears the local tooltip for keyboard and viewport changes', async () => {
    const wrapper = mount(LogPerformanceCell, {
      props: { log: baseLog },
      global: { plugins: [i18n], stubs: { Teleport: true } },
    })
    const firstTokenTrigger = wrapper.get(
      '[data-log-performance-trigger][data-metric="first-token"]'
    )

    await firstTokenTrigger.trigger('focus')

    expect(
      wrapper.get('[data-log-performance-tooltip]').attributes()
    ).toMatchObject({
      'data-metric': 'first-token',
      'data-tone': 'success',
    })
    expect(wrapper.get('[data-log-performance-tooltip]').text()).toContain(
      '4.04s'
    )

    window.dispatchEvent(new Event('scroll'))
    await nextTick()

    expect(wrapper.find('[data-log-performance-tooltip]').exists()).toBe(false)
  })

  it('renders a TPS placeholder when throughput is unavailable', () => {
    const wrapper = mount(LogPerformanceCell, {
      props: { log: { ...baseLog, tps: 0 } },
      global: { plugins: [i18n] },
    })

    expect(wrapper.text()).toContain('\u2014 t/s')
  })

  it('does not invent performance data for non-request logs', () => {
    const wrapper = mount(LogPerformanceCell, {
      props: {
        log: {
          ...baseLog,
          type: 'topup',
          latency: 0,
          first_token_latency: null,
          request_mode: null,
          tps: 0,
        },
      },
      global: { plugins: [i18n] },
    })

    expect(wrapper.find('[data-log-performance-empty]').exists()).toBe(true)
  })

  it('renders all mobile card fields without an expand control', () => {
    const wrapper = mount(LogMobileCard, {
      props: { log: baseLog },
      global: { plugins: [i18n] },
    })

    expect(wrapper.get('[data-log-mobile-card]').text()).toContain('gpt-4o')
    expect(wrapper.get('h3').classes()).toContain('text-base')
    expect(wrapper.text()).toContain('OpenAI')
    expect(wrapper.text()).toContain('Production key')
    expect(wrapper.text()).toContain('320')
    expect(wrapper.text()).toContain('680')
    expect(wrapper.text()).not.toContain('1,700')
    expect(wrapper.text()).toContain('500')
    expect(wrapper.text()).toContain('200')
    expect(wrapper.text()).toContain('Request completed')
    expect(wrapper.find('[data-log-usage-trigger]').exists()).toBe(true)
    expect(wrapper.find('[data-log-performance-trigger]').exists()).toBe(false)
    expect(wrapper.find('[data-log-performance-details]').exists()).toBe(true)
    expect(wrapper.get('[data-metric="duration"]').text()).toContain('6.99s')
  })
})

describe('log performance formatting and thresholds', () => {
  it('formats second and minute boundaries consistently', () => {
    expect(formatLogDuration(9.99)).toBe('9.99s')
    expect(formatLogDuration(10)).toBe('10.0s')
    expect(formatLogDuration(59.9)).toBe('59.9s')
    expect(formatLogDuration(60)).toBe('1m 0s')
    expect(formatLogDuration(91)).toBe('1m 31s')
  })

  it('uses the agreed first-token and response-performance thresholds', () => {
    expect(getFirstTokenTone(4.99)).toBe('success')
    expect(getFirstTokenTone(5)).toBe('warning')
    expect(getFirstTokenTone(9.99)).toBe('warning')
    expect(getFirstTokenTone(10)).toBe('danger')

    expect(getDurationTone(10, 99, 100)).toBe('warning')
    expect(getDurationTone(30, 99, 100)).toBe('danger')
    expect(getDurationTone(60, 100, 30)).toBe('success')
    expect(getDurationTone(60, 100, 15)).toBe('warning')
    expect(getDurationTone(60, 100, 14.99)).toBe('danger')
  })
})

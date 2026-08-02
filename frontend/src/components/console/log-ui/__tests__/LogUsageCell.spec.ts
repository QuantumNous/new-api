import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import LogUsageCell from '@/components/console/log-ui/LogUsageCell.vue'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { LogItem } from '@/types/console'

const baseLog: LogItem = {
  id: 1,
  type: 'consume',
  token_name: 'Usage key',
  model: 'gpt-4o',
  channel: 'OpenAI',
  prompt_tokens: 23,
  completion_tokens: 449,
  cache_read_tokens: 826_998,
  cache_write_tokens: 993,
  cache_ttl: '5m',
  quota: 0,
  latency: 1,
  first_token_latency: 0.2,
  request_mode: 'stream',
  tps: 100,
  content: 'done',
  created: 1_752_000_000,
}

beforeAll(async () => {
  await loadMessageDomain('console')
  setLocale('en')
})

afterAll(() => setLocale('zh-CN'))

describe('LogUsageCell', () => {
  it('shows exact input/output and compact cache summary without total tokens', () => {
    const wrapper = mount(LogUsageCell, {
      props: { log: baseLog },
      global: { plugins: [i18n] },
    })

    expect(wrapper.find('[data-log-usage-total]').exists()).toBe(false)
    expect(wrapper.get('[data-log-usage-io]').classes()).toContain('text-sm')
    expect(wrapper.get('[data-log-usage-input]').text()).toBe('23')
    expect(wrapper.get('[data-log-usage-output]').text()).toBe('449')
    expect(wrapper.get('[data-log-usage-trigger]').classes()).toContain(
      'self-center'
    )
    expect(wrapper.text()).toContain('827.0K')
    expect(wrapper.text()).toContain('993')
    expect(wrapper.text()).not.toContain('828,463')
    expect(wrapper.text()).not.toContain('Cache hit rate')
    expect(wrapper.text()).not.toContain('99.82%')
  })

  it('opens complete usage details with cache hit rate icon', async () => {
    const wrapper = mount(LogUsageCell, {
      props: { log: baseLog },
      global: { plugins: [i18n], stubs: { Teleport: true } },
    })
    const trigger = wrapper.get('[data-log-usage-trigger]')

    await trigger.trigger('click')

    const popover = wrapper.get('[data-log-usage-popover]')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(popover.text()).toContain('Usage details')
    expect(popover.text()).toContain('Input tokens')
    expect(popover.text()).toContain('23')
    expect(popover.text()).toContain('Output tokens')
    expect(popover.text()).toContain('449')
    expect(popover.text()).toContain('Cache creation')
    expect(popover.text()).toContain('5m')
    expect(popover.text()).toContain('Cache read tokens')
    expect(popover.text()).toContain('826,998')
    expect(popover.text()).toContain('Cache hit rate')
    expect(popover.text()).toContain('99.82%')
    expect(popover.find('[data-log-cache-hit-rate] svg').exists()).toBe(true)
    expect(popover.find('[data-log-fast-mode]').exists()).toBe(false)
    expect(popover.text()).toContain('Total tokens')
    expect(popover.text()).toContain('828,463')
  })

  it('shows Fast only when an accepted signal is enabled', async () => {
    for (const log of [
      { ...baseLog, other: { fast_mode: true } },
      { ...baseLog, other: { service_tier: 'fast' } },
      { ...baseLog, speed: 'fast' },
    ]) {
      const wrapper = mount(LogUsageCell, {
        props: { log },
        global: { plugins: [i18n], stubs: { Teleport: true } },
      })
      await wrapper.get('[data-log-usage-trigger]').trigger('click')
      expect(wrapper.get('[data-log-fast-mode]').text()).toContain('Enabled')
      wrapper.unmount()
    }

    const disabled = mount(LogUsageCell, {
      props: {
        log: { ...baseLog, other: { fast_mode: false, speed: 'fast' } },
      },
      global: { plugins: [i18n], stubs: { Teleport: true } },
    })
    await disabled.get('[data-log-usage-trigger]').trigger('click')
    expect(disabled.find('[data-log-fast-mode]').exists()).toBe(false)
  })

  it('closes token details on escape and scroll', async () => {
    const wrapper = mount(LogUsageCell, {
      props: { log: baseLog },
      global: { plugins: [i18n], stubs: { Teleport: true } },
    })
    const trigger = wrapper.get('[data-log-usage-trigger]')

    await trigger.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.find('[data-log-usage-popover]').exists()).toBe(false)

    await trigger.trigger('click')
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(wrapper.find('[data-log-usage-popover]').exists()).toBe(false)
  })

  it('closes token details when a pointer lands outside the popover', async () => {
    const wrapper = mount(LogUsageCell, {
      props: { log: baseLog },
      global: { plugins: [i18n], stubs: { Teleport: true } },
    })

    await wrapper.get('[data-log-usage-trigger]').trigger('click')
    document.body.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true })
    )
    await nextTick()

    expect(wrapper.find('[data-log-usage-popover]').exists()).toBe(false)
  })

  it('shows a neutral cache summary when cache data is unavailable', () => {
    const wrapper = mount(LogUsageCell, {
      props: {
        log: {
          ...baseLog,
          cache_read_tokens: null,
          cache_write_tokens: null,
          cache_ttl: null,
        },
      },
      global: { plugins: [i18n] },
    })

    expect(wrapper.get('[data-log-usage-input]').text()).toBe('23')
    expect(wrapper.get('[data-log-usage-output]').text()).toBe('449')
    expect(wrapper.text()).not.toContain('472')
    expect(wrapper.text()).toContain('Cache —')
  })

  it('renders a placeholder without a details control for non-request logs', () => {
    const wrapper = mount(LogUsageCell, {
      props: {
        log: {
          ...baseLog,
          type: 'topup',
          prompt_tokens: 0,
          completion_tokens: 0,
          request_mode: null,
          cache_read_tokens: null,
          cache_write_tokens: null,
          cache_ttl: null,
        },
      },
      global: { plugins: [i18n] },
    })

    expect(wrapper.find('[data-log-usage-empty]').exists()).toBe(true)
    expect(wrapper.find('[data-log-usage-trigger]').exists()).toBe(false)
  })
})

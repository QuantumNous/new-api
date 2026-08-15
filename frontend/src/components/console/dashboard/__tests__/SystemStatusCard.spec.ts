import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import SystemStatusCard from '@/components/console/dashboard/SystemStatusCard.vue'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { SystemMetrics } from '@/composables/useDashboard'

beforeAll(async () => {
  await loadMessageDomain('console')
  setLocale('en')
})

beforeEach(() => {
  setActivePinia(createPinia())
})

function metrics(): SystemMetrics {
  return {
    cpu_percent: 34,
    memory_used_gb: 5.2,
    memory_total_gb: 16,
    bandwidth_up_mbps: 2.1,
    bandwidth_down_mbps: 12.4,
    disk_used_gb: 218,
    disk_total_gb: 512,
    api_success_rate: 99.7,
    bandwidth_series: {
      up: [1.1, 1.6, 2.1],
      down: [8.6, 10.9, 12.4],
    },
  }
}

describe('SystemStatusCard', () => {
  it('starts unknown instead of claiming that the service is healthy', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      global: { plugins: [pinia, i18n] },
    })

    expect(wrapper.text()).toContain('UNKNOWN')
    expect(wrapper.text()).not.toContain('ONLINE')
    expect(wrapper.find('[data-status-reachable]').attributes()).toMatchObject({
      'data-status-reachable': 'false',
    })
  })

  it('renders placeholders rather than zeroes when metrics are unavailable', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      props: { metrics: null },
      global: { plugins: [pinia, i18n] },
    })

    // Four tiles plus the header readout, none of which have data yet (version
    // falls back to the store's own '--').
    expect(wrapper.text()).toContain('--')
    expect(wrapper.text()).not.toContain('0%')
  })

  it('reads the success rate out in the header, not as a tile', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      props: { metrics: metrics() },
      global: { plugins: [pinia, i18n] },
    })

    expect(wrapper.find('header').text()).toContain('99.7%')
    // Four resource tiles remain; success rate is no longer one of them.
    expect(wrapper.findAll('.grid > .min-w-0')).toHaveLength(4)
  })

  it('foots ceilinged tiles with usage bars and charts bandwidth instead', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      props: { metrics: metrics() },
      global: { plugins: [pinia, i18n] },
    })

    const tiles = wrapper.findAll('.grid > .min-w-0')
    expect(tiles).toHaveLength(4)
    const [cpu, memory, bandwidth, disk] = tiles
    expect(cpu!.find('.h-1').exists()).toBe(true)
    expect(memory!.find('.h-1').exists()).toBe(true)
    expect(disk!.find('.h-1').exists()).toBe(true)
    expect(bandwidth!.find('.h-1').exists()).toBe(false)
    expect(bandwidth!.find('svg[aria-hidden="true"]').exists()).toBe(true)
  })

  it('charts both bandwidth directions on one shared scale', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      props: { metrics: metrics() },
      global: { plugins: [pinia, i18n] },
    })

    const spark = wrapper
      .findAll('.grid > .min-w-0')[2]!
      .find('svg[aria-hidden="true"]')
    expect(spark.exists()).toBe(true)
    // One line per direction plus the shaded download area beneath them.
    expect(spark.findAll('path[fill="none"]')).toHaveLength(2)
    expect(spark.findAll('circle')).toHaveLength(2)
  })

  it('does not advertise its own mock provenance', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      props: { metrics: metrics() },
      global: { plugins: [pinia, i18n] },
    })

    expect(wrapper.text()).not.toContain('Local mock')
    expect(wrapper.text()).not.toContain('demo data')
  })

  it('renders supplied metrics with usage bars', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      props: { metrics: metrics() },
      global: { plugins: [pinia, i18n] },
    })

    const text = wrapper.text()
    expect(text).toContain('34')
    expect(text).toContain('5.2 / 16')
    expect(text).toContain('218 / 512')
    expect(text).toContain('99.7')
  })
})

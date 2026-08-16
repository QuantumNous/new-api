import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import SystemStatusCard from '@/components/console/dashboard/SystemStatusCard.vue'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { SystemMetrics } from '@/composables/useDashboard'

beforeAll(async () => {
  await loadMessageDomain('console')
  await setLocale('en')
})

beforeEach(async () => {
  setActivePinia(createPinia())
  await setLocale('en')
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

  it('keeps unavailable fields as placeholders when the response is partial', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      props: {
        metrics: {
          cpu_percent: null,
          memory_used_gb: null,
          memory_total_gb: null,
          bandwidth_up_mbps: null,
          bandwidth_down_mbps: null,
          disk_used_gb: null,
          disk_total_gb: null,
          api_success_rate: null,
          bandwidth_series: null,
        },
      },
      global: { plugins: [pinia, i18n] },
    })

    expect(wrapper.text()).not.toContain('null')
    expect(wrapper.text()).toContain('--')
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
    expect(text).toContain('App traffic')
  })

  it('rounds CPU and app traffic values without truncating them', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      props: {
        metrics: {
          ...metrics(),
          cpu_percent: 4.627766599,
          bandwidth_up_mbps: 1.249,
          bandwidth_down_mbps: 6.555,
        },
      },
      global: { plugins: [pinia, i18n] },
    })

    const cpuValue = wrapper.findAll('.grid > .min-w-0')[0]!.find('.mt-1 span')
    expect(wrapper.text()).toContain('4.6%')
    expect(wrapper.text()).toContain('↑1.2 ↓6.6')
    expect(wrapper.text()).not.toContain('4.627766599')
    expect(cpuValue.classes()).toContain('whitespace-nowrap')
    expect(cpuValue.classes()).not.toContain('truncate')
  })

  it('uses the Chinese app traffic label', async () => {
    await setLocale('zh-CN')
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      props: { metrics: metrics() },
      global: { plugins: [pinia, i18n] },
    })

    expect(wrapper.text()).toContain('应用流量')
  })
})

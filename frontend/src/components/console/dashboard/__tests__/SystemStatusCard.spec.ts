import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import SystemStatusCard from '@/components/console/dashboard/SystemStatusCard.vue'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { SystemMetrics } from '@/composables/useDashboard'
import { useAppStore } from '@/stores'

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

  it('does not report online before the system metrics request succeeds', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const app = useAppStore()
    app.phase = 'ready'
    app.statusReachable = true
    const wrapper = mount(SystemStatusCard, {
      props: { metrics: null },
      global: { plugins: [pinia, i18n] },
    })

    expect(wrapper.text()).toContain('UNKNOWN')
    expect(wrapper.text()).not.toContain('ONLINE')
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
    expect(wrapper.findAll('[data-system-status-tile]')).toHaveLength(4)
  })

  it('renders a prominent determinate success-rate ring for valid data', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      props: { metrics: metrics() },
      global: { plugins: [pinia, i18n] },
    })

    const ring = wrapper.find('[data-success-rate-ring]')
    expect(ring.exists()).toBe(true)
    expect(ring.attributes('data-success-rate-state')).toBe('value')
    expect(ring.find('svg').attributes('width')).toBe('38')
    expect(ring.findAll('.tick-active').length).toBeGreaterThan(0)
    expect(ring.findAll('.tick-standby')).toHaveLength(0)
  })

  it('uses an indeterminate neutral ring when success rate is unavailable', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      props: { metrics: { ...metrics(), api_success_rate: null } },
      global: { plugins: [pinia, i18n] },
    })

    const ring = wrapper.find('[data-success-rate-ring]')
    expect(ring.attributes('data-success-rate-state')).toBe('unknown')
    expect(ring.findAll('.tick-standby')).toHaveLength(20)
    expect(ring.findAll('.tick-active')).toHaveLength(0)
  })

  it('uses a distinct visual gauge for each system resource', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      props: { metrics: metrics() },
      global: { plugins: [pinia, i18n] },
    })

    const tiles = wrapper.findAll('[data-system-status-tile]')
    expect(tiles).toHaveLength(4)
    const [cpu, memory, bandwidth, disk] = tiles
    expect(cpu!.find('[data-cpu-gauge]').exists()).toBe(true)
    expect(cpu!.find('[data-cpu-gauge-active]').exists()).toBe(true)
    expect(memory!.find('[data-memory-segments]').exists()).toBe(true)
    expect(memory!.findAll('[data-memory-segments] > span')).toHaveLength(10)
    expect(disk!.find('[data-disk-gauge]').exists()).toBe(true)
    expect(disk!.find('svg').exists()).toBe(true)
    expect(bandwidth!.find('.pencil-progress').exists()).toBe(false)
    expect(bandwidth!.find('[data-bandwidth-sparkline]').exists()).toBe(true)
    expect(bandwidth!.find('[data-bandwidth-icon]').exists()).toBe(true)
  })

  it('charts both bandwidth directions on one shared scale', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      props: { metrics: metrics() },
      global: { plugins: [pinia, i18n] },
    })

    const spark = wrapper
      .findAll('[data-system-status-tile]')[2]!
      .find('[data-bandwidth-sparkline] svg[aria-hidden="true"]')
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

  it('renders supplied metrics with resource gauges', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      props: { metrics: metrics() },
      global: { plugins: [pinia, i18n] },
    })

    const text = wrapper.text()
    expect(text).toContain('34')
    expect(text).toContain('5.2 / 16')
    expect(wrapper.find('[data-disk-gauge]').text()).toContain('218')
    expect(wrapper.find('[data-disk-gauge]').text()).toContain('512')
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

    const cpuValue = wrapper
      .findAll('[data-system-status-tile]')[0]!
      .find('[data-cpu-gauge] span')
    expect(wrapper.text()).toContain('4.6%')
    expect(wrapper.text()).toContain('↑1.2 Mbps')
    expect(wrapper.text()).toContain('↓6.6 Mbps')
    expect(wrapper.text()).not.toContain('4.627766599')
    expect(cpuValue.classes()).toContain('whitespace-nowrap')
    expect(cpuValue.classes()).not.toContain('truncate')
  })

  it('formats each bandwidth direction with the smallest useful unit', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      props: {
        metrics: {
          ...metrics(),
          bandwidth_up_mbps: 0.45,
          bandwidth_down_mbps: 0.00042,
        },
      },
      global: { plugins: [pinia, i18n] },
    })

    const bandwidth = wrapper.findAll('[data-system-status-tile]')[2]!
    expect(bandwidth.text()).toContain('↑450 Kbps')
    expect(bandwidth.text()).toContain('↓420 bps')
    expect(bandwidth.text()).not.toContain('Mbps')
    expect(bandwidth.findAll('[data-bandwidth-direction]')).toHaveLength(2)
  })

  it('clamps percentages and rejects invalid metric values', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      props: {
        metrics: {
          ...metrics(),
          cpu_percent: 140,
          memory_used_gb: -1,
          memory_total_gb: 0,
          disk_used_gb: Number.NaN,
          disk_total_gb: 100,
          api_success_rate: Number.POSITIVE_INFINITY,
          bandwidth_up_mbps: -0.5,
          bandwidth_down_mbps: Number.NaN,
          bandwidth_series: {
            up: [1, Number.NaN, 3],
            down: [2, 4, 6],
          },
        },
      },
      global: { plugins: [pinia, i18n] },
    })

    const tiles = wrapper.findAll('[data-system-status-tile]')
    expect(tiles[0]!.text()).toContain('100%')
    expect(tiles[0]!.find('[data-cpu-gauge-active]').exists()).toBe(true)
    expect(tiles[1]!.text()).toContain('--')
    expect(tiles[2]!.text()).toContain('--')
    expect(tiles[2]!.find('[data-bandwidth-sparkline]').exists()).toBe(false)
    expect(tiles[3]!.text()).toContain('--')
    expect(wrapper.find('header').text()).toContain('--')
  })

  it('keeps bandwidth values visible without drawing an incomplete series', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SystemStatusCard, {
      props: {
        metrics: {
          ...metrics(),
          bandwidth_series: { up: [1], down: [2] },
        },
      },
      global: { plugins: [pinia, i18n] },
    })

    const bandwidth = wrapper.findAll('[data-system-status-tile]')[2]!
    expect(bandwidth.text()).toContain('↑2.1 Mbps')
    expect(bandwidth.text()).toContain('↓12.4 Mbps')
    expect(bandwidth.find('[data-bandwidth-sparkline]').exists()).toBe(false)
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

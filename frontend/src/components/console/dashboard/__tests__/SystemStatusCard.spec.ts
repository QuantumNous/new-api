import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import type { SystemStatusSnapshot } from '@/api/systemStatus'
import SystemStatusCard from '@/components/console/dashboard/SystemStatusCard.vue'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'

beforeAll(async () => {
  await loadMessageDomain('console')
  setLocale('en')
})

function metrics(): SystemStatusSnapshot {
  return {
    status: 'online',
    scope: 'current_node',
    sampled_at: 1_786_700_000,
    cpu_percent: 34,
    memory_used_bytes: 5.2 * 1024 ** 3,
    memory_total_bytes: 16 * 1024 ** 3,
    network_tx_bytes_per_second: 2_100_000,
    network_rx_bytes_per_second: 12_400_000,
    disk_used_bytes: 218 * 1024 ** 3,
    disk_total_bytes: 512 * 1024 ** 3,
    api_success_rate_24h: 99.7,
    network_series: [
      {
        timestamp: 1,
        tx_bytes_per_second: 1_100_000,
        rx_bytes_per_second: 8_600_000,
      },
      {
        timestamp: 2,
        tx_bytes_per_second: 2_100_000,
        rx_bytes_per_second: 12_400_000,
      },
    ],
    version: 'v1.0.0-test',
  }
}

function mountCard(
  props: InstanceType<typeof SystemStatusCard>['$props'] = {}
) {
  return mount(SystemStatusCard, { props, global: { plugins: [i18n] } })
}

describe('SystemStatusCard', () => {
  it('starts offline without claiming that the service is healthy', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('OFFLINE')
    expect(wrapper.text()).not.toContain('ONLINE')
    expect(wrapper.find('[data-service-state]').attributes()).toMatchObject({
      'data-service-state': 'offline',
    })
  })

  it('renders placeholders for unavailable independent metrics', () => {
    const partial = metrics()
    partial.status = 'degraded'
    partial.cpu_percent = null
    partial.network_tx_bytes_per_second = null
    partial.network_rx_bytes_per_second = null
    partial.api_success_rate_24h = null
    const wrapper = mountCard({ metrics: partial, serviceState: 'degraded' })
    expect(wrapper.text()).toContain('DEGRADED')
    expect(wrapper.text()).toContain('--')
    expect(wrapper.text()).toContain('5.2 / 16')
    expect(wrapper.text()).not.toContain('0%')
  })

  it('formats bytes as GiB and throughput as decimal MB/s', () => {
    const text = mountCard({
      metrics: metrics(),
      serviceState: 'online',
    }).text()
    expect(text).toContain('5.2 / 16')
    expect(text).toContain('218 / 512')
    expect(text).toContain('GiB')
    expect(text).toContain('↑2.10 ↓12.40')
    expect(text).toContain('MB/s')
    expect(text).toContain('99.7%')
    expect(text).toContain('v1.0.0-test')
  })

  it('charts both throughput directions on one shared scale', () => {
    const spark = mountCard({ metrics: metrics() })
      .findAll('.grid > .min-w-0')[2]!
      .find('.mt-auto > svg[aria-hidden="true"]')
    expect(spark.exists()).toBe(true)
    expect(spark.findAll('path[fill="none"]')).toHaveLength(2)
    expect(spark.findAll('circle')).toHaveLength(2)
  })

  it('clamps percentage progress and keeps threshold colors deterministic', () => {
    const overloaded = metrics()
    overloaded.cpu_percent = 120
    overloaded.memory_used_bytes = 12 * 1024 ** 3
    const [cpu, memory] = mountCard({ metrics: overloaded }).findAll(
      '.grid > .min-w-0'
    )
    expect(cpu!.find('.h-full').attributes('style')).toContain('width: 100%')
    expect(cpu!.find('.h-full').attributes('style')).toContain(
      'var(--status-danger)'
    )
    expect(memory!.find('.h-full').attributes('style')).toContain(
      'var(--status-warning)'
    )
  })
})

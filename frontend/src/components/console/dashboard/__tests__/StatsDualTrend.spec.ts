import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { ChartPalette } from '@/charts/palette'
import type { OptionBuilder } from '@/charts/useEChart'
import StatsDualTrend from '@/components/console/dashboard/stats/StatsDualTrend.vue'
import type { FlowPoint } from '@/composables/useDashboard'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'

let buildOption: OptionBuilder | null = null

vi.mock('@/charts/useEChart', () => ({
  useEChart: (_el: unknown, build: OptionBuilder) => {
    buildOption = build
    return { refresh: vi.fn(), dispatch: vi.fn() }
  },
}))

const palette = {
  accent: '#d8984c',
  signal: '#74765a',
  surfaceSolid: '#fffdf8',
  borderSubtle: '#eeeeee',
  chartGrid: '#eeeeee',
  textPrimary: '#111111',
  textSecondary: '#222222',
  textTertiary: '#333333',
  isDark: false,
  lineGlow: 'transparent',
} as unknown as ChartPalette

const flow: FlowPoint[] = [
  { date: '07-26', consume: 500_000, requests: 10, topup: 0 },
  { date: '07-27', consume: 1_000_000, requests: 20, topup: 0 },
]

beforeAll(async () => {
  await loadMessageDomain('console')
  setLocale('zh-CN')
})

function render() {
  return mount(StatsDualTrend, {
    props: {
      kpi: {
        totalTokens: 3_000,
        totalQuota: 1_500_000,
        totalRequests: 30,
        avgLatency: 1.2,
        successRate: 99,
      },
      comparison: { quotaDelta: 12.5, requestsDelta: -8 },
      flow,
    },
    global: { plugins: [i18n] },
  })
}

describe('StatsDualTrend', () => {
  it('renders current totals and signed comparison labels', () => {
    const wrapper = render()

    expect(wrapper.get('[data-trend-spend]').text()).toBe('$3.00')
    expect(wrapper.get('[data-trend-requests]').text()).toBe('30')
    expect(wrapper.get('[data-trend-spend-delta]').text()).toBe('↑12.5%')
    expect(wrapper.get('[data-trend-requests-delta]').text()).toBe('↓8%')
  })

  it('switches between dual and single-axis chart modes', async () => {
    const wrapper = render()
    const both = buildOption!(palette) as {
      yAxis: unknown[]
      series: unknown[]
    }
    expect(both.yAxis).toHaveLength(2)
    expect(both.series).toHaveLength(2)

    await wrapper.get('[data-trend-mode="consume"]').trigger('click')
    const consume = buildOption!(palette) as {
      yAxis: unknown[]
      series: unknown[]
    }
    expect(consume.yAxis).toHaveLength(1)
    expect(consume.series).toHaveLength(1)
  })

  it('formats each tooltip series with its own unit and escapes labels', () => {
    render()
    const option = buildOption!(palette) as {
      series: Array<{ name: string }>
      tooltip: {
        formatter: (params: Array<Record<string, unknown>>) => string
      }
    }
    const html = option.tooltip.formatter([
      {
        axisValueLabel: '<svg>',
        color: '#d8984c',
        seriesName: option.series[0]!.name,
        value: 500_000,
      },
      {
        axisValueLabel: '<svg>',
        color: '#74765a',
        seriesName: option.series[1]!.name,
        value: 1234,
      },
    ])

    expect(html).toContain('$1.00')
    expect(html).toContain('1,234')
    expect(html).toContain('&lt;svg&gt;')
    expect(html).not.toContain('<svg>')
  })
})

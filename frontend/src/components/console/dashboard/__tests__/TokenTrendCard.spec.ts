import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { ChartPalette } from '@/charts/palette'
import type { OptionBuilder } from '@/charts/useEChart'
import TokenTrendCard from '@/components/console/dashboard/TokenTrendCard.vue'
import type { TokenTrendPoint } from '@/composables/useDashboard'
import i18n, { loadMessageDomain } from '@/i18n'

let buildOption: OptionBuilder | null = null

vi.mock('@/charts/useEChart', () => ({
  useEChart: (_el: unknown, build: OptionBuilder) => {
    buildOption = build
    return { refresh: vi.fn(), dispatch: vi.fn() }
  },
}))

const palette = {
  accent: '#123456',
  signal: '#234567',
  success: '#345678',
  warning: '#456789',
  surfaceSolid: '#ffffff',
  borderSubtle: '#eeeeee',
  textPrimary: '#111111',
  textSecondary: '#222222',
  textTertiary: '#333333',
  isDark: false,
  lineGlow: 'transparent',
} as unknown as ChartPalette

beforeAll(() => loadMessageDomain('console'))

describe('TokenTrendCard', () => {
  it('escapes all API-derived text inserted into the HTML tooltip', () => {
    const point = {
      date: '2026-08-01',
      input: 1,
      output: 2,
      cache_create: 3,
      cache_read: 4,
      hit_rate: 50,
      actual: 5,
      standard: 6,
    } as TokenTrendPoint
    mount(TokenTrendCard, {
      props: { points: [point] },
      global: { plugins: [i18n] },
    })

    const option = buildOption!(palette) as {
      series: Array<{ name: string }>
      tooltip: {
        formatter: (
          params: Array<{
            dataIndex: number
            seriesName: string
            value: number
            color: string
            axisValueLabel: string
          }>
        ) => string
      }
    }
    const html = option.tooltip.formatter([
      {
        dataIndex: 0,
        seriesName: option.series.at(-1)!.name,
        value: '<img src=x onerror=alert(1)>' as unknown as number,
        color: '#123456',
        axisValueLabel: '<svg onload=alert(1)>',
      },
    ])

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;%')
    expect(html).toContain('&lt;svg onload=alert(1)&gt;')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<svg')
  })
})

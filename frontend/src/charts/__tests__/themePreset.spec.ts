import { describe, expect, it } from 'vitest'

import type { ChartPalette } from '@/charts/palette'
import { areaGradient, lineMood } from '@/charts/themePreset'

function palette(isDark: boolean): ChartPalette {
  return {
    accent: '#d8984c',
    signal: '#74765a',
    signalStrong: '#5c5e45',
    support: '#cfaf6b',
    success: '#64764b',
    warning: '#a87b2a',
    danger: '#9d3017',
    info: '#74765a',
    textPrimary: '#38372b',
    textSecondary: '#5c5946',
    textTertiary: '#827e66',
    borderSubtle: 'rgba(56,55,43,.08)',
    chartGrid: 'rgba(152,164,192,.08)',
    surfaceSolid: '#fffdf8',
    isDark,
    lineGlow: isDark ? 'rgba(226,188,85,.35)' : 'transparent',
    series: [],
  }
}

describe('chart mood', () => {
  it('uses a visible, unsmoothed pencil line and irregular ledger grid by day', () => {
    const mood = lineMood(palette(false))

    expect(mood.line).toMatchObject({
      smooth: false,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { width: 2.5 },
    })
    expect(mood.splitLine.lineStyle.type).toEqual([7, 3, 2, 5])
    expect(mood.barRadius).toEqual([3, 2, 0, 0])
    expect(areaGradient(palette(false), '#d8984c')).toEqual([
      { offset: 0, color: '#d8984c2e' },
      { offset: 1, color: '#d8984c05' },
    ])
  })

  it('preserves the smooth glowing One Night chart mood', () => {
    const mood = lineMood(palette(true))

    expect(mood.line).toMatchObject({
      smooth: true,
      symbol: 'none',
      symbolSize: 0,
      lineStyle: {
        width: 2,
        shadowBlur: 8,
        shadowColor: 'rgba(226,188,85,.35)',
      },
    })
    expect(mood.splitLine.lineStyle.type).toBe('solid')
    expect(mood.splitLine.lineStyle.color).toBe('rgba(152,164,192,.08)')
    expect(mood.barRadius).toEqual([4, 4, 0, 0])
  })
})

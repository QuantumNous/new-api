import type { ChartPalette } from './palette'

/**
 * Dual-mood option fragments for ECharts.
 *
 * Day (Desert Ledger): hand-drawn ledger feel — no smoothing, visible circle
 * markers, dashed grid ruling like a paper ledger.
 * Night (One Night): elegant Material — smooth lines with a soft golden glow,
 * hairline solid grid, quiet surfaces.
 *
 * Charts consume these via spreads inside their option builders so each chart
 * keeps its own data/axis specifics.
 */

export interface LineMoodOptions {
  /** series-level props for line charts */
  line: {
    smooth: boolean
    symbol: string
    symbolSize: number
    lineStyle: {
      width: number
      shadowBlur?: number
      shadowColor?: string
    }
  }
  /** splitLine style for value axes */
  splitLine: {
    lineStyle: {
      type: 'dashed' | 'solid' | number[]
      color: string
    }
  }
  /** bar series itemStyle borderRadius (top corners) */
  barRadius: number[]
}

export function lineMood(p: ChartPalette): LineMoodOptions {
  if (p.isDark) {
    return {
      line: {
        smooth: true,
        symbol: 'none',
        symbolSize: 0,
        lineStyle: { width: 2, shadowBlur: 8, shadowColor: p.lineGlow },
      },
      splitLine: {
        lineStyle: { type: 'solid', color: 'rgba(152,164,192,0.08)' },
      },
      barRadius: [4, 4, 0, 0],
    }
  }
  return {
    line: {
      smooth: false,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { width: 2.5 },
    },
    splitLine: {
      lineStyle: { type: [4, 5], color: p.borderSubtle },
    },
    barRadius: [3, 2, 0, 0],
  }
}

/**
 * Area gradient stops for filled line charts: day keeps the flat soft wash,
 * night fades a glowing accent from top to transparent.
 */
export function areaGradient(
  p: ChartPalette,
  color: string
): { offset: number; color: string }[] {
  if (p.isDark) {
    return [
      { offset: 0, color: color + '3d' },
      { offset: 1, color: color + '00' },
    ]
  }
  return [
    { offset: 0, color: color + '2e' },
    { offset: 1, color: color + '05' },
  ]
}

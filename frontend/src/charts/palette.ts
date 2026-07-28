import { normalizeOpaqueColor } from '@/utils/cssColor'

/**
 * ECharts renders to canvas and cannot inherit CSS variables, so we resolve
 * the semantic tokens at runtime — same strategy as canvas/theme.ts in the
 * real project. Options are rebuilt on theme switch (see useEChart).
 */
export interface ChartPalette {
  accent: string
  signal: string
  signalStrong: string
  support: string
  success: string
  warning: string
  danger: string
  info: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  borderSubtle: string
  chartGrid: string
  surfaceSolid: string
  /** resolved theme at build time — presets branch day/night on this */
  isDark: boolean
  /** night-only line glow color; transparent by day */
  lineGlow: string
  series: string[]
}

/**
 * Same cycle as chartPalette().series, but as raw CSS-variable strings for use
 * in HTML/CSS (legend swatches, avatars). Unlike the resolved-hex `series`,
 * these re-resolve automatically when the theme flips.
 */
export const SERIES_TOKENS = [
  'var(--accent)',
  'var(--signal)',
  'var(--status-danger)',
  'var(--support)',
  'var(--status-success)',
  'var(--status-warning)',
] as const

export function resolveToken(name: string, fallback = ''): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return value || fallback
}

export function chartPalette(): ChartPalette {
  const isDark = document.documentElement.dataset.theme === 'dark'
  const p: ChartPalette = {
    accent: normalizeOpaqueColor(resolveToken('--accent'), '#d8984c'),
    signal: normalizeOpaqueColor(resolveToken('--signal'), '#74765a'),
    signalStrong: normalizeOpaqueColor(
      resolveToken('--signal-strong'),
      '#5c5e45'
    ),
    support: normalizeOpaqueColor(resolveToken('--support'), '#cfaf6b'),
    success: normalizeOpaqueColor(resolveToken('--status-success'), '#64764b'),
    warning: normalizeOpaqueColor(resolveToken('--status-warning'), '#a87b2a'),
    danger: normalizeOpaqueColor(resolveToken('--status-danger'), '#9d3017'),
    info: normalizeOpaqueColor(resolveToken('--status-info'), '#74765a'),
    textPrimary: normalizeOpaqueColor(
      resolveToken('--text-primary'),
      '#38372b'
    ),
    textSecondary: normalizeOpaqueColor(
      resolveToken('--text-secondary'),
      '#5c5946'
    ),
    textTertiary: normalizeOpaqueColor(
      resolveToken('--text-tertiary'),
      '#827e66'
    ),
    borderSubtle: resolveToken('--border-subtle', 'rgba(56,55,43,.08)'),
    chartGrid: resolveToken('--chart-grid-line', 'rgba(56,55,43,.08)'),
    surfaceSolid: normalizeOpaqueColor(
      resolveToken('--surface-solid'),
      '#fffdf8'
    ),
    isDark,
    lineGlow: isDark
      ? resolveToken('--chart-line-glow', 'rgba(226,188,85,0.35)')
      : 'transparent',
    series: [],
  }
  // Donut / categorical cycle: all six seed hues for maximum distinction
  // (info aliases signal, so danger takes its slot in the cycle).
  p.series = [p.accent, p.signal, p.danger, p.support, p.success, p.warning]
  return p
}

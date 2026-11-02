/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
export function formatThroughput(tps: number): string {
  if (!Number.isFinite(tps) || tps <= 0) return '—'
  if (tps >= 1_000) return `${(tps / 1_000).toFixed(1)}K t/s`
  return `${tps.toFixed(tps < 10 ? 2 : 1)} t/s`
}

export type LatencyUnit = 'ms' | 's'

/**
 * The unit a latency scale is displayed in: seconds once the scale's peak
 * reaches one second, milliseconds below it.
 *
 * The unit is chosen per scale (a chart, a card, one table column) rather
 * than per value, so every number on that scale stays directly comparable.
 * A standalone value (a KPI tile) can pick its own unit instead.
 */
export function pickLatencyUnit(peakMs: number): LatencyUnit {
  return Number.isFinite(peakMs) && peakMs >= 1_000 ? 's' : 'ms'
}

/**
 * Latency expressed in the given unit, without the unit suffix. Each unit
 * keeps a fixed shape (seconds with two decimals, milliseconds as an integer)
 * so a card can reserve the same width for every value it shows.
 */
export function formatLatencyValue(ms: number, unit: LatencyUnit): string {
  if (!Number.isFinite(ms)) return '—'
  if (unit === 's') return (Math.max(0, ms) / 1_000).toFixed(2)
  return Math.round(Math.max(0, ms)).toLocaleString()
}

/**
 * Latency with its unit suffix. A non-positive value means "no measurement"
 * (an idle hour, a bucket without samples) and renders as a dash rather than
 * as a zero.
 */
export function formatLatencyWithUnit(ms: number, unit: LatencyUnit): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  return `${formatLatencyValue(ms, unit)}${unit}`
}

/**
 * Latency for a standalone value: the unit follows the value itself, so a
 * sub-second latency stays in milliseconds and a slower one switches to
 * seconds.
 */
export function formatLatency(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  return formatLatencyWithUnit(ms, pickLatencyUnit(ms))
}

export function formatUptimePct(pct: number): string {
  if (!Number.isFinite(pct)) return '—'
  return `${pct.toFixed(2)}%`
}

type SuccessRateLevel =
  | 'excellent'
  | 'good'
  | 'warning'
  | 'critical'
  | 'unknown'

const SUCCESS_RATE_EXCELLENT_MIN = 100
const SUCCESS_RATE_GOOD_MIN = 90
const SUCCESS_RATE_WARNING_MIN = 70

/**
 * Single source of truth for grading a success rate (0-100).
 * - excellent: 100% (full green)
 * - good: >= 90% (slightly lighter green)
 * - warning: >= 70%
 * - critical: below 70%
 * - unknown: non-finite values
 */
function getSuccessRateLevel(rate: number): SuccessRateLevel {
  if (!Number.isFinite(rate)) return 'unknown'
  if (rate >= SUCCESS_RATE_EXCELLENT_MIN) return 'excellent'
  if (rate >= SUCCESS_RATE_GOOD_MIN) return 'good'
  if (rate >= SUCCESS_RATE_WARNING_MIN) return 'warning'
  return 'critical'
}

const SUCCESS_RATE_TEXT_CLASS: Record<SuccessRateLevel, string> = {
  excellent: 'text-emerald-600 dark:text-emerald-400',
  good: 'text-emerald-500 dark:text-emerald-300',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-red-600 dark:text-red-400',
  unknown: 'text-muted-foreground',
}

const SUCCESS_RATE_DOT_CLASS: Record<SuccessRateLevel, string> = {
  excellent: 'bg-emerald-500',
  good: 'bg-emerald-400',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
  unknown: 'bg-muted-foreground',
}

// Hex colors for non-CSS contexts (e.g. chart libraries that need raw values).
const SUCCESS_RATE_HEX_COLOR: Record<SuccessRateLevel, string> = {
  excellent: '#10b981', // emerald-500 (full green)
  good: '#34d399', // emerald-400 (slightly lighter green)
  warning: '#f59e0b', // amber-500
  critical: '#ef4444', // red-500
  unknown: '#9ca3af', // gray-400
}

export function getSuccessRateTextClass(rate: number): string {
  return SUCCESS_RATE_TEXT_CLASS[getSuccessRateLevel(rate)]
}

export function getSuccessRateDotClass(rate: number): string {
  return SUCCESS_RATE_DOT_CLASS[getSuccessRateLevel(rate)]
}

export function getSuccessRateColor(rate: number): string {
  return SUCCESS_RATE_HEX_COLOR[getSuccessRateLevel(rate)]
}

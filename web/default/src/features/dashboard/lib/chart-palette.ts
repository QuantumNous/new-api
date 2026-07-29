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

/** Theme chart colors, resolved by the browser so charts follow light/dark. */
const THEME_CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

/**
 * Qualitative hex palette. Used for per-user series (users need stable colors
 * that do not collapse into the five theme hues) and as the extension palette
 * when a categorical domain is larger than the theme colors.
 */
export const USER_CHART_COLORS: readonly string[] = [
  '#5B8FF9',
  '#5AD8A6',
  '#F6BD16',
  '#E8684A',
  '#6DC8EC',
  '#9270CA',
  '#FF9D4D',
  '#269A99',
  '#FF99C3',
  '#5D7092',
]

/**
 * Returns exactly `domainLength` colors for a categorical chart domain, so a
 * caller can map `domain[i]` to `colors[i]`.
 */
export function getDashboardChartColors(domainLength: number): string[] {
  const size = Math.max(1, Math.floor(domainLength) || 0)
  const palette =
    size > THEME_CHART_COLORS.length
      ? [...THEME_CHART_COLORS, ...USER_CHART_COLORS]
      : THEME_CHART_COLORS

  return Array.from(
    { length: size },
    (_, index) => palette[index % palette.length]
  )
}

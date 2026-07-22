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
const channelMonitorCostFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMonitorRatio(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 6,
    useGrouping: false,
  })
}

export function formatChannelMonitorCost(
  value: number | null | undefined
): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return channelMonitorCostFormatter.format(Math.abs(value) < 0.005 ? 0 : value)
}

export function getRatioChange(
  current: number | null,
  previous: number | null
): { direction: 'up' | 'down' | 'same' | 'baseline'; percent: number | null } {
  if (current == null || previous == null) {
    return { direction: 'baseline', percent: null }
  }
  if (Math.abs(current - previous) <= 1e-9) {
    return { direction: 'same', percent: 0 }
  }
  if (previous === 0) {
    return {
      direction: current > previous ? 'up' : 'down',
      percent: null,
    }
  }
  return {
    direction: current > previous ? 'up' : 'down',
    percent: ((current - previous) / previous) * 100,
  }
}

export function formatChangePercent(percent: number | null): string {
  if (percent == null || !Number.isFinite(percent)) return '-'
  const prefix = percent > 0 ? '+' : ''
  return `${prefix}${percent.toFixed(2)}%`
}

export function getChannelGroupTargetRatio(
  upstreamRatio: number | null,
  coefficient: number
): number | null {
  if (upstreamRatio == null) return null
  const target = upstreamRatio * coefficient
  return Number.isFinite(target) ? target : null
}

export function isChannelGroupRatioSynced(
  upstreamRatio: number | null,
  coefficient: number,
  groupRatio: number
): boolean {
  const target = getChannelGroupTargetRatio(upstreamRatio, coefficient)
  return target != null && Math.abs(target - groupRatio) <= 1e-9
}

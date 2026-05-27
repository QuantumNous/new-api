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
import dayjs from '@/lib/dayjs'
import type { ModelStatusHealth } from '../types'

export type ModelStatusTranslator = (
  key: string,
  options?: Record<string, unknown>
) => string

export function formatPercent(value: number) {
  const normalized = value > 1 ? value / 100 : value
  return `${(normalized * 100).toFixed(normalized >= 0.995 ? 0 : 1)}%`
}

export function formatLatency(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '--'
  return `${Math.round(value)}ms`
}

export function formatRelativeTime(
  timestamp: number,
  t?: ModelStatusTranslator
) {
  if (!timestamp) return t?.('No updates yet') ?? 'No updates yet'
  return dayjs.unix(timestamp).fromNow()
}

export function formatAbsoluteTime(
  timestamp: number,
  t?: ModelStatusTranslator
) {
  if (!timestamp) return t?.('No timestamp') ?? 'No timestamp'
  return dayjs.unix(timestamp).format('YYYY-MM-DD HH:mm:ss')
}

export function healthText(
  health: ModelStatusHealth,
  t?: ModelStatusTranslator
) {
  if (health === 'up') return t?.('Healthy') ?? 'Healthy'
  if (health === 'degraded') return t?.('Degraded') ?? 'Degraded'
  if (health === 'down') return t?.('Unavailable') ?? 'Unavailable'
  return t?.('Unknown') ?? 'Unknown'
}

export function healthDescription(
  health: ModelStatusHealth,
  t?: ModelStatusTranslator
) {
  if (health === 'up')
    return t?.('All systems operational') ?? 'All systems operational'
  if (health === 'degraded') {
    return t?.('Some models are degraded') ?? 'Some models are degraded'
  }
  if (health === 'down') {
    return t?.('Some models are unavailable') ?? 'Some models are unavailable'
  }
  return t?.('No status data') ?? 'No status data'
}

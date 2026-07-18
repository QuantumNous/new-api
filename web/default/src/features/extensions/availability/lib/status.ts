/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
    70|but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
export type AvailabilityBadgeStatus = 'ok' | 'warn' | 'error'

export function availabilityStatusFromSuccessRate(
  successRate: number,
  total: number
): AvailabilityBadgeStatus {
  if (total <= 0) return 'ok'
  if (successRate >= 0.95) return 'ok'
  if (successRate >= 0.8) return 'warn'
  return 'error'
}

export function formatUseTimeSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '<1s'
  if (Number.isInteger(seconds)) return `${seconds}s`
  return `${seconds.toFixed(1)}s`
}

export function formatSuccessRatePercent(rate: number, total: number): string {
  if (total <= 0) return '—'
  return `${(rate * 100).toFixed(2)}%`
}

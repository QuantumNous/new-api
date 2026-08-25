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
import type { GrokAccountQuotaWindow, GrokAccountStatus } from '../api'

function formatGrokUnixSeconds(value?: number): string {
  if (!value || !Number.isFinite(value)) return '-'
  return dayjs(value * 1000).format('YYYY-MM-DD HH:mm:ss')
}

export function getGrokQuotaPercent(
  window?: GrokAccountQuotaWindow
): number | null {
  const value = window?.used_percent ?? window?.usage_percent
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, Math.min(100, value))
}

function formatGrokNumber(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)
}

function formatGrokPeriod(value?: string): string {
  if (!value || typeof value !== 'string') return '-'
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : '-'
}

export type GrokQuotaPresentation = {
  usagePercent: number | null
  used: string
  limit: string
  remaining: string
  unit: string
  resetAt: string
  onDemandCap: string
  onDemandUsed: string
  onDemandRemaining: string
  prepaidBalance: string
}

export function formatGrokQuotaWindow(
  window?: GrokAccountQuotaWindow
): GrokQuotaPresentation {
  return {
    usagePercent: getGrokQuotaPercent(window),
    used: formatGrokNumber(window?.used),
    limit: formatGrokNumber(window?.limit),
    remaining: formatGrokNumber(window?.remaining),
    unit: window?.unit?.trim() || '-',
    resetAt: formatGrokPeriod(window?.period_end),
    onDemandCap: formatGrokNumber(window?.on_demand_cap),
    onDemandUsed: formatGrokNumber(window?.on_demand_used),
    onDemandRemaining: formatGrokNumber(window?.on_demand_remaining),
    prepaidBalance: formatGrokNumber(window?.prepaid_balance),
  }
}

export function formatGrokAccountStatus(status: GrokAccountStatus | null) {
  return {
    authStatus: status?.auth_status || 'pending',
    plan: status?.billing_plan || status?.tier_raw || '-',
    billingObservedAt: formatGrokUnixSeconds(status?.billing_observed_at),
    lastRefreshAt: formatGrokUnixSeconds(status?.last_refresh_at),
    monthly: formatGrokQuotaWindow(status?.monthly),
    weekly: formatGrokQuotaWindow(status?.weekly),
  }
}

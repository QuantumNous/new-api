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
import type {
  SelfSubscriptionDataResponse,
  SubscriptionQuota,
  SubscriptionUsageWindow,
} from '@/features/subscriptions/types'

export type ProfileUsageWindowSummary = {
  totalQuota: number
  usedQuota: number
  remainingQuota: number
  unlimited: boolean
  notIncluded: boolean
  resetAt: number
  usagePercent: number
}

export type ProfileSubscriptionSummary = ProfileUsageWindowSummary & {
  planTitle: string
  remainingDays: number | null
  mediaCredits: ProfileUsageWindowSummary
}

function finiteNonNegative(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0
  }
  return value
}

function fallbackTotalQuota(
  data: NonNullable<SelfSubscriptionDataResponse['current_subscription']>
): number {
  if (
    typeof data.subscription.amount_total === 'number' &&
    Number.isFinite(data.subscription.amount_total) &&
    data.subscription.amount_total >= 0
  ) {
    return data.subscription.amount_total
  }
  return finiteNonNegative(data.plan.total_amount)
}

function fallbackUnlimited(
  data: NonNullable<SelfSubscriptionDataResponse['current_subscription']>
): boolean {
  if (
    typeof data.subscription.amount_total === 'number' &&
    Number.isFinite(data.subscription.amount_total) &&
    data.subscription.amount_total >= 0
  ) {
    return data.subscription.amount_total === 0
  }
  return finiteNonNegative(data.plan.total_amount) === 0
}

function normalizePlanTitle(
  data: NonNullable<SelfSubscriptionDataResponse['current_subscription']>
): string {
  const title = data.plan.title.trim()
  if (title) return title
  return `#${data.subscription.plan_id}`
}

function normalizeRemainingDays(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.floor(Math.max(0, value))
}

function normalizeUsagePercent(
  usedQuota: number,
  totalQuota: number,
  unlimited: boolean
): number {
  if (unlimited || totalQuota === 0) return 0
  return Math.min(100, Math.max(0, (usedQuota / totalQuota) * 100))
}

function normalizeUsageWindow(
  window: SubscriptionUsageWindow | undefined,
  kind: 'quota' | 'media' = 'quota'
): ProfileUsageWindowSummary {
  const totalQuota = finiteNonNegative(window?.total)
  const usedQuota = finiteNonNegative(window?.used)
  const remainingQuota =
    window?.remaining === undefined
      ? Math.max(0, totalQuota - usedQuota)
      : finiteNonNegative(window.remaining)
  const unlimited =
    window?.unlimited === true || (kind === 'quota' && totalQuota === 0)
  const notIncluded = kind === 'media' && !unlimited && totalQuota === 0

  return {
    totalQuota,
    usedQuota,
    remainingQuota,
    unlimited,
    notIncluded,
    resetAt: finiteNonNegative(window?.reset_at),
    usagePercent: normalizeUsagePercent(usedQuota, totalQuota, unlimited),
  }
}

function normalizeQuotaWindow(
  quota: SubscriptionQuota
): ProfileUsageWindowSummary {
  const totalQuota = finiteNonNegative(quota.amount_total)
  const usedQuota = finiteNonNegative(quota.amount_used)
  const remainingQuota =
    quota.amount_remaining === undefined
      ? Math.max(0, totalQuota - usedQuota)
      : finiteNonNegative(quota.amount_remaining)
  const unlimited = quota.unlimited === true || totalQuota === 0

  return {
    totalQuota,
    usedQuota,
    remainingQuota,
    unlimited,
    notIncluded: false,
    resetAt: finiteNonNegative(quota.reset_at),
    usagePercent: normalizeUsagePercent(usedQuota, totalQuota, unlimited),
  }
}

function fallbackUsageWindow(
  data: NonNullable<SelfSubscriptionDataResponse['current_subscription']>
): ProfileUsageWindowSummary {
  const totalQuota = fallbackTotalQuota(data)
  const usedQuota = finiteNonNegative(data.subscription.amount_used)
  const remainingQuota = Math.max(0, totalQuota - usedQuota)
  const unlimited = fallbackUnlimited(data)

  return {
    totalQuota,
    usedQuota,
    remainingQuota,
    unlimited,
    notIncluded: false,
    resetAt: 0,
    usagePercent: normalizeUsagePercent(usedQuota, totalQuota, unlimited),
  }
}

function normalizeMonthlySummary(
  data: SelfSubscriptionDataResponse,
  currentSubscription: NonNullable<
    SelfSubscriptionDataResponse['current_subscription']
  >
): ProfileUsageWindowSummary {
  if (data.monthly_bucket !== undefined) {
    return normalizeUsageWindow(data.monthly_bucket)
  }

  if (data.quota !== undefined) {
    return normalizeQuotaWindow(data.quota)
  }

  return fallbackUsageWindow(currentSubscription)
}

export function buildProfileSubscriptionSummary(
  data: SelfSubscriptionDataResponse | undefined
): ProfileSubscriptionSummary | null {
  const currentSubscription = data?.current_subscription
  if (!currentSubscription) return null
  if (currentSubscription.subscription.status !== 'active') return null

  const monthlySummary = normalizeMonthlySummary(data, currentSubscription)

  return {
    planTitle: normalizePlanTitle(currentSubscription),
    totalQuota: monthlySummary.totalQuota,
    usedQuota: monthlySummary.usedQuota,
    remainingQuota: monthlySummary.remainingQuota,
    unlimited: monthlySummary.unlimited,
    notIncluded: false,
    remainingDays: normalizeRemainingDays(data?.remaining_days),
    resetAt: 0,
    usagePercent: monthlySummary.usagePercent,
    mediaCredits: normalizeUsageWindow(data?.media_credits, 'media'),
  }
}

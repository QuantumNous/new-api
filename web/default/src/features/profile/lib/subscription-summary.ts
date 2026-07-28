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
import type { SelfSubscriptionDataResponse } from '@/features/subscriptions/types'

export type ProfileSubscriptionSummary = {
  planTitle: string
  totalQuota: number
  usedQuota: number
  remainingQuota: number
  unlimited: boolean
  remainingDays: number | null
  usagePercent: number
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

export function buildProfileSubscriptionSummary(
  data: SelfSubscriptionDataResponse | undefined
): ProfileSubscriptionSummary | null {
  const currentSubscription = data?.current_subscription
  if (!currentSubscription) return null
  if (currentSubscription.subscription.status !== 'active') return null

  const totalQuota =
    data?.quota?.amount_total === undefined
      ? fallbackTotalQuota(currentSubscription)
      : finiteNonNegative(data.quota.amount_total)
  const usedQuota =
    data?.quota?.amount_used === undefined
      ? finiteNonNegative(currentSubscription.subscription.amount_used)
      : finiteNonNegative(data.quota.amount_used)
  const remainingQuota =
    data?.quota?.amount_remaining === undefined
      ? Math.max(0, totalQuota - usedQuota)
      : finiteNonNegative(data.quota.amount_remaining)
  const unlimited =
    data?.quota === undefined
      ? fallbackUnlimited(currentSubscription)
      : data.quota.unlimited === true

  return {
    planTitle: normalizePlanTitle(currentSubscription),
    totalQuota,
    usedQuota,
    remainingQuota,
    unlimited,
    remainingDays: normalizeRemainingDays(data?.remaining_days),
    usagePercent: normalizeUsagePercent(usedQuota, totalQuota, unlimited),
  }
}

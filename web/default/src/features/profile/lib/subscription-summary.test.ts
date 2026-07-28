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
import { describe, expect, test } from 'bun:test'
import type {
  CurrentSubscriptionRecord,
  SelfSubscriptionDataResponse,
} from '@/features/subscriptions/types'
import * as profileLib from './index'

const buildCurrentSubscription = (
  overrides: Partial<CurrentSubscriptionRecord> = {}
): CurrentSubscriptionRecord => ({
  subscription: {
    id: 1,
    user_id: 2,
    plan_id: 3,
    status: 'active',
    start_time: 1_000,
    end_time: 2_000,
    amount_total: 100_000,
    amount_used: 25_000,
  },
  plan: {
    id: 3,
    title: 'Pro',
    price_amount: 29,
    currency: 'USD',
    duration_unit: 'month',
    duration_value: 1,
    quota_reset_period: 'monthly',
    enabled: true,
    sort_order: 1,
    max_purchase_per_user: 0,
    total_amount: 100_000,
  },
  usage_limits: {
    window_5h_used: 0,
    window_5h_reset_at: 0,
    window_week_used: 0,
    window_week_reset_at: 0,
  },
  ...overrides,
})

const expectAdapterExport = () => {
  expect(
    (profileLib as Record<string, unknown>).buildProfileSubscriptionSummary
  ).toBeFunction()

  return (profileLib as typeof profileLib & {
    buildProfileSubscriptionSummary: (
      data: SelfSubscriptionDataResponse | undefined
    ) => unknown
  }).buildProfileSubscriptionSummary
}

describe('buildProfileSubscriptionSummary', () => {
  test('builds an active Pro summary from canonical top-level quota', () => {
    const buildProfileSubscriptionSummary = expectAdapterExport()

    expect(
      buildProfileSubscriptionSummary({
        current_subscription: buildCurrentSubscription(),
        quota: {
          amount_total: 100_000,
          amount_used: 25_000,
          amount_remaining: 75_000,
          unlimited: false,
        },
        remaining_days: 19,
      })
    ).toEqual({
      planTitle: 'Pro',
      totalQuota: 100_000,
      usedQuota: 25_000,
      remainingQuota: 75_000,
      unlimited: false,
      remainingDays: 19,
      usagePercent: 25,
    })
  })

  test('returns null when self-subscription data is unavailable', () => {
    const buildProfileSubscriptionSummary = expectAdapterExport()

    expect(buildProfileSubscriptionSummary(undefined)).toBeNull()
  })

  test('returns null when current subscription is missing', () => {
    const buildProfileSubscriptionSummary = expectAdapterExport()

    expect(buildProfileSubscriptionSummary({})).toBeNull()
    expect(
      buildProfileSubscriptionSummary({ current_subscription: null })
    ).toBeNull()
  })

  test('returns null when current subscription is inactive', () => {
    const buildProfileSubscriptionSummary = expectAdapterExport()

    expect(
      buildProfileSubscriptionSummary({
        current_subscription: buildCurrentSubscription({
          subscription: {
            ...buildCurrentSubscription().subscription,
            status: 'ended',
          },
        }),
      })
    ).toBeNull()
  })

  test('falls back to current subscription quota when top-level quota is missing', () => {
    const buildProfileSubscriptionSummary = expectAdapterExport()

    expect(
      buildProfileSubscriptionSummary({
        current_subscription: buildCurrentSubscription({
          subscription: {
            ...buildCurrentSubscription().subscription,
            amount_total: 0,
            amount_used: 40,
          },
          plan: {
            ...buildCurrentSubscription().plan,
            total_amount: 200,
          },
        }),
        remaining_days: 7.9,
      })
    ).toMatchObject({
      totalQuota: 200,
      usedQuota: 40,
      remainingQuota: 160,
      remainingDays: 7,
      usagePercent: 20,
    })
  })

  test('clamps invalid numbers and overused quota to a finite safe summary', () => {
    const buildProfileSubscriptionSummary = expectAdapterExport()

    expect(
      buildProfileSubscriptionSummary({
        current_subscription: buildCurrentSubscription(),
        quota: {
          amount_total: 100,
          amount_used: 125,
          amount_remaining: -25,
          unlimited: false,
        },
        remaining_days: Number.NaN,
      })
    ).toMatchObject({
      totalQuota: 100,
      usedQuota: 125,
      remainingQuota: 0,
      remainingDays: null,
      usagePercent: 100,
    })

    expect(
      buildProfileSubscriptionSummary({
        current_subscription: buildCurrentSubscription({
          subscription: {
            ...buildCurrentSubscription().subscription,
            amount_total: Number.NaN,
            amount_used: -10,
          },
          plan: {
            ...buildCurrentSubscription().plan,
            total_amount: -1,
          },
        }),
        remaining_days: -2,
      })
    ).toMatchObject({
      totalQuota: 0,
      usedQuota: 0,
      remainingQuota: 0,
      remainingDays: 0,
      usagePercent: 0,
    })
  })
})

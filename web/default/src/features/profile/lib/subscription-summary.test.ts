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
  ...overrides,
})

const expectAdapterExport = () => {
  expect(
    (profileLib as Record<string, unknown>).buildProfileSubscriptionSummary
  ).toBeFunction()

  return (
    profileLib as typeof profileLib & {
      buildProfileSubscriptionSummary: (
        data: SelfSubscriptionDataResponse | undefined
      ) => unknown
    }
  ).buildProfileSubscriptionSummary
}

describe('buildProfileSubscriptionSummary', () => {
  test('builds an active Pro summary from canonical monthly and media buckets', () => {
    const buildProfileSubscriptionSummary = expectAdapterExport()

    expect(
      buildProfileSubscriptionSummary({
        current_subscription: buildCurrentSubscription(),
        monthly_bucket: {
          total: 200_000,
          used: 50_000,
          remaining: 150_000,
          unlimited: false,
        },
        quota: {
          amount_total: 100_000,
          amount_used: 25_000,
          amount_remaining: 75_000,
          unlimited: false,
        },
        media_credits: {
          total: 120,
          used: 35,
          remaining: 85,
          reset_at: 1_716_000_000,
          unlimited: false,
        },
        remaining_days: 19,
      })
    ).toEqual({
      planTitle: 'Pro',
      totalQuota: 200_000,
      usedQuota: 50_000,
      remainingQuota: 150_000,
      unlimited: false,
      notIncluded: false,
      remainingDays: 19,
      resetAt: 0,
      usagePercent: 25,
      mediaCredits: {
        totalQuota: 120,
        usedQuota: 35,
        remainingQuota: 85,
        unlimited: false,
        notIncluded: false,
        resetAt: 1_716_000_000,
        usagePercent: 29.166666666666668,
      },
    })
  })

  test('falls back to canonical top-level quota when monthly bucket is missing', () => {
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
    ).toMatchObject({
      totalQuota: 100_000,
      usedQuota: 25_000,
      remainingQuota: 75_000,
      unlimited: false,
      remainingDays: 19,
      usagePercent: 25,
    })
  })

  test('keeps top-level monthly reset metadata out of the profile summary', () => {
    const buildProfileSubscriptionSummary = expectAdapterExport()

    expect(
      buildProfileSubscriptionSummary({
        current_subscription: buildCurrentSubscription(),
        monthly_bucket: {
          total: 200_000,
          used: 50_000,
          remaining: 150_000,
          reset_at: 1_716_000_000,
          unlimited: false,
        },
      })
    ).toMatchObject({
      totalQuota: 200_000,
      usedQuota: 50_000,
      remainingQuota: 150_000,
      unlimited: false,
      notIncluded: false,
      resetAt: 0,
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

  test('falls back to finite current subscription quota when top-level quota is missing', () => {
    const buildProfileSubscriptionSummary = expectAdapterExport()

    expect(
      buildProfileSubscriptionSummary({
        current_subscription: buildCurrentSubscription({
          subscription: {
            ...buildCurrentSubscription().subscription,
            amount_total: 120,
            amount_used: 30,
          },
          plan: {
            ...buildCurrentSubscription().plan,
            total_amount: 200,
          },
        }),
        remaining_days: 7.9,
      })
    ).toMatchObject({
      totalQuota: 120,
      usedQuota: 30,
      remainingQuota: 90,
      remainingDays: 7,
      usagePercent: 25,
    })
  })

  test('preserves unlimited current subscription quota when top-level quota is missing', () => {
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
      })
    ).toMatchObject({
      totalQuota: 0,
      usedQuota: 40,
      remainingQuota: 0,
      unlimited: true,
      usagePercent: 0,
    })
  })

  test('falls back to subscription plan id when the title is blank', () => {
    const buildProfileSubscriptionSummary = expectAdapterExport()

    expect(
      buildProfileSubscriptionSummary({
        current_subscription: buildCurrentSubscription({
          subscription: {
            ...buildCurrentSubscription().subscription,
            plan_id: 42,
          },
          plan: {
            ...buildCurrentSubscription().plan,
            title: '   ',
          },
        }),
      })
    ).toMatchObject({
      planTitle: '#42',
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

  test('does not synthesize short-window summaries when backend omits them', () => {
    const buildProfileSubscriptionSummary = expectAdapterExport()

    const summary = buildProfileSubscriptionSummary({
      current_subscription: buildCurrentSubscription(),
      monthly_bucket: {
        total: 10,
        used: 4,
        remaining: 6,
        unlimited: false,
      },
      media_credits: {
        total: 40,
        used: 12,
        remaining: 28,
        unlimited: false,
      },
    })

    expect(summary).toMatchObject({
      totalQuota: 10,
      usedQuota: 4,
      remainingQuota: 6,
      mediaCredits: {
        totalQuota: 40,
        usedQuota: 12,
        remainingQuota: 28,
      },
    })
    expect(summary && 'window5h' in summary).toBe(false)
    expect(summary && 'window7d' in summary).toBe(false)
  })

  test('normalizes media credits separately from quota windows', () => {
    const buildProfileSubscriptionSummary = expectAdapterExport()

    expect(
      buildProfileSubscriptionSummary({
        current_subscription: buildCurrentSubscription(),
        media_credits: {
          total: 40,
          used: 12,
          remaining: 28,
          reset_at: 1_716_000_000,
          unlimited: false,
        },
      })
    ).toMatchObject({
      mediaCredits: {
        totalQuota: 40,
        usedQuota: 12,
        remainingQuota: 28,
        unlimited: false,
        notIncluded: false,
        resetAt: 1_716_000_000,
        usagePercent: 30,
      },
    })

    expect(
      buildProfileSubscriptionSummary({
        current_subscription: buildCurrentSubscription(),
        media_credits: {
          total: 0,
          used: 0,
          remaining: 0,
          unlimited: false,
        },
      })
    ).toMatchObject({
      mediaCredits: {
        totalQuota: 0,
        usedQuota: 0,
        remainingQuota: 0,
        unlimited: false,
        notIncluded: true,
        resetAt: 0,
        usagePercent: 0,
      },
    })

    expect(
      buildProfileSubscriptionSummary({
        current_subscription: buildCurrentSubscription(),
        media_credits: {
          total: 0,
          used: 8,
          remaining: 0,
          reset_at: 1_716_000_000,
          unlimited: true,
        },
      })
    ).toMatchObject({
      mediaCredits: {
        totalQuota: 0,
        usedQuota: 8,
        remainingQuota: 0,
        unlimited: false,
        notIncluded: true,
        resetAt: 1_716_000_000,
        usagePercent: 0,
      },
    })
  })
})

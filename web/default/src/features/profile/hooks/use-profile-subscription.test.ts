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
import type { ApiRequestConfig } from '@/lib/api'
import type {
  ApiResponse,
  CurrentSubscriptionRecord,
  SelfSubscriptionDataResponse,
} from '@/features/subscriptions/types'
import * as profileHooks from './index'

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

const expectLoaderExport = () => {
  expect(
    (profileHooks as Record<string, unknown>).loadProfileSubscriptionSummary
  ).toBeFunction()

  return (
    profileHooks as typeof profileHooks & {
      loadProfileSubscriptionSummary: (
        fetcher: (
          config?: ApiRequestConfig
        ) => Promise<ApiResponse<SelfSubscriptionDataResponse>>
      ) => Promise<unknown>
    }
  ).loadProfileSubscriptionSummary
}

describe('loadProfileSubscriptionSummary', () => {
  test('builds a Pro summary from an active successful response', async () => {
    const loadProfileSubscriptionSummary = expectLoaderExport()

    await expect(
      loadProfileSubscriptionSummary(async () => ({
        success: true,
        data: {
          current_subscription: buildCurrentSubscription(),
          quota: {
            amount_total: 100_000,
            amount_used: 25_000,
            amount_remaining: 75_000,
            unlimited: false,
          },
          remaining_days: 19,
        },
      }))
    ).resolves.toEqual({
      planTitle: 'Pro',
      totalQuota: 100_000,
      usedQuota: 25_000,
      remainingQuota: 75_000,
      unlimited: false,
      remainingDays: 19,
      usagePercent: 25,
    })
  })

  test('returns null when the API response is unsuccessful', async () => {
    const loadProfileSubscriptionSummary = expectLoaderExport()

    await expect(
      loadProfileSubscriptionSummary(async () => ({
        success: false,
        message: 'not available',
      }))
    ).resolves.toBeNull()
  })

  test('returns null when the fetcher throws', async () => {
    const loadProfileSubscriptionSummary = expectLoaderExport()

    await expect(
      loadProfileSubscriptionSummary(async () => {
        throw new Error('network down')
      })
    ).resolves.toBeNull()
  })

  test('returns null when a successful response has no active data', async () => {
    const loadProfileSubscriptionSummary = expectLoaderExport()

    await expect(
      loadProfileSubscriptionSummary(async () => ({
        success: true,
        data: {
          current_subscription: buildCurrentSubscription({
            subscription: {
              ...buildCurrentSubscription().subscription,
              status: 'expired',
            },
          }),
        },
      }))
    ).resolves.toBeNull()
  })

  test('uses a silent request config for the subscription API lookup', async () => {
    const loadProfileSubscriptionSummary = expectLoaderExport()
    const configs: (ApiRequestConfig | undefined)[] = []

    await loadProfileSubscriptionSummary(async (config) => {
      configs.push(config)
      return { success: false }
    })

    expect(configs).toEqual([
      {
        skipBusinessError: true,
        skipErrorHandler: true,
      },
    ])
  })
})

describe('useProfileSubscriptionSummary', () => {
  test('keys subscription cache by authenticated user id', () => {
    const options =
      profileHooks.createProfileSubscriptionSummaryQueryOptions(42)

    expect(options.queryKey).toEqual(['profile', 'subscription-summary', 42])
    expect(options.enabled).toBe(true)
    expect(options.retry).toBe(false)
  })

  test('disables subscription loading until a user id is available', () => {
    const undefinedOptions =
      profileHooks.createProfileSubscriptionSummaryQueryOptions(undefined)
    const nullOptions =
      profileHooks.createProfileSubscriptionSummaryQueryOptions(null)

    expect(undefinedOptions.queryKey).toEqual([
      'profile',
      'subscription-summary',
      null,
    ])
    expect(nullOptions.queryKey).toEqual([
      'profile',
      'subscription-summary',
      null,
    ])
    expect(undefinedOptions.enabled).toBe(false)
    expect(nullOptions.enabled).toBe(false)
  })
})

describe('Profile subscription wiring', () => {
  test('passes the loaded profile id into the subscription summary hook', async () => {
    const source = await Bun.file(
      new URL('../index.tsx', import.meta.url)
    ).text()

    expect(source).toContain('useProfileSubscriptionSummary(profile?.id)')
  })
})

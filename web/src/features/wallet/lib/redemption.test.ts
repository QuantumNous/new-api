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
import { describe, expect, test } from 'vitest'

import type { TypedRedemption } from '@/features/agents/types'

import {
  executeRedemption,
  formatRedemptionEndTime,
  type RedemptionExecutionDependencies,
} from './redemption'

function dependencies(
  result:
    | { success: true; message: string; data: TypedRedemption }
    | { success: false; message: string }
) {
  const calls = {
    formattedQuotas: [] as number[],
    formattedDates: [] as number[],
    successes: [] as Array<
      | { type: 'quota'; quota: string }
      | { type: 'subscription'; planTitle: string; endDate: string }
    >,
    failures: 0,
    userRefreshes: 0,
    subscriptionRefreshes: 0,
  }
  const deps: RedemptionExecutionDependencies = {
    redeem: async () => result,
    formatQuota: (quota) => {
      calls.formattedQuotas.push(quota)
      return `quota:${quota}`
    },
    formatEndTime: (endTime) => {
      calls.formattedDates.push(endTime)
      return `date:${endTime}`
    },
    notifySuccess: (notice) => calls.successes.push(notice),
    notifyFailure: () => {
      calls.failures += 1
    },
    refreshUser: async () => {
      calls.userRefreshes += 1
    },
    refreshSubscriptions: async () => {
      calls.subscriptionRefreshes += 1
    },
  }
  return { calls, deps }
}

describe('wallet typed redemption', () => {
  test('quota redemption preserves quota formatting and refreshes only user state', async () => {
    const { calls, deps } = dependencies({
      success: true,
      message: '',
      data: { type: 'quota', quota: 250_000 },
    })

    expect(await executeRedemption('quota-code', deps)).toBe(true)
    expect(calls.formattedQuotas).toEqual([250_000])
    expect(calls.formattedDates).toEqual([])
    expect(calls.successes).toEqual([
      { type: 'quota', quota: 'quota:250000' },
    ])
    expect(calls.userRefreshes).toBe(1)
    expect(calls.subscriptionRefreshes).toBe(0)
  })

  test('subscription redemption never quota-formats its ID and visibly refreshes subscriptions', async () => {
    const { calls, deps } = dependencies({
      success: true,
      message: '',
      data: {
        type: 'subscription',
        subscription_id: 987654,
        plan_title: 'Pro Annual',
        end_time: 1_900_000_000,
      },
    })

    expect(await executeRedemption('plan-code', deps)).toBe(true)
    expect(calls.formattedQuotas).toEqual([])
    expect(calls.formattedDates).toEqual([1_900_000_000])
    expect(calls.successes).toEqual([
      {
        type: 'subscription',
        planTitle: 'Pro Annual',
        endDate: 'date:1900000000',
      },
    ])
    expect(calls.userRefreshes).toBe(1)
    expect(calls.subscriptionRefreshes).toBe(1)
  })

  test('business and transport failures expose only the generic failure effect', async () => {
    const business = dependencies({
      success: false,
      message: 'sensitive internal business detail',
    })
    expect(await executeRedemption('bad-code', business.deps)).toBe(false)
    expect(business.calls.failures).toBe(1)
    expect(business.calls.successes).toEqual([])
    expect(business.calls.userRefreshes).toBe(0)

    const transport = dependencies({
      success: false,
      message: 'unused',
    })
    transport.deps.redeem = async () => {
      throw new Error('sensitive transport detail')
    }
    expect(await executeRedemption('bad-code', transport.deps)).toBe(false)
    expect(transport.calls.failures).toBe(1)
    expect(transport.calls.successes).toEqual([])
  })

  test('refresh failures never reclassify an irreversible redemption as failed', async () => {
    const { calls, deps } = dependencies({
      success: true,
      message: '',
      data: { type: 'quota', quota: 100 },
    })
    deps.refreshUser = async () => {
      throw new Error('refresh failed')
    }
    expect(await executeRedemption('already-redeemed', deps)).toBe(true)
    expect(calls.failures).toBe(0)
    expect(calls.successes).toEqual([{ type: 'quota', quota: 'quota:100' }])
  })

  test('formats project Chinese language codes with valid Intl locales', () => {
    expect(() => formatRedemptionEndTime(1_900_000_000, 'zhCN')).not.toThrow()
    expect(() => formatRedemptionEndTime(1_900_000_000, 'zhTW')).not.toThrow()
  })

  test('waits for the actual subscription refresh before reporting completion', async () => {
    const { deps } = dependencies({
      success: true,
      message: '',
      data: {
        type: 'subscription',
        subscription_id: 9,
        plan_title: 'Pro',
        end_time: 1_900_000_000,
      },
    })
    let releaseNetwork: (() => void) | undefined
    let signalStarted: (() => void) | undefined
    const networkStarted = new Promise<void>((resolve) => {
      signalStarted = resolve
    })
    deps.refreshSubscriptions = async () => {
      signalStarted?.()
      await new Promise<void>((resolve) => {
        releaseNetwork = resolve
      })
    }

    let settled = false
    const redemption = executeRedemption('subscription-code', deps).then(
      (result) => {
        settled = true
        return result
      }
    )
    await networkStarted
    expect(settled).toBe(false)
    releaseNetwork?.()
    expect(await redemption).toBe(true)
    expect(settled).toBe(true)
  })
})

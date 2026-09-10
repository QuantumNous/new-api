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
import type { TypedRedemptionRequest } from '@/features/agents/types'
import { toIntlLocale } from '@/i18n/languages'

import type { RedemptionResponse } from '../types'

type RedemptionSuccessNotice =
  | { type: 'quota'; quota: string }
  | { type: 'subscription'; planTitle: string; endDate: string }

export type RedemptionExecutionDependencies = {
  redeem: (request: TypedRedemptionRequest) => Promise<RedemptionResponse>
  formatQuota: (quota: number) => string
  formatEndTime: (endTime: number) => string
  notifySuccess: (notice: RedemptionSuccessNotice) => void
  notifyFailure: () => void
  refreshUser: () => void | Promise<void>
  refreshSubscriptions: () => void | Promise<void>
}

export function formatRedemptionEndTime(
  endTime: number,
  language: string | undefined
): string {
  return new Intl.DateTimeFormat(toIntlLocale(language), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(endTime * 1000))
}

async function settleRedemptionRefreshes(
  refreshes: Array<() => void | Promise<void>>
): Promise<void> {
  await Promise.allSettled(refreshes.map(async (refresh) => refresh()))
}

export async function executeRedemption(
  code: string,
  dependencies: RedemptionExecutionDependencies
): Promise<boolean> {
  let response: RedemptionResponse
  try {
    response = await dependencies.redeem({ key: code })
  } catch {
    dependencies.notifyFailure()
    return false
  }

  if (!response.success) {
    dependencies.notifyFailure()
    return false
  }

  if (response.data.type === 'quota') {
    try {
      dependencies.notifySuccess({
        type: 'quota',
        quota: dependencies.formatQuota(response.data.quota),
      })
    } catch {
      // The server has already redeemed the code. Presentation failures must
      // not invite a retry that can only report the code as used.
    }
    await settleRedemptionRefreshes([dependencies.refreshUser])
    return true
  }

  try {
    dependencies.notifySuccess({
      type: 'subscription',
      planTitle: response.data.plan_title,
      endDate: dependencies.formatEndTime(response.data.end_time),
    })
  } catch {
    // Redemption is already committed; refresh state even if formatting fails.
  }
  await settleRedemptionRefreshes([
    dependencies.refreshUser,
    dependencies.refreshSubscriptions,
  ])
  return true
}

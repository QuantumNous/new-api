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
import type { UsageLog } from '@/features/usage-logs/data/schema'

export type EasySavingsSummary = {
  officialCost: number
  siteCost: number
  savings: number
  comparableRequests: number
}

type EasySavingsRates = {
  priceRate: number
  usdExchangeRate: number
  quotaPerUnit: number
}

type LogBillingData = {
  group_ratio?: unknown
  user_group_ratio?: unknown
  fee_quota?: unknown
}

const EMPTY_SAVINGS: EasySavingsSummary = {
  officialCost: 0,
  siteCost: 0,
  savings: 0,
  comparableRequests: 0,
}

function readLogBillingData(other: string): LogBillingData | null {
  try {
    const parsed = JSON.parse(other) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as LogBillingData
  } catch {
    return null
  }
}

export function estimateEasySavings(
  logs: UsageLog[],
  rates: EasySavingsRates
): EasySavingsSummary {
  if (
    !Number.isFinite(rates.priceRate) ||
    rates.priceRate <= 0 ||
    !Number.isFinite(rates.usdExchangeRate) ||
    rates.usdExchangeRate <= 0 ||
    !Number.isFinite(rates.quotaPerUnit) ||
    rates.quotaPerUnit <= 0
  ) {
    return EMPTY_SAVINGS
  }

  let officialCost = 0
  let siteCost = 0
  let comparableRequests = 0

  for (const log of logs) {
    if (log.type !== 2) continue

    const billing = readLogBillingData(log.other)
    const userGroupRatio = Number(billing?.user_group_ratio)
    const groupRatio =
      Number.isFinite(userGroupRatio) && userGroupRatio > 0
        ? userGroupRatio
        : Number(billing?.group_ratio)
    if (!Number.isFinite(groupRatio) || groupRatio <= 0) continue

    const feeQuota = Number(billing?.fee_quota)
    const chargedQuota =
      Number.isFinite(feeQuota) && feeQuota >= 0 ? feeQuota : log.quota
    if (!Number.isFinite(chargedQuota) || chargedQuota <= 0) continue

    const billedCredits = chargedQuota / rates.quotaPerUnit
    siteCost += billedCredits * rates.priceRate
    officialCost += (billedCredits / groupRatio) * rates.usdExchangeRate
    comparableRequests += 1
  }

  return {
    officialCost,
    siteCost,
    savings: officialCost - siteCost,
    comparableRequests,
  }
}

export function formatEasySavingsCny(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(amount) < 1 ? 4 : 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

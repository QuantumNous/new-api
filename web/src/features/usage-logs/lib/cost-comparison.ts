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
import type { LogOtherData } from '../types'

export type LogCostComparison = {
  officialCost: number
  siteCost: number
  savings: number
}

export function getLogCostComparison(
  quota: number,
  other: LogOtherData | null,
  rates: { priceRate: number; usdExchangeRate: number; quotaPerUnit: number }
): LogCostComparison | null {
  if (other?.billing_source === 'subscription') return null

  const userRatio = Number(other?.user_group_ratio)
  const groupRatio =
    Number.isFinite(userRatio) && userRatio > 0
      ? userRatio
      : Number(other?.group_ratio)
  const feeQuota = Number(other?.fee_quota)
  const chargedQuota =
    Number.isFinite(feeQuota) && feeQuota >= 0 ? feeQuota : quota

  if (
    !Number.isFinite(groupRatio) ||
    groupRatio <= 0 ||
    !Number.isFinite(chargedQuota) ||
    chargedQuota <= 0 ||
    !Number.isFinite(rates.priceRate) ||
    rates.priceRate <= 0 ||
    !Number.isFinite(rates.usdExchangeRate) ||
    rates.usdExchangeRate <= 0 ||
    !Number.isFinite(rates.quotaPerUnit) ||
    rates.quotaPerUnit <= 0
  ) {
    return null
  }

  const billedCredits = chargedQuota / rates.quotaPerUnit
  const siteCost = billedCredits * rates.priceRate
  const officialCost = (billedCredits / groupRatio) * rates.usdExchangeRate
  const savings = officialCost - siteCost

  if (!Number.isFinite(savings) || savings <= 0) return null
  return { officialCost, siteCost, savings }
}

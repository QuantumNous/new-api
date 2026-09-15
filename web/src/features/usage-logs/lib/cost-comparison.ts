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
import { isViolationFeeLog } from './format'
import { OFFICIAL_PRICE_USD_TO_CNY } from './model-provider'
import { isPerCallBilling } from './utils'

export { OFFICIAL_PRICE_USD_TO_CNY } from './model-provider'

export type LogCostComparison = {
  baseCost: number
  siteCost: number
  savings: number
}

export type LogQuotaComparison = {
  baseQuota: number
  chargedQuota: number
  savedQuota: number
}

export function getLogGroupRatio(other: LogOtherData | null): number | null {
  const userRatio = other?.user_group_ratio
  const groupRatio =
    typeof userRatio === 'number' && Number.isFinite(userRatio) && userRatio > 0
      ? userRatio
      : other?.group_ratio
  return typeof groupRatio === 'number' &&
    Number.isFinite(groupRatio) &&
    groupRatio >= 0
    ? groupRatio
    : null
}

export function getLogChargedQuota(
  quota: number,
  other: LogOtherData | null
): number {
  const feeQuota = other?.fee_quota
  return typeof feeQuota === 'number' &&
    Number.isFinite(feeQuota) &&
    feeQuota >= 0
    ? feeQuota
    : quota
}

// Reconstruct the recorded model price with the group multiplier set to one.
// Historical logs must never be repriced using today's model configuration.
export function getLogQuotaComparison(
  quota: number,
  other: LogOtherData | null
): LogQuotaComparison | null {
  if (
    other?.billing_source === 'subscription' ||
    isViolationFeeLog(other) ||
    isPerCallBilling(other?.model_price)
  ) {
    return null
  }

  const groupRatio = getLogGroupRatio(other)
  const chargedQuota = getLogChargedQuota(quota, other)

  if (
    typeof groupRatio !== 'number' ||
    !Number.isFinite(groupRatio) ||
    groupRatio <= 0 ||
    !Number.isFinite(chargedQuota) ||
    chargedQuota < 0
  ) {
    return null
  }

  const baseQuota = chargedQuota / groupRatio
  const savedQuota = baseQuota - chargedQuota
  if (!Number.isFinite(baseQuota) || !Number.isFinite(savedQuota)) return null
  return { baseQuota, chargedQuota, savedQuota }
}

export function getLogCostComparison(
  quota: number,
  other: LogOtherData | null,
  rates: {
    priceRate: number
    quotaPerUnit: number
    referenceCurrency?: 'CNY' | 'USD'
  }
): LogCostComparison | null {
  const comparison = getLogQuotaComparison(quota, other)
  if (
    !comparison ||
    !Number.isFinite(rates.priceRate) ||
    rates.priceRate <= 0 ||
    !Number.isFinite(rates.quotaPerUnit) ||
    rates.quotaPerUnit <= 0
  ) {
    return null
  }

  const siteCost =
    (comparison.chargedQuota / rates.quotaPerUnit) * rates.priceRate
  let referenceRate = rates.priceRate
  if (rates.referenceCurrency === 'USD') {
    referenceRate = OFFICIAL_PRICE_USD_TO_CNY
  }
  if (rates.referenceCurrency === 'CNY') referenceRate = 1
  // Compare both amounts in CNY, without altering the site's recharge price.
  const baseCost = (comparison.baseQuota / rates.quotaPerUnit) * referenceRate
  const savings = baseCost - siteCost
  if (
    !Number.isFinite(baseCost) ||
    !Number.isFinite(siteCost) ||
    !Number.isFinite(savings) ||
    savings <= 0
  ) {
    return null
  }
  return { baseCost, siteCost, savings }
}

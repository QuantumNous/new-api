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
import { LOG_TYPE_ENUM } from '../constants'
import type { UsageLog } from '../data/schema'
import type { LogOtherData } from '../types'
import {
  getTieredBillingSummary,
  parseLogOther,
  isViolationFeeLog,
  type TieredBillingSummary,
} from './format'
import { isPerCallBilling } from './utils'

export function isFailedRequest(log: UsageLog): boolean {
  const other = parseLogOther(log.other)
  return (
    log.type === LOG_TYPE_ENUM.ERROR ||
    isViolationFeeLog(other) ||
    (log.is_stream && other?.stream_status?.status === 'error')
  )
}

export function getRequestErrorText(log: UsageLog): string {
  const other = parseLogOther(log.other)
  const stream = other?.stream_status
  const parts = [
    other?.reject_reason,
    stream?.end_error,
    ...(Array.isArray(stream?.errors) ? stream.errors : []),
    log.content,
  ]
  return parts
    .filter((part) => typeof part === 'string' && part.trim())
    .join('\n')
}

function recordedTokenPrice(
  base: number | null,
  ratio: unknown
): number | null {
  if (
    base === null ||
    typeof ratio !== 'number' ||
    !Number.isFinite(ratio) ||
    ratio < 0
  ) {
    return null
  }
  const price = base * ratio
  return Number.isFinite(price) ? price : null
}

export function getRecordedUnitPrices(other: LogOtherData | null) {
  if (isViolationFeeLog(other)) {
    return { mode: 'fee' as const, input: null, output: null, perRequest: null }
  }
  if (other?.billing_mode === 'tiered_expr') {
    return {
      mode: 'dynamic' as const,
      input: null,
      output: null,
      perRequest: null,
    }
  }
  if (isPerCallBilling(other?.model_price)) {
    const price = other?.model_price
    return {
      mode: 'request' as const,
      input: null,
      output: null,
      perRequest:
        typeof price === 'number' && Number.isFinite(price) ? price : null,
    }
  }
  const input = recordedTokenPrice(2, other?.model_ratio)
  return {
    mode: 'tokens' as const,
    input,
    output: recordedTokenPrice(input, other?.completion_ratio),
    cacheRead: recordedTokenPrice(input, other?.cache_ratio),
    cacheWrite: recordedTokenPrice(input, other?.cache_creation_ratio),
    cacheWrite5m: recordedTokenPrice(input, other?.cache_creation_ratio_5m),
    cacheWrite1h: recordedTokenPrice(input, other?.cache_creation_ratio_1h),
    perRequest: null,
  }
}

export type DynamicBillingLineItem = {
  key: string
  labelKey: string
  quantity: number
  unitPrice: number
  costBeforeGroup: number
}

export type DynamicBillingDetails = {
  tierLabel: string
  priceEntries: TieredBillingSummary['priceEntries']
  lineItems: DynamicBillingLineItem[]
  requestMultiplier: number
  costBeforeGroup: number
}

export function getDynamicBillingDetails(
  other: LogOtherData | null
): DynamicBillingDetails | null {
  const summary = getTieredBillingSummary(other, {
    includeUnusedCache: true,
  })
  const usage = other?.billing_usage
  const recordedCost = other?.billing_cost_before_group
  if (
    !summary ||
    !usage ||
    typeof recordedCost !== 'number' ||
    !Number.isFinite(recordedCost) ||
    recordedCost < 0
  ) {
    return null
  }

  let requestMultiplier = 1
  for (const rule of other.request_rules ?? []) {
    if (!rule.matched) continue
    if (
      typeof rule.multiplier !== 'number' ||
      !Number.isFinite(rule.multiplier) ||
      rule.multiplier < 0
    ) {
      return null
    }
    requestMultiplier *= rule.multiplier
    if (!Number.isFinite(requestMultiplier)) return null
  }

  const lineItems: DynamicBillingLineItem[] = []
  let calculatedCost = 0
  for (const entry of summary.priceEntries) {
    const quantity = usage[entry.key as keyof typeof usage]
    if (
      typeof quantity !== 'number' ||
      !Number.isFinite(quantity) ||
      quantity < 0
    ) {
      return null
    }
    if (quantity === 0) continue

    const costBeforeGroup =
      (quantity * entry.price * requestMultiplier) / 1_000_000
    if (!Number.isFinite(costBeforeGroup) || costBeforeGroup < 0) return null
    calculatedCost += costBeforeGroup
    lineItems.push({
      key: entry.key,
      labelKey: entry.shortLabel,
      quantity,
      unitPrice: entry.price,
      costBeforeGroup,
    })
  }

  if (lineItems.length === 0 || !Number.isFinite(calculatedCost)) return null
  const tolerance = Math.max(1e-12, Math.abs(recordedCost) * 1e-9)
  if (Math.abs(calculatedCost - recordedCost) > tolerance) return null

  return {
    tierLabel: summary.tier.label,
    priceEntries: summary.priceEntries,
    lineItems,
    requestMultiplier,
    costBeforeGroup: recordedCost,
  }
}

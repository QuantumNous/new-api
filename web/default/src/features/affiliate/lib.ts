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
import { formatQuotaWithCurrency } from '@/lib/currency'
import type { AffiliateLogFilters, AffiliateLogsParams } from './types'

const numberFormat = new Intl.NumberFormat('zh-CN')

function normalizePositiveInteger(value: unknown): number | undefined {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return undefined
  return Math.trunc(number)
}

function toUnixSeconds(value?: string): number | undefined {
  if (!value) return undefined
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return undefined
  return Math.floor(parsed / 1000)
}

export function buildAffiliateLogsParams(
  filters: AffiliateLogFilters,
  page: number,
  pageSize: number
): AffiliateLogsParams {
  return {
    p: page,
    page_size: pageSize,
    model_name: filters.model?.trim() || undefined,
    group: filters.group?.trim() || undefined,
    request_status: filters.requestStatus?.trim() || undefined,
    user_id: normalizePositiveInteger(filters.userId),
    second_level_user_id: normalizePositiveInteger(filters.secondLevelUserId),
    start_timestamp: toUnixSeconds(filters.startTime),
    end_timestamp: toUnixSeconds(filters.endTime),
  }
}

export function buildAffiliateLogsQuery(params: AffiliateLogsParams): string {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })

  return `/api/affiliate/logs?${query.toString()}`
}

export function formatAffiliateRmbFromQuota(
  quota: number,
  config: { quotaPerUnit: number; usdExchangeRate: number },
  digits = 6
): string {
  const quotaPerUnit = config.quotaPerUnit > 0 ? config.quotaPerUnit : 1
  const usdExchangeRate =
    config.usdExchangeRate > 0 ? config.usdExchangeRate : 1
  return formatQuotaWithCurrency(quota, {
    abbreviate: false,
    digitsLarge: digits,
    digitsSmall: digits,
    minimumNonZero: Math.pow(10, -digits),
    currencyOverride: {
      quotaDisplayType: 'CNY',
      quotaPerUnit,
      usdExchangeRate,
    },
  })
}

export function formatRawQuota(quota: number): string {
  return numberFormat.format(Number(quota || 0))
}

export function getAffiliateUnavailableMessage(
  reason: string | undefined,
  fallback: string | undefined,
  t: (key: string) => string
): string {
  const backendMessage = fallback?.trim()
  if (backendMessage) return backendMessage

  switch (reason) {
    case 'module_disabled':
      return t('Affiliate module is disabled')
    case 'data_uninitialized':
      return t('Affiliate data is not initialized')
    case 'not_opened':
      return t('Affiliate feature is not enabled for this account')
    default:
      return t('Affiliate feature is unavailable')
  }
}

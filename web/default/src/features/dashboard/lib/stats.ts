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
import { inferApiInfo } from '@/features/pricing/lib'
import type { PricingModel } from '@/features/pricing/types'
import type {
  DashboardFilters,
  DashboardProviderFilter,
  QuotaDataItem,
} from '@/features/dashboard/types'

/**
 * Safe division: handles NaN and Infinity cases
 */
export function safeDivide(
  value: number,
  divisor: number,
  precision: number = 3
): number {
  const result = value / divisor
  if (isNaN(result) || !isFinite(result)) return 0
  const factor = Math.pow(10, precision)
  return Math.round(result * factor) / factor
}

/**
 * Calculate aggregated statistics from quota data
 */
export function calculateDashboardStats(data: QuotaDataItem[]) {
  return data.reduce(
    (acc, item) => ({
      totalQuota: acc.totalQuota + (Number(item.quota) || 0),
      totalCount: acc.totalCount + (Number(item.count) || 0),
      totalTokens: acc.totalTokens + (Number(item.token_used) || 0),
    }),
    { totalQuota: 0, totalCount: 0, totalTokens: 0 }
  )
}

export interface DashboardModelInsights {
  activeModelCount: number
  activeProviderCount: number
  topModelName: string
  topModelQuota: number
  topProvider: DashboardProviderFilter
  topProviderQuota: number
  avgTokensPerCall: number
  avgQuotaPerCall: number
  topThreeQuotaShare: number
}

export function getDashboardModelProvider(
  modelName: string
): DashboardProviderFilter {
  const vendor = inferApiInfo({ model_name: modelName } as PricingModel).vendor
  if (vendor === 'openai') return 'openai'
  if (vendor === 'anthropic') return 'anthropic'
  if (vendor === 'google') return 'google'
  return 'other'
}

export function getDashboardProviderLabelKey(
  provider: DashboardProviderFilter
): string {
  if (provider === 'openai') return 'OpenAI'
  if (provider === 'anthropic') return 'Anthropic'
  if (provider === 'google') return 'Gemini / Google'
  if (provider === 'other') return 'Other Providers'
  return 'All Providers'
}

export function applyDashboardDataFilters(
  data: QuotaDataItem[],
  filters?: DashboardFilters
): QuotaDataItem[] {
  const modelQuery = filters?.model_name?.trim().toLowerCase()
  const provider = filters?.provider ?? 'all'

  if (!modelQuery && provider === 'all') return data

  return data.filter((item) => {
    const modelName = item.model_name || ''
    if (modelQuery && !modelName.toLowerCase().includes(modelQuery)) {
      return false
    }
    if (
      provider !== 'all' &&
      getDashboardModelProvider(modelName) !== provider
    ) {
      return false
    }
    return true
  })
}

export function calculateDashboardModelInsights(
  data: QuotaDataItem[]
): DashboardModelInsights {
  const totals = calculateDashboardStats(data)
  const modelTotals = new Map<
    string,
    { quota: number; count: number; tokens: number }
  >()
  const providerTotals = new Map<
    DashboardProviderFilter,
    { quota: number; count: number; tokens: number }
  >()

  for (const item of data) {
    const modelName = item.model_name || 'Unknown'
    const provider = getDashboardModelProvider(modelName)
    const quota = Number(item.quota) || 0
    const count = Number(item.count) || 0
    const tokens = Number(item.token_used) || 0

    const modelExisting = modelTotals.get(modelName) || {
      quota: 0,
      count: 0,
      tokens: 0,
    }
    modelTotals.set(modelName, {
      quota: modelExisting.quota + quota,
      count: modelExisting.count + count,
      tokens: modelExisting.tokens + tokens,
    })

    const providerExisting = providerTotals.get(provider) || {
      quota: 0,
      count: 0,
      tokens: 0,
    }
    providerTotals.set(provider, {
      quota: providerExisting.quota + quota,
      count: providerExisting.count + count,
      tokens: providerExisting.tokens + tokens,
    })
  }

  const sortedModels = Array.from(modelTotals.entries()).sort(
    (a, b) => b[1].quota - a[1].quota
  )
  const sortedProviders = Array.from(providerTotals.entries()).sort(
    (a, b) => b[1].quota - a[1].quota
  )
  const topThreeQuota = sortedModels
    .slice(0, 3)
    .reduce((sum, [, item]) => sum + item.quota, 0)

  return {
    activeModelCount: modelTotals.size,
    activeProviderCount: providerTotals.size,
    topModelName: sortedModels[0]?.[0] ?? '-',
    topModelQuota: sortedModels[0]?.[1].quota ?? 0,
    topProvider: sortedProviders[0]?.[0] ?? 'all',
    topProviderQuota: sortedProviders[0]?.[1].quota ?? 0,
    avgTokensPerCall: safeDivide(totals.totalTokens, totals.totalCount, 2),
    avgQuotaPerCall: safeDivide(totals.totalQuota, totals.totalCount, 2),
    topThreeQuotaShare: safeDivide(topThreeQuota * 100, totals.totalQuota, 1),
  }
}

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
import { useQuery } from '@tanstack/react-query'
import { t } from 'i18next'
import { useTranslation } from 'react-i18next'

import { useCanEditModelPricing } from '@/features/model-pricing/api'
import { toIntlLocale } from '@/i18n/languages'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { createServerError } from '@/lib/server-error-message'

/** A task model price one plugin provider cannot charge, as the gateway reports it. */
export type ModelPricingIssue = {
  model_name: string
  plugin_key: string
  plugin_name: string
  reason: 'unconfigured' | 'incompatible' | 'stale'
}

/** Plain-language reason labels; the values are i18n keys. */
export const PRICING_ISSUE_REASONS: Record<
  ModelPricingIssue['reason'],
  string
> = {
  unconfigured: 'No price set',
  incompatible: 'The price uses usage the plugin no longer provides',
  stale: 'The plugin no longer offers this model',
}

/**
 * Kept under the model pricing config key, so every pricing save that
 * invalidates that key also refreshes the issues.
 */
export const MODEL_PRICING_ISSUES_QUERY_KEY = [
  'model-pricing-config',
  { issues: true },
] as const

export async function getModelPricingIssues(): Promise<ModelPricingIssue[]> {
  const res = await api.get('/api/option/model_pricing/issues')
  if (!res.data.success) {
    throw createServerError(res.data, t('Failed to load model pricing'))
  }
  return res.data.data ?? []
}

export function useModelPricingIssues() {
  const canEdit = useCanEditModelPricing()
  return useQuery({
    queryKey: MODEL_PRICING_ISSUES_QUERY_KEY,
    queryFn: getModelPricingIssues,
    enabled: canEdit,
    meta: { errorToast: false },
  })
}

/** The number of task models whose price needs attention, for nav badges. */
export function useModelPricingIssueBadge(): string | undefined {
  const { i18n } = useTranslation()
  const issues = useModelPricingIssues().data ?? []
  const count = new Set(issues.map((issue) => issue.model_name)).size
  if (count === 0) return undefined
  return formatNumber(
    count,
    toIntlLocale(i18n.resolvedLanguage || i18n.language)
  )
}

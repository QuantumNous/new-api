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
import {
  resolveLocalizedText,
  type LocalizedTextValue,
} from '@/lib/localized-text'

import type {
  BillingUsageFieldSchema,
  BillingUsageSchema,
  PricingModel,
} from '../types'
import {
  splitBillingExprAndRequestRules,
  type TaskTierCondition,
} from './billing-expr'
import { getTaskPricingDisplayTiers } from './task-matrix-display'

export function taskPriceLabel(
  description: LocalizedTextValue | undefined,
  field: string,
  language: string
): string {
  const localized =
    typeof description === 'object' && description
      ? { ...description, en: description.en?.trim() || field }
      : description
  return resolveLocalizedText(localized, language) || field
}

export function taskEnumLabel(
  definition: BillingUsageFieldSchema | undefined,
  value: string,
  language: string
): string {
  return taskPriceLabel(definition?.enumLabels?.[value], value, language)
}

export function taskPricingConditions(
  conditions: TaskTierCondition[],
  schema: BillingUsageSchema | undefined,
  language: string,
  t: (key: string) => string
): string {
  return conditions
    .map(({ field, value }) => {
      const definition = schema?.[field]
      const label = taskPriceLabel(definition?.description, field, language)
      if (definition?.type === 'boolean') {
        return `${label}: ${value === 'true' ? t('Yes') : t('No')}`
      }
      const optionLabel = taskEnumLabel(definition, value, language)
      return optionLabel !== value ? optionLabel : `${label}: ${optionLabel}`
    })
    .join(' · ')
}

export function hasSimpleTaskPricing(model: PricingModel): boolean {
  if (
    !model.billing_usage_schema ||
    model.billing_mode !== 'tiered_expr' ||
    !model.billing_expr
  ) {
    return false
  }
  const split = splitBillingExprAndRequestRules(model.billing_expr)
  if (split.requestRuleExpr?.trim()) return false
  const tiers = getTaskPricingDisplayTiers(
    split.billingExpr,
    model.billing_usage_schema
  )
  return tiers.length === 1
}

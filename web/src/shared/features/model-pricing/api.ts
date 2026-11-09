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
import type { QueryClient } from '@tanstack/react-query'

import { pluginExpressionsEqual } from '@/shared/features/pricing/lib/plugin-pricing'
import type {
  BillingUsageSchema,
  BillingUsageExample,
} from '@/shared/features/pricing/types'
import { ROLE } from '@/shared/lib/roles'
import { useAuthStore } from '@/shared/stores/auth-store'

import {
  PRICING_KEYS,
  pricingValuesByModel,
  type PricingOptions,
  type PricingValues,
  type CacheWriteMode,
  type LegacyBillingDetails,
} from './pricing'

export type ModelPricingDescription = {
  billing_details?: LegacyBillingDetails
  effective: PricingValues
  cache_write_mode?: CacheWriteMode
}

export type ModelPricingPluginVariant = {
  plugin_key: string
  plugin_name: string
  icon?: string
  usage_schema: BillingUsageSchema
  usage_examples?: BillingUsageExample[]
  configured: string
  effective: string
  compatible: boolean
  stale?: boolean
}

export type ModelPricingEntry = ModelPricingDescription & {
  plugin_variants?: ModelPricingPluginVariant[]
  model_name: string
  version: string
  configured: PricingValues
  usage_schema?: BillingUsageSchema
}

export type ModelPricingConfig = {
  entries: ModelPricingEntry[]
  options: PricingOptions
  empty_version: string
}
export type ModelPricingChange = {
  model_name: string
  expected_version: string
  pricing: PricingValues
  reset?: boolean
}

export type ModelPricingConversion = Partial<ModelPricingDescription> & {
  expression?: string
  unsupported_reason?: string
}

export function useCanEditModelPricing() {
  return useAuthStore((state) => state.auth.user?.role === ROLE.SUPER_ADMIN)
}

export async function invalidateModelPricing(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ['model-pricing-config'] }),
    client.invalidateQueries({ queryKey: ['model-pricing-preview'] }),
    client.invalidateQueries({ queryKey: ['system-options'] }),
    client.invalidateQueries({ queryKey: ['pricing'] }),
    client.invalidateQueries({ queryKey: ['models'] }),
  ])
}

// Only dirty model fields are applied to stored configuration. Display-only
// built-in expressions for other models never become administrator overrides.
export function buildPricingChanges(
  snapshot: ModelPricingConfig,
  before: PricingOptions,
  after: PricingOptions
): ModelPricingChange[] {
  const previous = pricingValuesByModel(before)
  const next = pricingValuesByModel(after)
  const entries = new Map(
    snapshot.entries.map((entry) => [entry.model_name, entry])
  )
  const changes: ModelPricingChange[] = []
  for (const name of new Set([...previous.keys(), ...next.keys()])) {
    const oldValues = previous.get(name) ?? {}
    const newValues = next.get(name) ?? {}
    const dirty = PRICING_KEYS.filter((key) =>
      key === 'billing_setting.plugin_billing_expr'
        ? !pluginExpressionsEqual(oldValues[key], newValues[key])
        : oldValues[key] !== newValues[key]
    )
    if (!dirty.length) continue
    const entry = entries.get(name)
    const pricing = { ...entry?.configured }
    for (const key of dirty) {
      delete pricing[key]
      if (newValues[key] !== undefined) {
        Object.assign(pricing, { [key]: newValues[key] })
      }
    }
    if (newValues['billing_setting.billing_mode'] === 'tiered_expr') {
      pricing['billing_setting.billing_mode'] = 'tiered_expr'
      pricing['billing_setting.billing_expr'] =
        newValues['billing_setting.billing_expr']
    }
    changes.push({
      model_name: name,
      expected_version: entry?.version ?? snapshot.empty_version,
      pricing,
    })
  }
  return changes
}

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
/**
 * Pure group-level billing resolution helpers.
 *
 * These mirror the classic frontend's `resolveGroupBillingExpr` /
 * `resolveGroupBillingMode` so the default theme can render dynamic
 * (tiered_expr) pricing per group instead of always falling back to the
 * model-level expression — fixing the "what you see isn't what you pay"
 * discrepancy when a group overrides `billing_expr` / `billing_mode`.
 *
 * Intentionally dependency-light (only the pure `billing-expr` parser,
 * `constants`, and type-only imports) so the logic is unit-testable with
 * `node --test` without bundler/`@/` alias resolution, and is a natural seed
 * for the shared cross-theme pricing module.
 */
import { QUOTA_TYPE_VALUES } from '../constants'
import type { ModelGroupPricingOverride, PricingModel } from '../types'
import {
  parseTiersFromExpr,
  splitBillingExprAndRequestRules,
  tryParseRequestRuleExpr,
  type ParsedTier,
} from './billing-expr'

export type GroupBillingMode = 'per-token' | 'per-request' | 'tiered_expr'

/**
 * Return the object-form group pricing override for a group, or undefined when
 * the group is absent or only carries a bare numeric ratio.
 */
export function getModelGroupPricingOverride(
  model: PricingModel,
  group: string
): ModelGroupPricingOverride | undefined {
  const pricing = model.group_pricing?.[group]
  if (!pricing || typeof pricing !== 'object') {
    return undefined
  }
  return pricing
}

/**
 * Resolve the effective billing mode for a group, mirroring the backend
 * freeze-point precedence: group override billing_mode → model tiered_expr →
 * model quota_type (REQUEST → per-request, otherwise per-token).
 */
export function resolveGroupBillingMode(
  model: PricingModel,
  group: string
): GroupBillingMode {
  const override = getModelGroupPricingOverride(model, group)
  const overrideMode = override?.billing_mode
  if (
    overrideMode === 'per-token' ||
    overrideMode === 'per-request' ||
    overrideMode === 'tiered_expr'
  ) {
    return overrideMode
  }
  if (model.billing_mode === 'tiered_expr') {
    return 'tiered_expr'
  }
  return model.quota_type === QUOTA_TYPE_VALUES.REQUEST
    ? 'per-request'
    : 'per-token'
}

/**
 * Resolve the effective billing expression for a group: a group override
 * `billing_expr` takes precedence, otherwise fall back to the model-level
 * expression.
 */
export function resolveGroupBillingExpr(
  model: PricingModel,
  group: string
): string | undefined {
  const override = getModelGroupPricingOverride(model, group)
  if (override && override.billing_expr) {
    return override.billing_expr
  }
  return model.billing_expr
}

/**
 * Whether a specific group bills dynamically (tiered_expr) once group-level
 * overrides are applied — i.e. its resolved mode is tiered_expr and it has a
 * resolved expression to render.
 */
export function isGroupDynamicPricing(
  model: PricingModel,
  group: string
): boolean {
  return (
    resolveGroupBillingMode(model, group) === 'tiered_expr' &&
    Boolean(resolveGroupBillingExpr(model, group))
  )
}

/**
 * Parse the tier table for a group from its resolved (override-aware)
 * expression. Returns an empty array when the group is not dynamic.
 */
export function getGroupDynamicTiers(
  model: PricingModel,
  group: string
): ParsedTier[] {
  if (!isGroupDynamicPricing(model, group)) return []
  const { billingExpr } = splitBillingExprAndRequestRules(
    resolveGroupBillingExpr(model, group) || ''
  )
  return parseTiersFromExpr(billingExpr)
}

/**
 * Whether a group's resolved expression carries request-rule conditional
 * multipliers (override-aware).
 */
export function hasGroupDynamicRequestRules(
  model: PricingModel,
  group: string
): boolean {
  if (!isGroupDynamicPricing(model, group)) return false
  const { requestRuleExpr } = splitBillingExprAndRequestRules(
    resolveGroupBillingExpr(model, group) || ''
  )
  return Boolean(tryParseRequestRuleExpr(requestRuleExpr || '')?.length)
}

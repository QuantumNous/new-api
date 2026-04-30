import { formatBillingCurrencyFromUSD } from '@/lib/currency'
import { TOKEN_UNIT_DIVISORS } from '../constants'
import {
  BILLING_PRICING_VARS,
  parseTiersFromExpr,
  splitBillingExprAndRequestRules,
  tryParseRequestRuleExpr,
  type BillingVar,
  type ParsedTier,
} from './billing-expr'
import type { PricingModel, TokenUnit } from '../types'

type DynamicPriceOptions = {
  tokenUnit: TokenUnit
  showRechargePrice?: boolean
  priceRate?: number
  usdExchangeRate?: number
  groupRatioMultiplier?: number
}

export type DynamicPriceEntry = {
  key: string
  field: string
  label: string
  shortLabel: string
  value: number
  formatted: string
  variable: BillingVar
}

export type DynamicPricingSummary = {
  tiers: ParsedTier[]
  tier: ParsedTier | null
  tierCount: number
  hasRequestRules: boolean
  isSpecialExpression: boolean
  rawExpression: string
  entries: DynamicPriceEntry[]
  primaryEntries: DynamicPriceEntry[]
  secondaryEntries: DynamicPriceEntry[]
}

const PRIMARY_DYNAMIC_FIELDS = new Set(['inputPrice', 'outputPrice'])

export function isDynamicPricingModel(model: PricingModel): boolean {
  return model.billing_mode === 'tiered_expr' && Boolean(model.billing_expr)
}

export function getDynamicDisplayGroupRatio(model: PricingModel): number {
  const groups = Array.isArray(model.enable_groups) ? model.enable_groups : []
  const ratios = model.group_ratio || {}
  if (groups.length === 0) return 1

  let minRatio = Number.POSITIVE_INFINITY
  for (const group of groups) {
    const ratio = ratios[group]
    if (ratio !== undefined && ratio < minRatio) {
      minRatio = ratio
    }
  }

  return minRatio === Number.POSITIVE_INFINITY ? 1 : minRatio
}

function applyRechargeRate(
  price: number,
  showWithRecharge: boolean,
  priceRate: number,
  usdExchangeRate: number
): number {
  if (!showWithRecharge) return price
  return (price * priceRate) / usdExchangeRate
}

export function formatDynamicUnitPrice(
  valuePerMillionTokens: number,
  options: DynamicPriceOptions
): string {
  const groupRatio = options.groupRatioMultiplier ?? 1
  const priceRate = options.priceRate ?? 1
  const usdExchangeRate = options.usdExchangeRate ?? 1
  const priceUSD =
    (valuePerMillionTokens * groupRatio) /
    TOKEN_UNIT_DIVISORS[options.tokenUnit]
  const displayPrice = applyRechargeRate(
    priceUSD,
    options.showRechargePrice ?? false,
    priceRate,
    usdExchangeRate
  )

  return formatBillingCurrencyFromUSD(displayPrice, {
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

export function getDynamicPricingTiers(model: PricingModel): ParsedTier[] {
  if (!isDynamicPricingModel(model)) return []
  const { billingExpr } = splitBillingExprAndRequestRules(model.billing_expr || '')
  return parseTiersFromExpr(billingExpr)
}

export function hasDynamicRequestRules(model: PricingModel): boolean {
  if (!isDynamicPricingModel(model)) return false
  const { requestRuleExpr } = splitBillingExprAndRequestRules(
    model.billing_expr || ''
  )
  return Boolean(tryParseRequestRuleExpr(requestRuleExpr || '')?.length)
}

export function getDynamicPriceEntries(
  tier: ParsedTier | null,
  options: DynamicPriceOptions
): DynamicPriceEntry[] {
  if (!tier) return []

  return BILLING_PRICING_VARS.flatMap((variable) => {
    if (!variable.field) return []
    const value = Number(tier[variable.field])
    if (!Number.isFinite(value) || value <= 0) return []

    return [
      {
        key: variable.key,
        field: variable.field,
        label: variable.label,
        shortLabel: variable.shortLabel,
        value,
        formatted: formatDynamicUnitPrice(value, options),
        variable,
      },
    ]
  }).sort((a, b) => {
    const aPrimary = PRIMARY_DYNAMIC_FIELDS.has(a.field)
    const bPrimary = PRIMARY_DYNAMIC_FIELDS.has(b.field)
    if (aPrimary !== bPrimary) return aPrimary ? -1 : 1
    return 0
  })
}

export function getDynamicPricingSummary(
  model: PricingModel,
  options: DynamicPriceOptions
): DynamicPricingSummary | null {
  if (!isDynamicPricingModel(model)) return null

  const tiers = getDynamicPricingTiers(model)
  const tier = tiers[0] || null
  const entries = getDynamicPriceEntries(tier, options)
  const rawExpression = model.billing_expr || ''

  return {
    tiers,
    tier,
    tierCount: tiers.length,
    hasRequestRules: hasDynamicRequestRules(model),
    isSpecialExpression: rawExpression.trim().length > 0 && tiers.length === 0,
    rawExpression,
    entries,
    primaryEntries: entries.filter((entry) =>
      PRIMARY_DYNAMIC_FIELDS.has(entry.field)
    ),
    secondaryEntries: entries.filter(
      (entry) => !PRIMARY_DYNAMIC_FIELDS.has(entry.field)
    ),
  }
}

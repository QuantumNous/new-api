import type { PricingModel } from '../type'

/**
 * Format price for display based on currency, token unit, and recharge settings
 * @param model - The pricing model
 * @param type - 'input' or 'output' price type
 * @param currency - Currency format (USD or CNY)
 * @param tokenUnit - Token unit (M for million, K for thousand)
 * @param showWithRecharge - Whether to show price with recharge rate applied
 * @param priceRate - Recharge price rate multiplier
 * @param usdExchangeRate - USD to CNY exchange rate
 * @returns Formatted price string
 */
export function formatPrice(
  model: PricingModel,
  type: 'input' | 'output',
  currency: 'USD' | 'CNY',
  tokenUnit: 'M' | 'K',
  showWithRecharge: boolean,
  priceRate: number,
  usdExchangeRate: number
): string {
  // Pay per request models don't have per-token pricing
  if (model.quota_type === 1) {
    return '-'
  }

  const groupRatio = model.group_ratio || {}
  let usedGroupRatio = 1

  // Find the minimum group ratio if model has enabled groups
  const enableGroups = Array.isArray(model.enable_groups)
    ? model.enable_groups
    : []

  if (enableGroups.length > 0) {
    let minRatio = Number.POSITIVE_INFINITY
    enableGroups.forEach((g) => {
      const r = groupRatio[g]
      if (r !== undefined && r < minRatio) {
        minRatio = r
        usedGroupRatio = r
      }
    })
  }

  // Calculate base price in USD
  const inputRatioPriceUSD = model.model_ratio * 2 * usedGroupRatio
  const outputRatioPriceUSD =
    model.model_ratio * model.completion_ratio * 2 * usedGroupRatio

  let priceInUSD = type === 'input' ? inputRatioPriceUSD : outputRatioPriceUSD

  // Apply recharge rate if needed
  if (showWithRecharge) {
    priceInUSD = (priceInUSD * priceRate) / usdExchangeRate
  }

  // Convert to token unit (M or K)
  const unitDivisor = tokenUnit === 'K' ? 1000 : 1
  const price = priceInUSD / unitDivisor

  // Format based on currency
  if (currency === 'CNY') {
    return `¥${(price * usdExchangeRate).toFixed(4)}`
  }
  return `$${price.toFixed(4)}`
}

/**
 * Calculate fixed price for pay-per-request models
 * @param model - The pricing model
 * @param group - User group name
 * @param currency - Currency format (USD or CNY)
 * @param showWithRecharge - Whether to show price with recharge rate applied
 * @param priceRate - Recharge price rate multiplier
 * @param usdExchangeRate - USD to CNY exchange rate
 * @param groupRatio - Group ratio mapping
 * @returns Formatted price string
 */
export function formatFixedPrice(
  model: PricingModel,
  group: string,
  currency: 'USD' | 'CNY',
  showWithRecharge: boolean,
  priceRate: number,
  usdExchangeRate: number,
  groupRatio: Record<string, number>
): string {
  // Only for pay per request models
  if (model.quota_type !== 1) {
    return '-'
  }

  const ratio = groupRatio[group] || 1
  const priceInUSD = model.model_price || 0
  let finalPrice = priceInUSD * ratio

  // Apply recharge rate if needed
  if (showWithRecharge) {
    finalPrice = (finalPrice * priceRate) / usdExchangeRate
  }

  // Format based on currency
  if (currency === 'CNY') {
    return `¥${(finalPrice * usdExchangeRate).toFixed(4)}`
  }
  return `$${finalPrice.toFixed(4)}`
}

/**
 * Calculate price for a specific group (used in model details page)
 * @param model - The pricing model
 * @param group - User group name
 * @param type - 'input' or 'output' price type
 * @param currency - Currency format (USD or CNY)
 * @param tokenUnit - Token unit (M for million, K for thousand)
 * @param showWithRecharge - Whether to show price with recharge rate applied
 * @param priceRate - Recharge price rate multiplier
 * @param usdExchangeRate - USD to CNY exchange rate
 * @param groupRatio - Group ratio mapping
 * @returns Formatted price string
 */
export function formatGroupPrice(
  model: PricingModel,
  group: string,
  type: 'input' | 'output',
  currency: 'USD' | 'CNY',
  tokenUnit: 'M' | 'K',
  showWithRecharge: boolean,
  priceRate: number,
  usdExchangeRate: number,
  groupRatio: Record<string, number>
): string {
  // Pay per request models don't have per-token pricing
  if (model.quota_type === 1) {
    return '-'
  }

  const ratio = groupRatio[group] || 1
  const inputPriceUSD = model.model_ratio * 2 * ratio
  const outputPriceUSD = model.model_ratio * model.completion_ratio * 2 * ratio

  let priceInUSD = type === 'input' ? inputPriceUSD : outputPriceUSD

  // Apply recharge rate if needed
  if (showWithRecharge) {
    priceInUSD = (priceInUSD * priceRate) / usdExchangeRate
  }

  // Convert to token unit (M or K)
  const unitDivisor = tokenUnit === 'K' ? 1000 : 1
  const price = priceInUSD / unitDivisor

  // Format based on currency
  if (currency === 'CNY') {
    return `¥${(price * usdExchangeRate).toFixed(4)}`
  }
  return `$${price.toFixed(4)}`
}

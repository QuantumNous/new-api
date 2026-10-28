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
import { formatPricingNumber } from '@/features/system-settings/models/pricing-format'
import type { CurrencyConfig } from '@/stores/system-config-store'

export type PricingCurrency = {
  label: string
  symbol: string
  exchangeRate: number
}

export const USD_PRICING_CURRENCY: PricingCurrency = {
  label: 'USD',
  symbol: '$',
  exchangeRate: 1,
}

export function suggestedCurrencyForModel(
  modelName: string,
  vendorName = ''
): 'USD' | 'CNY' {
  const overseasModel =
    /(?:^|[-_/])(?:gpt|claude|gemini|grok|llama|mistral|sora|veo|whisper|dall[-_]?e)(?:[-_./]|$)/i
  const domesticVendor =
    /(?:alibaba|aliyun|qwen|volc|bytedance|doubao|zhipu|bigmodel|moonshot|kimi|tencent|hunyuan|baidu|deepseek|minimax|百炼|阿里|火山|豆包|智谱|月之暗面|腾讯|百度|深度求索)/i
  const domesticModel =
    /(?:^|[-_/])(?:qwen|qwq|wan|doubao|seedream|seedance|deepseek|glm|kimi|minimax|hunyuan|ernie|happyhorse)(?:[-_./]|$)/i
  if (overseasModel.test(modelName)) return 'USD'
  if (domesticModel.test(modelName)) return 'CNY'
  return domesticVendor.test(vendorName) ? 'CNY' : 'USD'
}

export function getSitePricingCurrency(
  config: CurrencyConfig
): PricingCurrency | null {
  if (config.quotaDisplayType === 'CNY') {
    return { label: 'CNY', symbol: '¥', exchangeRate: config.usdExchangeRate }
  }
  if (config.quotaDisplayType === 'CUSTOM') {
    const symbol = config.customCurrencySymbol?.trim() || '¤'
    return {
      label: symbol,
      symbol,
      exchangeRate: config.customCurrencyExchangeRate,
    }
  }
  return null
}

export function isValidPricingCurrency(
  currency: PricingCurrency | null
): currency is PricingCurrency {
  return (
    currency !== null &&
    Number.isFinite(currency.exchangeRate) &&
    currency.exchangeRate > 0
  )
}

export function formatPricingAmount(
  value: string | number,
  currency = USD_PRICING_CURRENCY
): string {
  if (value === '') return ''
  const amount = Number(value) * currency.exchangeRate
  if (!Number.isFinite(amount)) return '—'
  return `${currency.symbol}${formatPricingNumber(amount)}`
}

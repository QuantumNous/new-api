import type { CurrencyDisplayType } from '@/stores/system-config-store'

export function getPricingCurrencyLabel(
  displayType: CurrencyDisplayType,
  customCurrencySymbol?: string
) {
  if (displayType === 'USD') return 'base USD'
  if (displayType === 'CNY') return '元'
  if (displayType === 'CUSTOM') return customCurrencySymbol?.trim() || 'Custom'
  return 'base USD'
}

export function getPricingModeLabelKey(displayType: CurrencyDisplayType) {
  return displayType === 'USD'
    ? 'Price mode (base USD per 1M tokens)'
    : 'Price mode (based on {{currency}} per 1M tokens)'
}

export function getPromptPriceLabelKey(displayType: CurrencyDisplayType) {
  return displayType === 'USD'
    ? 'Prompt price (base USD / 1M tokens)'
    : 'Prompt price (based on {{currency}} / 1M tokens)'
}

export function getCompletionPriceLabelKey(displayType: CurrencyDisplayType) {
  return displayType === 'USD'
    ? 'Completion price (base USD / 1M tokens)'
    : 'Completion price (based on {{currency}} / 1M tokens)'
}

export function getFixedPriceLabelKey(displayType: CurrencyDisplayType) {
  return displayType === 'USD'
    ? 'Fixed price (base USD)'
    : 'Fixed price (based on {{currency}})'
}

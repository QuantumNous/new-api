/** Route target for「系统设置 → 分组与模型定价」→ Model Pricing tab */
export const MODEL_PRICING_SETTINGS_SECTION = 'model-pricing' as const

export const modelPricingSettingsLink = {
  to: '/system-settings/billing/$section' as const,
  params: { section: MODEL_PRICING_SETTINGS_SECTION },
}

export const modelPricingSettingsHref = `/_panel/system-settings/billing/${MODEL_PRICING_SETTINGS_SECTION}`

export function openModelPricingSettingsInNewTab() {
  window.open(modelPricingSettingsHref, '_blank', 'noopener,noreferrer')
}

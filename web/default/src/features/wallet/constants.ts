// ============================================================================
// Wallet Constants
// ============================================================================

/**
 * Default preset amount multipliers
 * Used to generate quick select amounts based on minimum topup
 */
export const DEFAULT_PRESET_MULTIPLIERS = [1, 5, 10, 30, 50, 100, 300, 500]

/**
 * Payment method types
 */
export const PAYMENT_TYPES = {
  ALIPAY: 'alipay',
  WECHAT: 'wxpay',
  STRIPE: 'stripe',
  CREEM: 'creem',
  WAFFO: 'waffo',
  WAFFO_PANCAKE: 'waffo_pancake',
} as const

/**
 * Default payment type
 */
export const DEFAULT_PAYMENT_TYPE = PAYMENT_TYPES.ALIPAY

/**
 * Payment icon colors (HEX format for react-icons)
 */
export const PAYMENT_ICON_COLORS = {
  [PAYMENT_TYPES.ALIPAY]: '#1677FF',
  [PAYMENT_TYPES.WECHAT]: '#07C160',
  [PAYMENT_TYPES.STRIPE]: '#635BFF',
  [PAYMENT_TYPES.CREEM]: '#6366F1',
  [PAYMENT_TYPES.WAFFO]: '#2563EB',
  [PAYMENT_TYPES.WAFFO_PANCAKE]: '#F97316',
} as const

/**
 * Quota conversion rate: 500,000 units = $1
 */
export const QUOTA_PER_DOLLAR = 500000

/**
 * Default discount rate (no discount)
 */
export const DEFAULT_DISCOUNT_RATE = 1.0

/**
 * Default minimum topup amount
 */
export const DEFAULT_MIN_TOPUP = 1

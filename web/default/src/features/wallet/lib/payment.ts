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
  PAYMENT_TYPES,
  DEFAULT_PRESET_MULTIPLIERS,
  DEFAULT_PAYMENT_TYPE,
  DEFAULT_MIN_TOPUP,
  PADDLE_CONSOLE_TOPUP_ROUTE,
  PADDLE_ORDER_SEARCH_PARAM,
  PADDLE_TRANSACTION_SEARCH_PARAM,
  PADDLE_WALLET_ROUTE,
} from '../constants'
import type { PresetAmount, TopupInfo } from '../types'

// ============================================================================
// Payment Processing Functions
// ============================================================================

const PADDLE_CHECKOUT_URL_FALLBACK_STORAGE_PREFIX =
  'new-api:paddle-checkout-url:'

/**
 * Check if browser is Safari
 */
function isSafariBrowser(): boolean {
  return (
    navigator.userAgent.indexOf('Safari') > -1 &&
    navigator.userAgent.indexOf('Chrome') < 1
  )
}

/**
 * Submit payment form (for non-Stripe payments)
 */
export function submitPaymentForm(
  url: string,
  params: Record<string, unknown>
): void {
  const form = document.createElement('form')
  form.action = url
  form.method = 'POST'

  // Don't open in new tab for Safari
  if (!isSafariBrowser()) {
    form.target = '_blank'
  }

  // Add form parameters
  Object.entries(params).forEach(([key, value]) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = key
    input.value = String(value)
    form.appendChild(input)
  })

  document.body.appendChild(form)
  form.submit()
  document.body.removeChild(form)
}

/**
 * Check if payment method is Stripe
 */
export function isStripePayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.STRIPE
}

/**
 * Check if payment method is Waffo Pancake
 *
 * Pancake is a metered-style payment that goes through a dedicated checkout
 * URL flow rather than the generic epay form submission, so it must be
 * special-cased in payment dispatch logic.
 */
export function isWaffoPancakePayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.WAFFO_PANCAKE
}

/**
 * Check if payment method is Paddle.
 */
export function isPaddlePayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.PADDLE
}

/**
 * Build an authenticated wallet URL that reopens Paddle Checkout for a
 * transaction returned by the backend.
 */
export function buildPaddleWalletCheckoutUrl(transactionId: string): string {
  const url = new URL(PADDLE_WALLET_ROUTE, window.location.origin)
  url.searchParams.set(PADDLE_TRANSACTION_SEARCH_PARAM, transactionId.trim())
  return `${url.pathname}${url.search}`
}

export function buildPaddleWalletCheckoutUrlWithOrder(
  transactionId: string,
  orderId?: string
): string {
  const url = new URL(
    buildPaddleWalletCheckoutUrl(transactionId),
    window.location.origin
  )
  const normalizedOrderId = orderId?.trim()
  if (normalizedOrderId) {
    url.searchParams.set(PADDLE_ORDER_SEARCH_PARAM, normalizedOrderId)
  }
  return `${url.pathname}${url.search}`
}

function getPaddleCheckoutUrlFallbackStorageKey(transactionId: string): string {
  return `${PADDLE_CHECKOUT_URL_FALLBACK_STORAGE_PREFIX}${transactionId.trim()}`
}

function normalizePaymentRedirectUrl(url: string): string | null {
  const normalizedUrl = url.trim()
  if (!normalizedUrl) {
    return null
  }

  const isAbsoluteHttpUrl = /^https?:\/\//i.test(normalizedUrl)
  const isRootRelativeUrl =
    normalizedUrl.startsWith('/') && !normalizedUrl.startsWith('//')
  if (!isAbsoluteHttpUrl && !isRootRelativeUrl) {
    return null
  }

  try {
    const parsedUrl = new URL(normalizedUrl, window.location.origin)
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      return parsedUrl.href
    }
  } catch (_error) {
    return null
  }

  return null
}

function isCurrentAppPaddleReopenUrl(
  checkoutUrl: string,
  transactionId: string
): boolean {
  try {
    const parsedUrl = new URL(checkoutUrl, window.location.origin)
    if (parsedUrl.origin !== window.location.origin) {
      return false
    }

    const normalizedPath = parsedUrl.pathname.replace(/\/+$/, '') || '/'
    if (
      normalizedPath !== PADDLE_WALLET_ROUTE &&
      normalizedPath !== PADDLE_CONSOLE_TOPUP_ROUTE
    ) {
      return false
    }

    const reopenTransactionId =
      parsedUrl.searchParams.get(PADDLE_TRANSACTION_SEARCH_PARAM)?.trim() || ''
    return !reopenTransactionId || reopenTransactionId === transactionId
  } catch (_error) {
    return false
  }
}

function normalizeHostedCheckoutUrl(
  transactionId: string,
  checkoutUrl: string
): string | null {
  const normalizedCheckoutUrl = normalizePaymentRedirectUrl(checkoutUrl)
  if (!normalizedCheckoutUrl) {
    return null
  }

  if (isCurrentAppPaddleReopenUrl(normalizedCheckoutUrl, transactionId)) {
    return null
  }

  return normalizedCheckoutUrl
}

export function rememberPaddleCheckoutUrlFallback(
  transactionId: string,
  checkoutUrl: string
): void {
  const normalizedTransactionId = transactionId.trim()
  const normalizedCheckoutUrl = normalizeHostedCheckoutUrl(
    normalizedTransactionId,
    checkoutUrl
  )
  if (!normalizedTransactionId || !normalizedCheckoutUrl) {
    return
  }

  try {
    window.sessionStorage.setItem(
      getPaddleCheckoutUrlFallbackStorageKey(normalizedTransactionId),
      normalizedCheckoutUrl
    )
  } catch (_error) {
    // Checkout still works through Paddle.js; this fallback is best effort.
  }
}

export function getPaddleCheckoutUrlFallback(
  transactionId: string
): string | undefined {
  const normalizedTransactionId = transactionId.trim()
  if (!normalizedTransactionId) {
    return undefined
  }

  try {
    const storedUrl = window.sessionStorage.getItem(
      getPaddleCheckoutUrlFallbackStorageKey(normalizedTransactionId)
    )
    if (!storedUrl) {
      return undefined
    }

    const normalizedCheckoutUrl = normalizeHostedCheckoutUrl(
      normalizedTransactionId,
      storedUrl
    )
    if (normalizedCheckoutUrl) {
      return normalizedCheckoutUrl
    }

    window.sessionStorage.removeItem(
      getPaddleCheckoutUrlFallbackStorageKey(normalizedTransactionId)
    )
  } catch (_error) {
    return undefined
  }

  return undefined
}

export function clearPaddleCheckoutUrlFallback(transactionId: string): void {
  const normalizedTransactionId = transactionId.trim()
  if (!normalizedTransactionId) {
    return
  }

  try {
    window.sessionStorage.removeItem(
      getPaddleCheckoutUrlFallbackStorageKey(normalizedTransactionId)
    )
  } catch (_error) {
    // Ignore storage errors; cleanup is not required for checkout correctness.
  }
}

/**
 * Get default payment type from topup info
 */
export function getDefaultPaymentType(topupInfo: TopupInfo | null): string {
  if (!topupInfo) {
    return DEFAULT_PAYMENT_TYPE
  }

  // Return first available payment method or default
  if (topupInfo.pay_methods?.length > 0) {
    return topupInfo.pay_methods[0].type
  }

  if (topupInfo.enable_stripe_topup) {
    return PAYMENT_TYPES.STRIPE
  }

  if (topupInfo.enable_waffo_topup) {
    return PAYMENT_TYPES.WAFFO
  }

  if (topupInfo.enable_waffo_pancake_topup) {
    return PAYMENT_TYPES.WAFFO_PANCAKE
  }

  if (topupInfo.enable_paddle_topup) {
    return PAYMENT_TYPES.PADDLE
  }

  return DEFAULT_PAYMENT_TYPE
}

/**
 * Get minimum topup amount from topup info
 */
export function getMinTopupAmount(topupInfo: TopupInfo | null): number {
  if (!topupInfo) {
    return DEFAULT_MIN_TOPUP
  }

  const methodMinimums = topupInfo.pay_methods
    ?.map((method) => Number(method.min_topup))
    .filter((amount) => Number.isFinite(amount) && amount > 0)

  if (methodMinimums?.length) {
    return Math.min(...methodMinimums)
  }

  if (topupInfo.enable_stripe_topup) {
    return topupInfo.stripe_min_topup
  }

  if (topupInfo.enable_waffo_topup) {
    return topupInfo.waffo_min_topup || DEFAULT_MIN_TOPUP
  }

  if (topupInfo.enable_waffo_pancake_topup) {
    return topupInfo.waffo_pancake_min_topup || DEFAULT_MIN_TOPUP
  }

  if (topupInfo.enable_paddle_topup) {
    return topupInfo.paddle_min_topup || DEFAULT_MIN_TOPUP
  }

  if (topupInfo.enable_online_topup) {
    return topupInfo.min_topup
  }

  return DEFAULT_MIN_TOPUP
}

/**
 * Generate preset amounts based on minimum topup
 */
function getConfiguredBonus(
  bonuses: Record<number, number> | undefined,
  amount: number
): number | undefined {
  const bonus = bonuses?.[amount]
  return typeof bonus === 'number' && Number.isFinite(bonus) && bonus > 0
    ? bonus
    : undefined
}

/**
 * 该档位当前用户是否还能领赠送。
 * remaining 缺该档位 key = 不限次（始终可领）；值为 0 = 已领满（不再显示赠送）。
 */
function hasBonusRemaining(
  remaining: Record<number, number> | undefined,
  amount: number
): boolean {
  if (!remaining) {
    return true
  }
  const left = remaining[amount]
  if (typeof left !== 'number') {
    return true // 未配置限次的档位：不限
  }
  return left > 0
}

export function generatePresetAmounts(
  minAmount: number,
  bonuses: Record<number, number> = {},
  remaining?: Record<number, number>
): PresetAmount[] {
  return DEFAULT_PRESET_MULTIPLIERS.map((multiplier) => {
    const value = minAmount * multiplier
    const bonus = getConfiguredBonus(bonuses, value)
    return bonus && hasBonusRemaining(remaining, value)
      ? { value, bonus }
      : { value }
  })
}

/**
 * Merge custom preset amounts with discounts
 */
export function mergePresetAmounts(
  amountOptions: number[],
  discounts: Record<number, number>,
  bonuses: Record<number, number> = {},
  remaining?: Record<number, number>
): PresetAmount[] {
  if (!amountOptions || amountOptions.length === 0) {
    return []
  }

  return amountOptions.map((amount) => {
    const bonus = getConfiguredBonus(bonuses, amount)
    const showBonus = bonus && hasBonusRemaining(remaining, amount)
    return {
      value: amount,
      discount: discounts[amount] || 1.0,
      ...(showBonus ? { bonus } : {}),
    }
  })
}

export function getLockedTopupAmountOptions(
  amountOptions: number[],
  _stripeTopupEnabled: boolean
): number[] {
  return amountOptions.filter((amount) => Number.isFinite(amount) && amount > 0)
}

export function getInitialPresetTopupAmount(
  presetAmounts: PresetAmount[]
): number {
  const firstPreset = presetAmounts.find(
    (preset) => Number.isFinite(preset.value) && preset.value > 0
  )
  return firstPreset?.value ?? 0
}

export function isPresetTopupAmount(
  amount: number,
  presetAmounts: PresetAmount[]
): boolean {
  return (
    Number.isFinite(amount) &&
    amount > 0 &&
    presetAmounts.some((preset) => preset.value === amount)
  )
}

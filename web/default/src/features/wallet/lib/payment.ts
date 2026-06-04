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
} from '../constants'
import type { PresetAmount, TopupInfo } from '../types'

// ============================================================================
// Payment Processing Functions
// ============================================================================

function getBrowserUserAgent(): string {
  if (typeof navigator === 'undefined') {
    return ''
  }
  return navigator.userAgent
}

/**
 * Check if browser is Safari
 */
function isSafariBrowser(): boolean {
  const userAgent = getBrowserUserAgent()
  return (
    userAgent.indexOf('Safari') > -1 && userAgent.indexOf('Chrome') < 1
  )
}

function isWeChatBrowser(): boolean {
  return /MicroMessenger/i.test(getBrowserUserAgent())
}

function isMobileBrowser(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
    getBrowserUserAgent()
  )
}

function shouldSubmitPaymentInCurrentTab(): boolean {
  return isSafariBrowser() || isWeChatBrowser() || isMobileBrowser()
}

export function isSafePaymentRedirectUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }

  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function openPaymentUrl(url: string): boolean {
  if (!isSafePaymentRedirectUrl(url)) {
    return false
  }

  window.open(url.trim(), '_blank', 'noopener,noreferrer')
  return true
}

export function redirectToPaymentUrl(url: string): boolean {
  if (!isSafePaymentRedirectUrl(url)) {
    return false
  }

  window.location.href = url.trim()
  return true
}

/**
 * Submit payment form (for non-Stripe payments)
 */
export function submitPaymentForm(
  url: string,
  params: Record<string, unknown>
): boolean {
  if (!isSafePaymentRedirectUrl(url)) {
    return false
  }

  const form = document.createElement('form')
  form.action = url.trim()
  form.method = 'POST'
  form.acceptCharset = 'UTF-8'

  // 移动端和微信 WebView 对异步创建的 _blank 表单兼容性较差，当前页提交更稳。
  if (!shouldSubmitPaymentInCurrentTab()) {
    form.target = '_blank'
    form.setAttribute('rel', 'noopener noreferrer')
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

  // 部分移动端 WebView 会在 submit 后才序列化表单字段，立即移除可能导致网关收到空参数。
  window.setTimeout(() => {
    form.remove()
  }, 10_000)

  return true
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

  return DEFAULT_PAYMENT_TYPE
}

/**
 * Get minimum topup amount from topup info
 */
export function getMinTopupAmount(topupInfo: TopupInfo | null): number {
  if (!topupInfo) {
    return DEFAULT_MIN_TOPUP
  }

  if (topupInfo.enable_online_topup) {
    return topupInfo.min_topup
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

  return DEFAULT_MIN_TOPUP
}

/**
 * Generate preset amounts based on minimum topup
 */
export function generatePresetAmounts(minAmount: number): PresetAmount[] {
  return DEFAULT_PRESET_MULTIPLIERS.map((multiplier) => ({
    value: minAmount * multiplier,
  }))
}

/**
 * Merge custom preset amounts with discounts
 */
export function mergePresetAmounts(
  amountOptions: number[],
  discounts: Record<number, number>
): PresetAmount[] {
  if (!amountOptions || amountOptions.length === 0) {
    return []
  }

  return amountOptions.map((amount) => ({
    value: amount,
    discount: discounts[amount] || 1.0,
  }))
}

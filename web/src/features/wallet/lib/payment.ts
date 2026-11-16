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
import { getServerMessage } from '@/lib/server-error-message'

import {
  PAYMENT_PROVIDERS,
  PAYMENT_TYPES,
  DEFAULT_PRESET_MULTIPLIERS,
  DEFAULT_PAYMENT_TYPE,
  DEFAULT_MIN_TOPUP,
} from '../constants'
import type { PaymentMethod, PresetAmount, TopupInfo } from '../types'

// ============================================================================
// Payment Processing Functions
// ============================================================================

/**
 * Payment endpoints answer errors as {"message": "error", "data": text}. When
 * the response also carries a message_key, this is its translation; callers
 * fall back to the text they already read.
 */
export function getPaymentErrorTranslation(
  response: unknown
): string | undefined {
  if (!response || typeof response !== 'object') return undefined
  const body = response as Record<string, unknown>
  if (typeof body.message_key !== 'string' || !body.message_key) {
    return undefined
  }
  return getServerMessage(body)
}

/**
 * Check if browser is Safari
 */
function isSafariBrowser(): boolean {
  return (
    navigator.userAgent.includes('Safari') &&
    !navigator.userAgent.includes('Chrome')
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
 * The part of a payment method that decides its payment flow.
 */
export type PaymentSelection = Pick<PaymentMethod, 'type' | 'provider'>

/**
 * Check if a payment method pays through Stripe Checkout: the built-in Stripe
 * entry, or an Alipay / WeChat Pay entry the administrator routed through Stripe.
 */
export function isStripePayment(
  paymentType: string,
  provider?: string
): boolean {
  return (
    paymentType === PAYMENT_TYPES.STRIPE ||
    provider === PAYMENT_PROVIDERS.STRIPE
  )
}

/**
 * Payment methods paid through the Epay form flow.
 */
export function getEpayPayMethods(
  payMethods: PaymentMethod[] = []
): PaymentMethod[] {
  return payMethods.filter(
    (m) =>
      !!m?.type &&
      m.type !== PAYMENT_TYPES.CREEM &&
      !isStripePayment(m.type, m.provider)
  )
}

/**
 * Alipay / WeChat Pay methods the administrator routed through Stripe Checkout.
 */
export function getStripeRoutedPayMethods(
  payMethods: PaymentMethod[] = []
): PaymentMethod[] {
  return payMethods.filter(
    (m) =>
      !!m?.type &&
      m.type !== PAYMENT_TYPES.STRIPE &&
      m.provider === PAYMENT_PROVIDERS.STRIPE
  )
}

/**
 * Check if payment method is Waffo
 */
export function isWaffoPayment(paymentType: string): boolean {
  return paymentType === PAYMENT_TYPES.WAFFO
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

export interface PaymentProcessors {
  regular: (topupAmount: number, payment: PaymentSelection) => Promise<boolean>
  waffo: (topupAmount: number, payMethodIndex: number) => Promise<boolean>
  waffoPancake: (topupAmount: number) => Promise<boolean>
}

export async function dispatchSelectedPayment(
  paymentMethod: PaymentMethod,
  topupAmount: number,
  waffoMethodIndex: number | null,
  processors: PaymentProcessors
): Promise<boolean> {
  if (isWaffoPayment(paymentMethod.type)) {
    if (waffoMethodIndex === null) {
      return false
    }
    return processors.waffo(topupAmount, waffoMethodIndex)
  }

  if (isWaffoPancakePayment(paymentMethod.type)) {
    return processors.waffoPancake(topupAmount)
  }

  return processors.regular(topupAmount, {
    type: paymentMethod.type,
    provider: paymentMethod.provider,
  })
}

/**
 * Get the default payment method from topup info
 */
export function getDefaultPaymentMethod(
  topupInfo: TopupInfo | null
): PaymentSelection {
  if (!topupInfo) {
    return { type: DEFAULT_PAYMENT_TYPE }
  }

  // Return first available payment method or default
  if (topupInfo.pay_methods?.length > 0) {
    const first = topupInfo.pay_methods[0]
    return { type: first.type, provider: first.provider }
  }

  if (topupInfo.enable_stripe_topup) {
    return { type: PAYMENT_TYPES.STRIPE }
  }

  if (topupInfo.enable_waffo_topup) {
    return { type: PAYMENT_TYPES.WAFFO }
  }

  if (topupInfo.enable_waffo_pancake_topup) {
    return { type: PAYMENT_TYPES.WAFFO_PANCAKE }
  }

  return { type: DEFAULT_PAYMENT_TYPE }
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

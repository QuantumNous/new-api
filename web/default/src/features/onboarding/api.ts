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
import i18next from 'i18next'
import { api } from '@/lib/api'
import { requestStripePayment } from '@/features/wallet/api'
import { getStripeCheckoutCurrencyForLanguage } from '@/features/wallet/lib'
import type { StripePaymentResponse } from '@/features/wallet/types'
import type { ApiResponse, CardStatusResponse } from './types'

/**
 * Check if an API response indicates success.
 */
export function isApiSuccess(response: ApiResponse): boolean {
  return response.success === true || response.message === 'success'
}

/**
 * Fetch the current user's card-binding status.
 */
export async function getCardStatus(): Promise<CardStatusResponse> {
  const res = await api.get('/api/user/stripe/card')
  return res.data
}

/**
 * Start a promo top-up: a real Stripe payment (payment mode) that also saves the card
 * (save_card → setup_future_usage) so it can be charged off-session later. Returns a hosted
 * Checkout link to redirect to. amount is the USD top-up amount (e.g. 20, 200).
 *
 * Delegates to the wallet's requestStripePayment so the promo and wallet flows share one
 * client wrapper for POST /api/user/stripe/pay; only the promo-specific fields differ.
 * success_url carries card_bound=1 so the wallet runs its post-bind confirmation flow.
 */
export async function requestPromoTopup(
  amount: number
): Promise<StripePaymentResponse> {
  return requestStripePayment({
    amount,
    payment_method: 'stripe',
    stripe_currency: getStripeCheckoutCurrencyForLanguage(
      i18next.resolvedLanguage || i18next.language
    ),
    save_card: true,
    success_url: new URL(
      '/wallet?show_history=true&card_bound=1',
      window.location.origin
    ).href,
    cancel_url: new URL('/onboarding', window.location.origin).href,
  })
}

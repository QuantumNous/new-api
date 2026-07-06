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
export type StripeCheckoutCurrency = 'USD' | 'JPY' | 'BRL' | 'INR'

const STRIPE_CHECKOUT_CURRENCIES = new Set<StripeCheckoutCurrency>([
  'USD',
  'JPY',
  'BRL',
  'INR',
])

export const STRIPE_CHECKOUT_CURRENCY_OPTIONS: StripeCheckoutCurrency[] = [
  'USD',
  'INR',
  'BRL',
  'JPY',
]

export function normalizeStripeCheckoutCurrency(
  currency: string | undefined
): StripeCheckoutCurrency | undefined {
  const normalized = currency?.trim().toUpperCase()
  if (!normalized) {
    return undefined
  }

  return STRIPE_CHECKOUT_CURRENCIES.has(
    normalized as StripeCheckoutCurrency
  )
    ? (normalized as StripeCheckoutCurrency)
    : undefined
}

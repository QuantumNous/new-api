/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import {
  defaultCurrencyForLanguage,
  type StripeCheckoutCurrency,
} from './stripe-currency'

export interface SubscriptionPlanPriceSource {
  price_amount: number
  currency?: string
  currency_prices?: Record<string, number> | null
}

export interface SubscriptionPlanDisplayPrice {
  amount: number
  currency: string
}

function configuredPlanPrice(
  plan: SubscriptionPlanPriceSource,
  currency: string
): number | undefined {
  const target = currency.trim().toUpperCase()
  const entry = Object.entries(plan.currency_prices ?? {}).find(
    ([configuredCurrency]) => configuredCurrency.trim().toUpperCase() === target
  )
  const amount = Number(entry?.[1])
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined
}

export function resolveSubscriptionPlanGridCurrency(
  plans: readonly SubscriptionPlanPriceSource[],
  language: string | undefined
): StripeCheckoutCurrency {
  const requestedCurrency = defaultCurrencyForLanguage(language)
  if (requestedCurrency === 'USD') return 'USD'
  return plans.length > 0 &&
    plans.every(
      (plan) => configuredPlanPrice(plan, requestedCurrency) !== undefined
    )
    ? requestedCurrency
    : 'USD'
}

export function resolveSubscriptionPlanDisplayPrice(
  plan: SubscriptionPlanPriceSource,
  currency: StripeCheckoutCurrency
): SubscriptionPlanDisplayPrice {
  const requestedAmount = configuredPlanPrice(plan, currency)
  if (requestedAmount !== undefined) {
    return { amount: requestedAmount, currency }
  }

  const usdAmount = configuredPlanPrice(plan, 'USD')
  if (usdAmount !== undefined) {
    return { amount: usdAmount, currency: 'USD' }
  }

  const canonicalCurrency = plan.currency?.trim().toUpperCase() || 'USD'
  return {
    amount: Number(plan.price_amount || 0),
    currency: canonicalCurrency,
  }
}

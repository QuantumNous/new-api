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
export type StripeCurrencyPrices = Partial<
  Record<StripeCheckoutCurrency, Record<number, number>>
>

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

// Regions where the selector is worth showing: a local currency unlocks a
// local payment method (INR→UPI, BRL→Pix, JPY→local pricing), plus CN where
// users look for non-card options. Everyone else pays USD by card without
// friction, so the selector stays hidden for them.
const CURRENCY_SELECTOR_REGIONS = new Set(['IN', 'BR', 'JP', 'CN'])

export function shouldShowCurrencySelector(
  region: string | undefined
): boolean {
  return !!region && CURRENCY_SELECTOR_REGIONS.has(region.toUpperCase())
}

const REGION_DEFAULT_CURRENCY: Record<string, StripeCheckoutCurrency> = {
  IN: 'INR',
  BR: 'BRL',
  JP: 'JPY',
}

export function defaultCurrencyForRegion(
  region: string | undefined
): StripeCheckoutCurrency {
  return REGION_DEFAULT_CURRENCY[region?.toUpperCase() ?? ''] ?? 'USD'
}

export function defaultCurrencyForLanguage(
  language: string | undefined
): StripeCheckoutCurrency {
  const normalized = language?.trim().toLowerCase().split('-')[0]

  if (normalized === 'pt') {
    return 'BRL'
  }

  if (normalized === 'ja') {
    return 'JPY'
  }

  return 'USD'
}

export function normalizeStripeCheckoutCurrency(
  currency: string | undefined
): StripeCheckoutCurrency | undefined {
  const normalized = currency?.trim().toUpperCase()
  if (!normalized) {
    return undefined
  }

  return STRIPE_CHECKOUT_CURRENCIES.has(normalized as StripeCheckoutCurrency)
    ? (normalized as StripeCheckoutCurrency)
    : undefined
}

export function parseStripeCurrencyPrices(data: unknown): StripeCurrencyPrices {
  let parsedData = data

  if (typeof data === 'string') {
    try {
      parsedData = JSON.parse(data)
    } catch {
      return {}
    }
  }

  if (
    !parsedData ||
    typeof parsedData !== 'object' ||
    Array.isArray(parsedData)
  ) {
    return {}
  }

  return Object.entries(parsedData).reduce<StripeCurrencyPrices>(
    (result, [currencyKey, priceMap]) => {
      const currency = normalizeStripeCheckoutCurrency(currencyKey)

      if (
        !currency ||
        !priceMap ||
        typeof priceMap !== 'object' ||
        Array.isArray(priceMap)
      ) {
        return result
      }

      const parsedPrices = Object.entries(priceMap).reduce<
        Record<number, number>
      >((prices, [amountKey, minorUnits]) => {
        const amount = Number(amountKey)
        const price = Number(minorUnits)

        if (
          Number.isFinite(amount) &&
          amount > 0 &&
          Number.isFinite(price) &&
          price > 0
        ) {
          prices[amount] = price
        }

        return prices
      }, {})

      if (Object.keys(parsedPrices).length > 0) {
        result[currency] = parsedPrices
      }

      return result
    },
    {}
  )
}

export function currencySupportsPresetAmounts(
  prices: StripeCurrencyPrices,
  currency: StripeCheckoutCurrency,
  presetAmounts: number[]
): boolean {
  const currencyPrices = prices[currency]

  return (
    !!currencyPrices &&
    presetAmounts.length > 0 &&
    presetAmounts.every((amount) => (currencyPrices[amount] ?? 0) > 0)
  )
}

export function stripeTopUpDisplayAmount(
  prices: StripeCurrencyPrices,
  currency: StripeCheckoutCurrency,
  amount: number
): number | undefined {
  const minorUnits = prices[currency]?.[amount]

  if (!minorUnits || minorUnits <= 0) {
    return undefined
  }

  return currency === 'JPY' ? minorUnits : minorUnits / 100
}

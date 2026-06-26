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
export type StripeTopUpPriceRow = {
  amount: number
  priceId: string
}

type LegacyStripeTopUpPriceIds = Partial<Record<number, string>>

function parseAmountOptions(value: string): number[] {
  try {
    const parsed = JSON.parse(value || '[]')
    if (!Array.isArray(parsed)) {
      return []
    }
    return [...new Set(parsed.map(Number))]
      .filter((amount) => Number.isFinite(amount) && amount > 0)
      .sort((a, b) => a - b)
  } catch {
    return []
  }
}

function parseStripeTopUpPriceIds(value: string): {
  configured: boolean
  priceIds: Record<number, string>
} {
  const trimmed = value.trim()
  if (!trimmed) {
    return { configured: false, priceIds: {} }
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { configured: true, priceIds: {} }
    }
    return {
      configured: true,
      priceIds: Object.entries(parsed).reduce<Record<number, string>>(
        (result, [key, priceId]) => {
          const amount = Number(key)
          if (
            Number.isFinite(amount) &&
            amount > 0 &&
            typeof priceId === 'string'
          ) {
            result[amount] = priceId.trim()
          }
          return result
        },
        {}
      ),
    }
  } catch {
    return { configured: true, priceIds: {} }
  }
}

export function buildStripeTopUpPriceRows(
  amountOptionsValue: string,
  stripeTopUpPriceIdsValue: string,
  legacyPriceIds: LegacyStripeTopUpPriceIds
): StripeTopUpPriceRow[] {
  const amounts = parseAmountOptions(amountOptionsValue)
  const { configured, priceIds } = parseStripeTopUpPriceIds(
    stripeTopUpPriceIdsValue
  )

  return amounts.map((amount) => ({
    amount,
    priceId: configured
      ? priceIds[amount] || ''
      : legacyPriceIds[amount]?.trim() || '',
  }))
}

export function serializeStripeTopUpPriceIds(
  rows: StripeTopUpPriceRow[]
): string {
  const priceIds = rows.reduce<Record<string, string>>((result, row) => {
    const priceId = row.priceId.trim()
    if (Number.isFinite(row.amount) && row.amount > 0 && priceId) {
      result[String(row.amount)] = priceId
    }
    return result
  }, {})

  return JSON.stringify(priceIds, null, 2)
}

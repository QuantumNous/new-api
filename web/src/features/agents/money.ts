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
import type { TopUpTotal } from './api'
// Never sum orders in different payment currencies. Unknown providers remain
// separate and retain their provider label instead of being assumed to be CNY.
export function topUpCurrency(row: TopUpTotal): string {
  if (
    row.payment_provider === 'epay' ||
    (!row.payment_provider &&
      ['alipay', 'wxpay', 'wechat'].includes(row.payment_method))
  ) {
    return 'CNY'
  }
  if (
    ['stripe', 'creem'].includes(row.payment_provider || row.payment_method)
  ) {
    return 'USD'
  }
  return row.payment_provider || row.payment_method || '—'
}
export function formatTopUps(rows: TopUpTotal[]): string {
  if (!rows.length) return '¥0.00'
  const totals = new Map<string, number>()
  for (const row of rows) {
    const currency = topUpCurrency(row)
    totals.set(currency, (totals.get(currency) ?? 0) + row.money)
  }
  return [...totals]
    .map(
      ([currency, amount]) =>
        `${currency === 'CNY' ? '¥' : `${currency} `}${amount.toFixed(2)}`
    )
    .join(' / ')
}
export function priceCents(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null
  const cents = Math.round(Number(value) * 100)
  return cents >= 2 && cents <= 6 ? cents : null
}

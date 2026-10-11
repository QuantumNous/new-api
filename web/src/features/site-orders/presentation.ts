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
import { formatLocalCurrencyAmount } from '@/lib/currency'

import type { SiteOrder } from './api'

export function paymentAmount(order: SiteOrder): string {
  let amount = order.amount_fen === null ? order.money : order.amount_fen / 100
  if (order.payment_amount) amount = Number(order.payment_amount)
  // Other legacy providers do not persist a reliable currency snapshot.
  let currency = order.amount_fen === null ? '' : 'CNY '
  if (order.currency) currency = `${order.currency} `
  return (
    currency +
    formatLocalCurrencyAmount(amount, {
      showSymbol: false,
      digitsLarge: 2,
      digitsSmall: 2,
      abbreviate: false,
    })
  )
}

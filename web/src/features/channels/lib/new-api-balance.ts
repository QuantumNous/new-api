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
import type { ChannelBalanceInfo } from '../types'

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  KRW: '₩',
  USD: '$',
}

export function formatNewAPIBalance(
  info: ChannelBalanceInfo,
  unlimitedLabel: string
): string {
  if (info.unlimited) return unlimitedLabel
  const amount = info.remaining?.trim()
  if (!amount) return '-'
  if (info.unit === 'money') {
    const currency = info.currency?.toUpperCase() || ''
    const symbol = info.display_unit?.trim() || CURRENCY_SYMBOLS[currency] || ''
    return `${symbol}${amount}`.trim()
  }
  return info.display_unit ? `${amount} ${info.display_unit}` : amount
}

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

import {
  formatCurrencyFromUSD,
  getCurrencyFractionDigits,
  type CurrencyFormatOptions,
} from '@/lib/currency'
import { formatNumber } from '@/lib/format'

import type { ChannelBalanceResult, ChannelBalanceWindow } from '../types'

/**
 * A balance amount in the currency the upstream reports it in. A USD amount
 * follows the site's display currency, as the balance column always has; any
 * other currency is shown as reported, and a unit that is no ISO currency
 * code (credits, points) follows the number.
 */
export function formatChannelBalanceAmount(
  amount: number,
  currency: string | null | undefined,
  options: CurrencyFormatOptions = {}
): string {
  const code = currency?.trim() || 'USD'
  if (code.toUpperCase() === 'USD') {
    return formatCurrencyFromUSD(amount, options)
  }
  try {
    return new Intl.NumberFormat(options.locale, {
      style: 'currency',
      currency: code,
      notation: options.compact ? 'compact' : 'standard',
      minimumFractionDigits: 0,
      maximumFractionDigits: options.compact
        ? 1
        : getCurrencyFractionDigits(amount, options),
    }).format(amount)
  } catch {
    return `${formatNumber(amount, options.locale)} ${code}`
  }
}

/** How full the fullest window is, in percent; null without a limit. */
export function getChannelBalanceUsedPercent(
  windows: ChannelBalanceWindow[] | null | undefined
): number | null {
  let percent: number | null = null
  for (const window of windows ?? []) {
    if (!(window.limit > 0)) continue
    const used = Math.round((window.used / window.limit) * 100)
    percent = Math.max(percent ?? 0, used)
  }
  return percent
}

/**
 * The short form of a balance: unlimited, the amount in its own currency, or
 * how full its fullest window is. Without a result it is the USD balance.
 */
export function formatChannelBalanceSummary(
  result: ChannelBalanceResult | null | undefined,
  usdBalance: number,
  options: CurrencyFormatOptions = {}
): string {
  if (result?.unlimited) return i18next.t('Unlimited')
  if (result?.amount != null) {
    return formatChannelBalanceAmount(result.amount, result.currency, options)
  }
  const percent = getChannelBalanceUsedPercent(result?.windows)
  if (result && percent !== null) {
    return i18next.t('{{percent}}% used', { percent })
  }
  return formatCurrencyFromUSD(usdBalance, options)
}

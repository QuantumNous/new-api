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
import { z } from 'zod'

import {
  formatCurrencyFromUSD,
  type CurrencyFormatOptions,
} from '@/lib/currency'

export const accountBalanceFormSchema = z
  .object({
    enabled: z.boolean(),
    base_url: z.string().trim(),
    user_id: z.number(),
    access_token: z.string().trim(),
    has_saved_token: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.enabled) return
    let validURL = false
    try {
      const url = new URL(value.base_url)
      validURL =
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
    } catch {
      /* An invalid URL is reported below. */
    }
    if (!validURL) {
      ctx.addIssue({
        code: 'custom',
        path: ['base_url'],
        message: 'Enter an HTTPS account site URL',
      })
    }
    if (!Number.isSafeInteger(value.user_id) || value.user_id <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['user_id'],
        message: 'Enter a positive upstream user ID',
      })
    }
    if (!value.has_saved_token && !value.access_token) {
      ctx.addIssue({
        code: 'custom',
        path: ['access_token'],
        message: 'Enter an account access token',
      })
    }
  })

export type AccountBalanceFormValues = z.infer<typeof accountBalanceFormSchema>

export function formatChannelBalance(
  balance: number,
  currency?: string,
  options: CurrencyFormatOptions = {}
): string {
  if (currency !== 'CNY' && currency !== 'USD') {
    return formatCurrencyFromUSD(balance, options)
  }
  const digits =
    Math.abs(balance) < 1 && balance !== 0
      ? (options.digitsSmall ?? 4)
      : (options.digitsLarge ?? 2)
  return new Intl.NumberFormat(options.locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    notation: options.compact ? 'compact' : 'standard',
    minimumFractionDigits: options.compact ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(balance)
}

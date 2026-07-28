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
const SAVINGS_WINDOW_SECONDS = 24 * 60 * 60

export function getRollingSavingsTimeRange(nowMs = Date.now()): {
  start_timestamp: number
  end_timestamp: number
} {
  const endTimestamp = Math.floor(nowMs / 1000)
  return {
    start_timestamp: endTimestamp - SAVINGS_WINDOW_SECONDS,
    end_timestamp: endTimestamp,
  }
}

export function formatSavingsQuotaAsCNY(
  quota: number,
  quotaPerUnit: number,
  usdExchangeRate: number,
  locales?: Intl.LocalesArgument
): string {
  if (!Number.isFinite(quota)) return '-'

  const amountCNY = savingsQuotaToCNY(quota, quotaPerUnit, usdExchangeRate)

  return new Intl.NumberFormat(locales, {
    style: 'currency',
    currency: 'CNY',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(amountCNY) >= 1 ? 2 : 4,
  }).format(amountCNY)
}

export function savingsQuotaToCNY(
  quota: number,
  quotaPerUnit: number,
  usdExchangeRate: number
): number {
  if (!Number.isFinite(quota)) return 0

  const effectiveQuotaPerUnit =
    Number.isFinite(quotaPerUnit) && quotaPerUnit > 0 ? quotaPerUnit : 500_000
  const effectiveExchangeRate =
    Number.isFinite(usdExchangeRate) && usdExchangeRate > 0
      ? usdExchangeRate
      : 1
  return (quota / effectiveQuotaPerUnit) * effectiveExchangeRate
}

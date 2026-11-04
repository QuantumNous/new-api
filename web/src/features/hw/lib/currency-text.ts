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
import type { HwLanguage } from '../texts'
import {
  HW_BONUS_USD,
  hwUsdAmountIn,
  HW_FIRST_PURCHASE_CAP_TRY,
  hwTryAmountIn,
  type HwCurrency,
  type HwRates,
} from './currency'

const NAMES: Record<HwLanguage, Record<HwCurrency, string>> = {
  tr: { TRY: 'TL', EUR: 'Euro', USD: 'Dolar' },
  en: { TRY: 'TRY', EUR: 'EUR', USD: 'USD' },
}

const LONG_NAMES: Record<HwLanguage, Record<HwCurrency, string>> = {
  tr: { TRY: 'Türk lirası', EUR: 'euro', USD: 'ABD doları' },
  en: { TRY: 'Turkish lira', EUR: 'euros', USD: 'US dollars' },
}

/** A whole amount worded the way the page text always did: "250 TL", "TRY 250". */
function wordAmount(
  amount: number,
  currency: HwCurrency,
  language: HwLanguage
): string {
  if (currency === 'TRY') {
    return language === 'tr'
      ? `${amount} TL`
      : `TRY ${new Intl.NumberFormat('en').format(amount)}`
  }
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * The `{placeholder}` values every HisarWeb text may use, for the active
 * currency: `{bonus}` (the start bonus), `{firstCap}` (the welcome-discount
 * ceiling), `{currencyName}` and `{currencyLong}`. The two amounts are defined
 * in TRY on the server and shown here rounded down in the other currencies.
 */
export function hwCurrencyTextVars(
  currency: HwCurrency,
  rates: HwRates,
  language: HwLanguage
): Record<string, string> {
  return {
    bonus: wordAmount(
      hwUsdAmountIn(HW_BONUS_USD, currency, rates),
      currency,
      language
    ),
    firstCap: wordAmount(
      hwTryAmountIn(HW_FIRST_PURCHASE_CAP_TRY, currency, rates),
      currency,
      language
    ),
    currencyName: NAMES[language][currency],
    currencyLong: LONG_NAMES[language][currency],
  }
}

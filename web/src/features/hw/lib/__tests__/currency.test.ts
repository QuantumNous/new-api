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
import { describe, expect, it } from 'vitest'

import {
  convertHwUsd,
  detectHwDefaultCurrency,
  hwTryAmountIn,
  niceFloor,
  parseHwCurrencyConfig,
  readHwProfileCurrency,
  resolveHwCurrency,
  HW_LEGACY_CURRENCY_CONFIG,
} from '../currency'
import { formatHwAmount, formatHwMoney } from '../format'

const STATUS = {
  hw_currencies: ['TRY', 'EUR', 'USD'],
  hw_rates: { TRY: '49.578', EUR: '0.86', USD: '1' },
  hw_topup: {
    TRY: { min: 100, max: 20000, presets: [250, 500, 1000] },
    EUR: { min: 3, max: 400, presets: [10, 20, 50] },
    USD: { min: 3, max: 450, presets: [10, 25, 50] },
  },
}

describe('parseHwCurrencyConfig', () => {
  it('reads currencies, rates and top-up limits', () => {
    const config = parseHwCurrencyConfig(STATUS)
    expect(config.currencies).toEqual(['TRY', 'EUR', 'USD'])
    expect(config.rates).toEqual({ TRY: 49.578, EUR: 0.86, USD: 1 })
    expect(config.topUp.EUR).toEqual({ min: 3, max: 400, presets: [10, 20, 50] })
  })

  it('stays TRY only for an older server', () => {
    expect(parseHwCurrencyConfig({})).toBe(HW_LEGACY_CURRENCY_CONFIG)
    expect(parseHwCurrencyConfig(null)).toBe(HW_LEGACY_CURRENCY_CONFIG)
  })

  it('drops a currency without a rate or limits', () => {
    const config = parseHwCurrencyConfig({
      ...STATUS,
      hw_rates: { TRY: '49.5', USD: '1' },
    })
    expect(config.currencies).toEqual(['TRY', 'USD'])
  })
})

describe('detectHwDefaultCurrency', () => {
  const all = ['TRY', 'EUR', 'USD'] as const

  it.each([
    [{ languages: ['tr-TR'] }, 'TRY'],
    [{ languages: ['en-US'], timeZone: 'Europe/Istanbul' }, 'TRY'],
    [{ languages: ['de-DE'] }, 'EUR'],
    [{ languages: ['en-US'], timeZone: 'Europe/Paris' }, 'EUR'],
    [{ languages: ['en-US'], timeZone: 'America/New_York' }, 'USD'],
  ] as const)('%j gives %s', (signals, expected) => {
    expect(detectHwDefaultCurrency(all, signals)).toBe(expected)
  })

  it('only picks a currency that is on sale', () => {
    expect(detectHwDefaultCurrency(['TRY', 'USD'], { languages: ['de-DE'] })).toBe(
      'TRY'
    )
  })

  it('prefers a saved choice that is still on sale', () => {
    const config = parseHwCurrencyConfig(STATUS)
    const signals = { languages: ['tr-TR'] }
    expect(resolveHwCurrency(config, 'EUR', signals)).toBe('EUR')
    expect(resolveHwCurrency(HW_LEGACY_CURRENCY_CONFIG, 'EUR', signals)).toBe(
      'TRY'
    )
  })
})

describe('conversion', () => {
  it('converts USD with the rate and refuses a missing one', () => {
    expect(convertHwUsd(10, 'EUR', { EUR: 0.86 })).toBeCloseTo(8.6)
    expect(convertHwUsd(10, 'USD', {})).toBe(10)
    expect(convertHwUsd(10, 'EUR', {})).toBeNull()
  })

  it('rounds budgets down to tidy numbers', () => {
    expect(niceFloor(7.9)).toBe(7)
    expect(niceFloor(47)).toBe(45)
    expect(niceFloor(1234)).toBe(1200)
  })

  it('keeps TRY amounts and floors converted ones', () => {
    const rates = { TRY: 50, EUR: 0.9, USD: 1 }
    expect(hwTryAmountIn(250, 'TRY', rates)).toBe(250)
    expect(hwTryAmountIn(250, 'USD', rates)).toBe(5)
    expect(hwTryAmountIn(250, 'EUR', rates)).toBe(4)
  })

  it('does not lose a whole unit to a rate a hair above the round number', () => {
    // Live rate of 4 November: 250 TL is $4.997 in the ledger, shown as $5.00.
    const rates = { TRY: 50.026, EUR: 0.889212, USD: 1 }
    expect(hwTryAmountIn(250, 'USD', rates)).toBe(5)
    expect(hwTryAmountIn(250, 'EUR', rates)).toBe(4)
    expect(hwTryAmountIn(1000, 'USD', rates)).toBe(20)
    expect(hwTryAmountIn(250, 'USD', { TRY: 52, USD: 1 })).toBe(4)
  })
})

describe('profile currency', () => {
  it('reads hw_currency from a JSON string or an object', () => {
    expect(readHwProfileCurrency('{"hw_currency":"EUR"}')).toBe('EUR')
    expect(readHwProfileCurrency({ hw_currency: 'USD' })).toBe('USD')
    expect(readHwProfileCurrency({ hw_currency: 'GBP' })).toBeNull()
    expect(readHwProfileCurrency('not json')).toBeNull()
    expect(readHwProfileCurrency(undefined)).toBeNull()
  })
})

describe('formatters', () => {
  it('shows each currency with its own symbol', () => {
    expect(formatHwAmount(250, 'TRY', 'tr')).toBe('₺250')
    expect(formatHwAmount(10, 'EUR', 'en')).toBe('€10')
    expect(formatHwAmount(10.5, 'USD', 'en')).toBe('$10.50')
    expect(formatHwMoney(0.0123, 'USD', 'en')).toBe('$0.0123')
    expect(formatHwMoney(null, 'EUR', 'en')).toBe('-')
  })
})

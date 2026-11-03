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
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { HW_LEGACY_CURRENCY_CONFIG } from '@/features/hw/lib/currency'
import { useHwCurrencyStore } from '@/stores/hw-currency-store'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import {
  formatBillingCurrencyFromUSD,
  formatCurrencyFromUSD,
  formatLocalCurrencyAmount,
  formatQuotaWithCurrency,
  getCurrencyLabel,
} from '../currency'

beforeEach(async () => {
  await i18next.changeLanguage('tr')
})

afterEach(async () => {
  await i18next.changeLanguage('en')
  useSystemConfigStore.getState().setConfig({
    currency: { ...DEFAULT_CURRENCY_CONFIG },
  })
  useHwCurrencyStore.setState({
    config: HW_LEGACY_CURRENCY_CONFIG,
    preferred: null,
  })
})

describe('money notation', () => {
  test('writes dollars with Turkish digits and two decimals', () => {
    expect(formatCurrencyFromUSD(12.5)).toBe('$12,50')
    expect(formatCurrencyFromUSD(0)).toBe('$0,00')
  })

  test('puts a thousands dot in larger amounts', () => {
    expect(formatCurrencyFromUSD(1234.5)).toBe('$1.234,50')
  })

  test('shows lira with the symbol first and no space', () => {
    useSystemConfigStore.getState().setConfig({
      currency: {
        ...DEFAULT_CURRENCY_CONFIG,
        quotaDisplayType: 'CUSTOM',
        customCurrencySymbol: 'TL',
        customCurrencyExchangeRate: 24.5,
      },
    })
    expect(formatCurrencyFromUSD(10)).toBe('₺245,00')
    expect(formatCurrencyFromUSD(0)).toBe('₺0,00')
    expect(formatCurrencyFromUSD(10.0008)).toBe('₺245,02')
  })
})

describe('the header currency switch', () => {
  // The live site: the console shows lira, the shop sells TRY, EUR and USD.
  beforeEach(() => {
    useSystemConfigStore.getState().setConfig({
      currency: {
        ...DEFAULT_CURRENCY_CONFIG,
        quotaDisplayType: 'CUSTOM',
        customCurrencySymbol: '₺',
        customCurrencyExchangeRate: 50,
      },
    })
    useHwCurrencyStore.setState({
      config: {
        currencies: ['TRY', 'EUR', 'USD'],
        rates: { TRY: 50, EUR: 0.9, USD: 1 },
        topUp: {},
      },
    })
  })

  test('keeps the console lira for TRY', () => {
    useHwCurrencyStore.setState({ preferred: 'TRY' })
    expect(formatCurrencyFromUSD(10)).toBe('₺500,00')
    expect(getCurrencyLabel()).toBe('₺')
  })

  test('shows balances and prices in dollars after picking USD', () => {
    useHwCurrencyStore.setState({ preferred: 'USD' })
    expect(formatCurrencyFromUSD(10)).toBe('$10,00')
    expect(
      formatQuotaWithCurrency(10 * DEFAULT_CURRENCY_CONFIG.quotaPerUnit)
    ).toBe('$10,00')
    expect(formatBillingCurrencyFromUSD(0.5)).toBe('$0,50')
    expect(getCurrencyLabel()).toBe('USD')
  })

  test('converts with the euro rate after picking EUR', () => {
    useHwCurrencyStore.setState({ preferred: 'EUR' })
    expect(formatCurrencyFromUSD(10)).toBe('€9,00')
    expect(getCurrencyLabel()).toBe('EUR')
  })

  test('keeps the console currency when the chosen one has no rate', () => {
    useHwCurrencyStore.setState({
      config: { currencies: ['TRY', 'EUR'], rates: { TRY: 50 }, topUp: {} },
      preferred: 'EUR',
    })
    expect(formatCurrencyFromUSD(10)).toBe('₺500,00')
  })

  test('never converts an amount that is already in local currency', () => {
    useHwCurrencyStore.setState({ preferred: 'USD' })
    expect(formatLocalCurrencyAmount(250)).toBe('₺250,00')
  })

  test('leaves the token display alone', () => {
    useSystemConfigStore.getState().setConfig({
      currency: { ...DEFAULT_CURRENCY_CONFIG, quotaDisplayType: 'TOKENS' },
    })
    useHwCurrencyStore.setState({ preferred: 'USD' })
    expect(getCurrencyLabel()).toBe('Tokens')
  })
})

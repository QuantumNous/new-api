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
import { describe, expect, test } from 'bun:test'
import { calculatePresetPricing } from './format'
import {
  generatePresetAmounts,
  getInitialPresetTopupAmount,
  getLockedTopupAmountOptions,
  getWalletCheckoutInitialTopupAmount,
  isPresetTopupAmount,
  mergePresetAmounts,
  normalizeWalletCheckoutSearch,
  shouldConsumeWalletCheckoutSearchParams,
  shouldRequireConfiguredTopupPackages,
} from './payment'

describe('top-up bonus preset metadata', () => {
  test('attaches configured bonus amounts to custom presets', () => {
    expect(mergePresetAmounts([20, 50], {}, { 20: 5 })).toEqual([
      { value: 20, discount: 1, bonus: 5 },
      { value: 50, discount: 1 },
    ])
  })

  test('attaches configured bonus amounts to generated presets', () => {
    expect(generatePresetAmounts(20, { 20: 5 })[0]).toEqual({
      value: 20,
      bonus: 5,
    })
  })

  test('calculates credited total separately from the payment amount', () => {
    expect(calculatePresetPricing(20, 1, 1, 1, 5)).toMatchObject({
      bonusAmount: 5,
      creditAmount: 25,
      actualPrice: 20,
    })
  })

  test('suppresses bonus when the user has no remaining claims for that tier', () => {
    // 档位 20 剩余 0 次 → 不显示赠送；档位 50 剩余 2 次 → 正常显示
    expect(
      mergePresetAmounts([20, 50], {}, { 20: 5, 50: 15 }, { 20: 0, 50: 2 })
    ).toEqual([
      { value: 20, discount: 1 },
      { value: 50, discount: 1, bonus: 15 },
    ])
  })

  test('keeps bonus when a tier has no configured limit (absent from remaining map)', () => {
    // remaining 缺档位 20 的 key = 不限次 → 照常显示赠送
    expect(generatePresetAmounts(20, { 20: 5 }, {})[0]).toEqual({
      value: 20,
      bonus: 5,
    })
  })

  test('suppresses bonus on generated presets when remaining is zero', () => {
    expect(generatePresetAmounts(20, { 20: 5 }, { 20: 0 })[0]).toEqual({
      value: 20,
    })
  })

  test('initializes top-up amount from the first configured preset', () => {
    expect(
      getInitialPresetTopupAmount([
        { value: 10 },
        { value: 20 },
        { value: 200 },
      ])
    ).toBe(10)
    expect(getInitialPresetTopupAmount([])).toBe(0)
  })

  test('initializes top-up amount from a valid pricing CTA search package', () => {
    const presets = [{ value: 10 }, { value: 20 }, { value: 200 }]
    const checkoutSearch = normalizeWalletCheckoutSearch({
      amount: '20',
      currency: 'USD',
      amount_minor: '2000',
      stripe_lookup_key: 'topup-usd-2000',
    })

    expect(getWalletCheckoutInitialTopupAmount(checkoutSearch, presets)).toBe(
      20
    )
    expect(
      getWalletCheckoutInitialTopupAmount(
        normalizeWalletCheckoutSearch({
          amount: '49.9',
          currency: 'BRL',
          amount_minor: '4990',
          stripe_lookup_key: 'topup-brl-4990',
        }),
        presets
      )
    ).toBe(0)
    expect(
      getWalletCheckoutInitialTopupAmount(
        normalizeWalletCheckoutSearch({
          amount: '20',
          currency: 'EUR',
          amount_minor: '2000',
          stripe_lookup_key: 'topup-eur-2000',
        }),
        presets
      )
    ).toBe(0)
  })

  test('consumes pricing CTA search params only after a valid package is applied', () => {
    const checkoutSearch = normalizeWalletCheckoutSearch({
      amount: '20',
      currency: 'USD',
      amount_minor: '2000',
      stripe_lookup_key: 'topup-usd-2000',
    })

    expect(shouldConsumeWalletCheckoutSearchParams(checkoutSearch, 20)).toBe(
      true
    )
    expect(shouldConsumeWalletCheckoutSearchParams(checkoutSearch, 0)).toBe(
      false
    )
    expect(shouldConsumeWalletCheckoutSearchParams(undefined, 20)).toBe(false)
  })

  test('only accepts top-up amounts that match configured presets', () => {
    const presets = [{ value: 10 }, { value: 20 }, { value: 200 }]

    expect(isPresetTopupAmount(20, presets)).toBe(true)
    expect(isPresetTopupAmount(15, presets)).toBe(false)
    expect(isPresetTopupAmount(0, presets)).toBe(false)
  })

  test('locks Stripe top-up amount options to configured presets', () => {
    expect(getLockedTopupAmountOptions([10, 20, 50], true)).toEqual([
      10, 20, 50,
    ])
    expect(getLockedTopupAmountOptions([10, 20, 50], false)).toEqual([
      10, 20, 50,
    ])
  })

  test('drops invalid locked top-up amount options', () => {
    expect(
      getLockedTopupAmountOptions([10, 0, -1, Number.NaN, 20], true)
    ).toEqual([10, 20])
    expect(getLockedTopupAmountOptions([], true)).toEqual([])
  })

  test('requires configured packages only when Stripe is the sole top-up channel', () => {
    expect(
      shouldRequireConfiguredTopupPackages({
        enable_stripe_topup: true,
        enable_online_topup: false,
        enable_paddle_topup: false,
        enable_waffo_topup: false,
        enable_waffo_pancake_topup: false,
      })
    ).toBe(true)

    expect(
      shouldRequireConfiguredTopupPackages({
        enable_stripe_topup: true,
        enable_online_topup: true,
        enable_paddle_topup: false,
        enable_waffo_topup: false,
        enable_waffo_pancake_topup: false,
      })
    ).toBe(false)

    expect(
      shouldRequireConfiguredTopupPackages({
        enable_stripe_topup: true,
        enable_online_topup: false,
        enable_paddle_topup: false,
        enable_waffo_topup: true,
        enable_waffo_pancake_topup: false,
      })
    ).toBe(false)
  })
})

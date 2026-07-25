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
import type { RecallClaimView } from '../types'
import {
  getRecallPriceDiscount,
  getTopupStripePriceId,
  isRecallPriceEligible,
  normalizeRecallClaim,
  removeRecallClaimFromSearch,
} from './recall-claim'

const claimView: RecallClaimView = {
  campaign_id: 17,
  recipient_id: 29,
  campaign_name: 'Come back offer',
  promotion_code_masked: 'FKSE****34',
  expires_at: 1_800_000_000,
  discount: {
    type: 'percent',
    percent_off: 25,
    amount_off: 0,
    currency: '',
    minimum_amount: 0,
    minimum_amount_currency: '',
    coupon_redeem_by: 1_800_000_000,
  },
  products: {
    topup_price_ids: ['price_topup_20'],
    subscription_price_ids: ['price_subscription_monthly'],
  },
  redeemed: false,
}

describe('normalizeRecallClaim', () => {
  test('trims a claim without changing its contents', () => {
    expect(normalizeRecallClaim('  signed-claim-value  ')).toBe(
      'signed-claim-value'
    )
  })

  test('returns undefined for missing or blank claims', () => {
    expect(normalizeRecallClaim(undefined)).toBeUndefined()
    expect(normalizeRecallClaim('   ')).toBeUndefined()
  })
})

describe('removeRecallClaimFromSearch', () => {
  test('removes every recall claim while preserving unrelated parameters', () => {
    expect(
      removeRecallClaimFromSearch(
        '?currency=USD&recall_claim=first&show_history=true&recall_claim=second'
      )
    ).toBe('?currency=USD&show_history=true')
  })

  test('returns an empty search when no other parameters remain', () => {
    expect(removeRecallClaimFromSearch('?recall_claim=signed-secret')).toBe('')
  })
})

describe('getTopupStripePriceId', () => {
  test('returns the normalized Stripe Price ID for the selected amount', () => {
    expect(getTopupStripePriceId({ 20: ' price_topup_20 ' }, 20)).toBe(
      'price_topup_20'
    )
  })

  test('returns undefined for unconfigured top-up amounts', () => {
    expect(getTopupStripePriceId({ 20: 'price_topup_20' }, 200)).toBeUndefined()
  })
})

describe('isRecallPriceEligible', () => {
  test('uses the top-up Stripe Price allowlist for top-ups', () => {
    expect(isRecallPriceEligible(claimView, 'price_topup_20', 'topup')).toBe(
      true
    )
    expect(
      isRecallPriceEligible(claimView, 'price_subscription_monthly', 'topup')
    ).toBe(false)
  })

  test('uses the subscription Stripe Price allowlist for subscriptions', () => {
    expect(
      isRecallPriceEligible(
        claimView,
        'price_subscription_monthly',
        'subscription'
      )
    ).toBe(true)
    expect(
      isRecallPriceEligible(claimView, 'price_topup_20', 'subscription')
    ).toBe(false)
  })

  test('rejects a missing Stripe Price ID', () => {
    expect(isRecallPriceEligible(claimView, undefined, 'topup')).toBe(false)
  })

  test('rejects an otherwise eligible Stripe Price after claim expiry', () => {
    expect(
      isRecallPriceEligible(
        claimView,
        'price_subscription_monthly',
        'subscription',
        claimView.expires_at + 1
      )
    ).toBe(false)
  })
})

describe('getRecallPriceDiscount', () => {
  test('previews a percent subscription discount in minor units', () => {
    expect(
      getRecallPriceDiscount(
        {
          ...claimView,
          discount: { ...claimView.discount, type: 'percent', percent_off: 20 },
        },
        'price_subscription_monthly',
        'subscription',
        10,
        'USD',
        1_700_000_000
      )
    ).toMatchObject({
      type: 'percent',
      originalAmount: 10,
      discountAmount: 2,
      discountedAmount: 8,
      currency: 'USD',
    })
  })

  test('previews a fixed subscription discount for matching currency', () => {
    expect(
      getRecallPriceDiscount(
        {
          ...claimView,
          discount: {
            ...claimView.discount,
            type: 'fixed',
            amount_off: 200,
            currency: 'USD',
          },
        },
        'price_subscription_monthly',
        'subscription',
        10,
        'USD',
        1_700_000_000
      )
    ).toMatchObject({
      type: 'fixed',
      originalAmount: 10,
      discountAmount: 2,
      discountedAmount: 8,
      currency: 'USD',
    })
  })

  test('rejects fixed discounts with mismatched currency', () => {
    expect(
      getRecallPriceDiscount(
        {
          ...claimView,
          discount: {
            ...claimView.discount,
            type: 'fixed',
            amount_off: 200,
            currency: 'EUR',
          },
        },
        'price_subscription_monthly',
        'subscription',
        10,
        'USD',
        1_700_000_000
      )
    ).toBeNull()
  })

  test('rejects fixed discounts below the minimum amount restriction', () => {
    expect(
      getRecallPriceDiscount(
        {
          ...claimView,
          discount: {
            ...claimView.discount,
            type: 'fixed',
            amount_off: 200,
            currency: 'USD',
            minimum_amount: 1500,
            minimum_amount_currency: 'USD',
          },
        },
        'price_subscription_monthly',
        'subscription',
        10,
        'USD',
        1_700_000_000
      )
    ).toBeNull()
  })

  test('floors a fixed discount at zero when amount off exceeds price', () => {
    expect(
      getRecallPriceDiscount(
        {
          ...claimView,
          discount: {
            ...claimView.discount,
            type: 'fixed',
            amount_off: 1200,
            currency: 'USD',
          },
        },
        'price_subscription_monthly',
        'subscription',
        10,
        'USD',
        1_700_000_000
      )
    ).toMatchObject({
      originalAmount: 10,
      discountAmount: 10,
      discountedAmount: 0,
      currency: 'USD',
    })
  })
})

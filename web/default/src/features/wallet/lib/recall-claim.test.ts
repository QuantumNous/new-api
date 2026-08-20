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
import type { RecallOfferView } from '../types'
import {
  getRecallPriceDiscount,
  getTopupStripePriceId,
  isRecallPriceEligible,
  selectBestRecallOffer,
  normalizeRecallClaim,
  removeRecallClaimFromSearch,
} from './recall-claim'

const claimView: RecallOfferView = {
  campaign_id: 17,
  recipient_id: 29,
  issued_at: 1_700_000_000,
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
    subscription_plan_ids: [1],
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

  test('uses the internal plan ID allowlist for subscriptions', () => {
    expect(isRecallPriceEligible(claimView, 1, 'subscription')).toBe(true)
    expect(isRecallPriceEligible(claimView, 2, 'subscription')).toBe(false)
  })

  test('rejects a missing Stripe Price ID', () => {
    expect(isRecallPriceEligible(claimView, undefined, 'topup')).toBe(false)
  })

  test('rejects an otherwise eligible Stripe Price after claim expiry', () => {
    expect(
      isRecallPriceEligible(
        claimView,
        1,
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
        1,
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
        1,
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

  test('previews a fixed JPY discount as a zero-decimal amount', () => {
    expect(
      getRecallPriceDiscount(
        {
          ...claimView,
          discount: {
            ...claimView.discount,
            type: 'fixed',
            amount_off: 500,
            currency: 'JPY',
            minimum_amount: 1000,
            minimum_amount_currency: 'JPY',
          },
        },
        1,
        'subscription',
        3000,
        'JPY',
        1_700_000_000
      )
    ).toMatchObject({
      type: 'fixed',
      originalAmount: 3000,
      discountAmount: 500,
      discountedAmount: 2500,
      currency: 'JPY',
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
        1,
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
        1,
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
        1,
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

describe('selectBestRecallOffer', () => {
  test('selects largest actual discount then latest issue then lowest recipient id', () => {
    const offers: RecallOfferView[] = [
      {
        ...claimView,
        recipient_id: 50,
        issued_at: 1_700_000_010,
        discount: { ...claimView.discount, type: 'percent', percent_off: 20 },
      },
      {
        ...claimView,
        recipient_id: 30,
        issued_at: 1_700_000_020,
        discount: { ...claimView.discount, type: 'percent', percent_off: 25 },
      },
      {
        ...claimView,
        recipient_id: 20,
        issued_at: 1_700_000_020,
        discount: {
          ...claimView.discount,
          type: 'fixed',
          amount_off: 250,
          currency: 'USD',
        },
      },
      {
        ...claimView,
        recipient_id: 10,
        issued_at: 1_700_000_000,
        discount: {
          ...claimView.discount,
          type: 'fixed',
          amount_off: 250,
          currency: 'USD',
        },
      },
    ]

    expect(
      selectBestRecallOffer(offers, {
        purchaseKind: 'topup',
        productId: 'price_topup_20',
        amountMajor: 10,
        currency: 'USD',
        nowSeconds: 1_700_000_000,
      })?.recipient_id
    ).toBe(20)
  })
})

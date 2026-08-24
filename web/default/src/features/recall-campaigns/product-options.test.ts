import { describe, expect, test } from 'bun:test'
import {
  appendUnavailableSelections,
  buildSubscriptionProductOptions,
  buildTopUpProductOptions,
  isRecallProductSelectorDisabled,
} from './product-options'

describe('recall campaign product options', () => {
  test('keeps saved selections editable when configuration loading fails', () => {
    expect(isRecallProductSelectorDisabled(false, 'error')).toBe(false)
    expect(isRecallProductSelectorDisabled(false, 'loading')).toBe(true)
    expect(isRecallProductSelectorDisabled(true, 'error')).toBe(true)
  })

  test('sorts configured top-up prices by amount', () => {
    expect(
      buildTopUpProductOptions(
        {
          200: 'price_topup_200',
          20: 'price_topup_20',
        },
        []
      )
    ).toEqual([
      {
        value: 'price_topup_20',
        label: '20 USD',
        unavailable: false,
      },
      {
        value: 'price_topup_200',
        label: '200 USD',
        unavailable: false,
      },
    ])
  })

  test('only offers enabled subscription plans with Stripe prices', () => {
    expect(
      buildSubscriptionProductOptions(
        [
          {
            plan: {
              id: 1,
              title: 'Pro monthly',
              price_amount: 20,
              currency: 'USD',
              enabled: true,
              stripe_price_id: 'price_pro_month',
            },
          },
          {
            plan: {
              id: 2,
              title: 'Disabled plan',
              price_amount: 50,
              currency: 'USD',
              enabled: false,
              stripe_price_id: 'price_disabled',
            },
          },
          {
            plan: {
              id: 3,
              title: 'Balance only',
              price_amount: 10,
              currency: 'USD',
              enabled: true,
              stripe_price_id: ' ',
            },
          },
        ],
        []
      )
    ).toEqual([
      {
        value: 'price_pro_month',
        label: 'Pro monthly · 20 USD',
        unavailable: false,
      },
    ])
  })

  test('keeps saved prices visible when configuration no longer contains them', () => {
    expect(appendUnavailableSelections([], ['price_removed'])).toEqual([
      {
        value: 'price_removed',
        label: 'Unavailable · price_removed',
        unavailable: true,
      },
    ])
  })

  test('does not duplicate selected prices that remain configured', () => {
    const configured = [
      {
        value: 'price_topup_20',
        label: '20 USD',
        unavailable: false,
      },
    ]

    expect(
      appendUnavailableSelections(configured, [
        'price_topup_20',
        'price_removed',
        'price_removed',
      ])
    ).toEqual([
      configured[0],
      {
        value: 'price_removed',
        label: 'Unavailable · price_removed',
        unavailable: true,
      },
    ])
  })
})

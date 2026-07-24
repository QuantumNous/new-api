import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import {
  getRecallProductSelectorState,
  selectedRecallProductFallbackOptions,
} from '../product-options'
import { CampaignProductSelector } from './campaign-product-selector'

const testI18n = createInstance()
const topUpKey = ['recall-campaigns', 'product-options', 'top-up']
const subscriptionKey = ['recall-campaigns', 'product-options', 'subscription']

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

function renderSelector(options?: {
  topUpPriceIDs?: string[]
  subscriptionPriceIDs?: string[]
  immutable?: boolean
  topUpPrices?: Record<string, string>
  subscriptions?: unknown[]
}): string {
  const client = new QueryClient()
  client.setQueryData(topUpKey, {
    success: true,
    data: { stripe_price_ids: options?.topUpPrices ?? {} },
  })
  client.setQueryData(subscriptionKey, {
    success: true,
    data: options?.subscriptions ?? [],
  })
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={testI18n}>
        <CampaignProductSelector
          topUpPriceIDs={options?.topUpPriceIDs ?? []}
          subscriptionPriceIDs={options?.subscriptionPriceIDs ?? []}
          onTopUpChange={() => undefined}
          onSubscriptionChange={() => undefined}
          immutable={options?.immutable ?? false}
        />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

describe('CampaignProductSelector', () => {
  test('renders configured labels and preserves unavailable saved prices', () => {
    const html = renderSelector({
      topUpPriceIDs: ['price_topup_20', 'price_removed'],
      subscriptionPriceIDs: ['price_pro_month'],
      topUpPrices: { 20: 'price_topup_20' },
      subscriptions: [
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
      ],
    })

    expect(html).toContain('20 USD')
    expect(html).not.toContain('20 USD · price_topup_20')
    expect(html).toContain('Unavailable · price_removed')
    expect(html).toContain('Pro monthly · 20 USD')
    expect(html).not.toContain('Pro monthly · 20 USD · price_pro_month')
  })

  test('explains where to configure products when no options exist', () => {
    const html = renderSelector()

    expect(html).toContain(
      'Configure Stripe top-up prices in Payment settings.'
    )
    expect(html).toContain(
      'Configure enabled Stripe subscription plans in Subscription management.'
    )
  })

  test('disables both selectors for immutable campaigns', () => {
    const html = renderSelector({ immutable: true })

    expect(html).toMatch(
      /<input(?=[^>]*id="recall-top-up-products")(?=[^>]*disabled="")[^>]*>/
    )
    expect(html).toMatch(
      /<input(?=[^>]*id="recall-subscription-products")(?=[^>]*disabled="")[^>]*>/
    )
  })

  test('distinguishes loading, error, empty, and ready states', () => {
    expect(getRecallProductSelectorState(true, false, false)).toBe('loading')
    expect(getRecallProductSelectorState(false, true, false)).toBe('error')
    expect(getRecallProductSelectorState(false, false, false)).toBe('empty')
    expect(getRecallProductSelectorState(false, false, true)).toBe('ready')
  })

  test('keeps selected prices available while configuration cannot be used', () => {
    expect(
      selectedRecallProductFallbackOptions([
        'price_saved_topup',
        'price_saved_subscription',
      ])
    ).toEqual([
      { label: 'price_saved_topup', value: 'price_saved_topup' },
      { label: 'price_saved_subscription', value: 'price_saved_subscription' },
    ])
  })
})

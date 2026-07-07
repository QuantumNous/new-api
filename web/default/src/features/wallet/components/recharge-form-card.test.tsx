import { beforeAll, describe, expect, test } from 'bun:test'
import i18n from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { initReactI18next } from 'react-i18next'
import type { TopupInfo } from '../types'
import {
  RechargeFormCard,
  WalletEnterpriseContactContent,
} from './recharge-form-card'

const topupInfoWithStripe: TopupInfo = {
  enable_online_topup: false,
  enable_stripe_topup: true,
  pay_methods: [{ name: 'Stripe Card', type: 'stripe', min_topup: 1 }],
  min_topup: 1,
  stripe_min_topup: 1,
  amount_options: [],
  discount: {},
  bonus: {},
  enable_redemption: false,
}

describe('RechargeFormCard', () => {
  beforeAll(async () => {
    await i18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      resources: {
        en: {
          translation: {
            'Top up for {{amount}}': 'Top up for {{amount}}',
          },
        },
      },
      interpolation: {
        escapeValue: false,
      },
    })
  })

  test('renders website-style USD Stripe top-up plans without the legacy add-funds flow', () => {
    const html = renderToStaticMarkup(
      <RechargeFormCard
        topupInfo={{
          ...topupInfoWithStripe,
          amount_options: [10, 20, 200],
        }}
        presetAmounts={[
          { value: 10, bonus: 3 },
          { value: 20, bonus: 8 },
          { value: 200, bonus: 100 },
        ]}
        selectedPreset={null}
        onSelectPreset={() => undefined}
        onStripeTopUp={() => undefined}
        paymentLoadingAmount={null}
      />
    )

    expect(html).toContain('Top-up Packages')
    expect(html).toContain('$10')
    expect(html).toContain('$20')
    expect(html).toContain('$200')
    expect(html).toContain('Enterprise')
    expect(html).toContain('Custom')
    expect(html).toContain('Top up for $10')
    expect(html).toContain('Top up for $20')
    expect(html).toContain('Top up for $200')
    expect(html).toContain('Contact Us')
    expect(html).not.toContain('mailto:support@flatkey.ai')
    expect(html).not.toContain('Top Up')
    expect(html).toContain('Top up $10')
    expect(html).toContain('Top up $20')
    expect(html).toContain('Top up $200')
    expect(html).toContain('Pay $10, get $13 in credit')
    expect(html).toContain('Most Popular')
    expect(html).toContain('Get $3 free')
    expect(html).toContain('Get $8 free')
    expect(html).toContain('Pay $20, get $28 in credit')
    expect(html).toContain('Get $100 free')
    expect(html).toContain('Pay $200, get $300 in credit')
    expect(html).not.toContain('more usage than the official plan')
    expect(html).toContain('Prepaid balance, no surprise bill')
    expect(html).toContain('One API key for everything')
    expect(html).toContain('Zero vendor lock-in')
    expect(html).toContain('Usage analytics and cost controls')
    expect(html).toContain('Enterprise-grade privacy')
    expect(html).toContain('One invoice across providers')
    expect(html).toContain('Highest prepaid value')
    expect(html).toContain('Custom usage, routing, and invoicing')
    expect(html).toContain('Custom monthly usage')
    expect(html).toContain('Team procurement support')
    expect(html).toContain('Custom routing discounts')
    expect(html).toContain(
      'No contract required. Add balance, create a key, copy the base_url, and test your first request.'
    )
    expect(html).toContain('Best for trying real API workloads.')
    expect(html).toContain('Bonus credit on every top-up')
    expect(html).not.toContain('Best first top-up')
    expect(html).not.toContain('Permanently 20-40% cheaper')
    expect(html).toContain(
      'Best value for production testing, team workflows, and sustained model traffic.'
    )
    expect(html).toContain(
      'For higher monthly usage, invoicing, team procurement, or custom routing discounts.'
    )
    expect(html).not.toContain('40% OFF')
    expect(html).not.toContain('50% OFF')
    expect(html).not.toContain('40% off')
    expect(html).not.toContain('50% off')
    expect(html).not.toContain('Custom pricing')
    expect(html).not.toContain('Enterprise teams')
    expect(html).not.toContain(
      'Contact sales for higher monthly usage and greater discounts.'
    )
    expect(html).not.toContain('100% OFF')
    expect(html).not.toContain('+5 free bonus')
    expect(html).not.toContain('+100 free bonus')
    expect(html).not.toContain('$10 USD')
    expect(html).not.toContain('$20 USD')
    expect(html).not.toContain('$200 USD')
    expect(html).not.toContain('Add Funds')
    expect(html).not.toContain('Choose an amount and payment method')
    expect(html).not.toContain('Need company invoice')
    expect(html).not.toContain('Order History')
    expect(html).not.toContain('Waffo Pix')
  })

  test('does not render redemption code entry on the wallet top-up card', () => {
    const html = renderToStaticMarkup(
      <RechargeFormCard
        topupInfo={{
          ...topupInfoWithStripe,
          enable_redemption: true,
          amount_options: [10, 20, 200],
          topup_link: 'https://example.com/redeem',
        }}
        presetAmounts={[{ value: 10 }, { value: 20 }, { value: 200 }]}
        selectedPreset={null}
        onSelectPreset={() => undefined}
        onStripeTopUp={() => undefined}
        paymentLoadingAmount={null}
      />
    )

    expect(html).not.toContain('Have a Code?')
    expect(html).not.toContain('Enter your redemption code')
    expect(html).not.toContain('Need a redemption code?')
    expect(html).not.toContain('Redeem')
    expect(html).not.toContain('https://example.com/redeem')
  })

  test('renders only checkout packages configured by the backend presets', () => {
    const html = renderToStaticMarkup(
      <RechargeFormCard
        topupInfo={{
          ...topupInfoWithStripe,
          amount_options: [20, 50],
        }}
        presetAmounts={[{ value: 20 }, { value: 50, bonus: 10 }]}
        selectedPreset={null}
        onSelectPreset={() => undefined}
        onStripeTopUp={() => undefined}
        paymentLoadingAmount={null}
      />
    )

    expect(html).not.toContain('Top up for $10')
    expect(html).toContain('Top up for $20')
    expect(html).toContain('Top up for $50')
    expect(html).not.toContain('Top up for $200')
    expect(html).toContain('Get $10 free')
  })

  test('renders the website-style enterprise sales inquiry form content', () => {
    const html = renderToStaticMarkup(<WalletEnterpriseContactContent />)

    expect(html).toContain('Enterprise sales inquiry form')
    expect(html).toContain('https://tally.so/embed/')
    expect(html).toContain('For higher monthly usage')
    expect(html).not.toContain('mailto:support@flatkey.ai')
  })
})

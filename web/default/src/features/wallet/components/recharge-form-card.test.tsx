import { beforeAll, describe, expect, test } from 'bun:test'
import i18n from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { initReactI18next } from 'react-i18next'
import type { RecallOfferView, TopupInfo } from '../types'
import { RechargeFormCard } from './recharge-form-card'

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

const brlRecallOffer: RecallOfferView = {
  campaign_id: 1,
  recipient_id: 2,
  issued_at: 1_700_000_000,
  campaign_name: 'Come back',
  promotion_code_masked: 'FKSE****34',
  expires_at: 4_100_000_000,
  discount: {
    type: 'fixed',
    percent_off: 0,
    amount_off: 0,
    currency: 'USD',
    currency_options: { BRL: 200 },
    minimum_amount: 0,
    minimum_amount_currency: '',
    coupon_redeem_by: 4_100_000_000,
  },
  products: {
    topup_price_ids: ['price_topup_10'],
    subscription_price_ids: [],
    subscription_plan_ids: [],
  },
  redeemed: false,
}

describe('RechargeFormCard', () => {
  beforeAll(async () => {
    await i18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      resources: {
        en: {
          translation: {
            'Top up {{amount}}': 'Top up {{amount}}',
          },
        },
      },
      interpolation: { escapeValue: false },
    })
  })

  test('renders one face-value top-up flow without bonus or discount claims', () => {
    const html = renderToStaticMarkup(
      <RechargeFormCard
        topupInfo={topupInfoWithStripe}
        presetAmounts={[
          { value: 10, bonus: 3 },
          { value: 20, bonus: 8 },
          { value: 200, bonus: 100 },
        ]}
        selectedPreset={10}
        onSelectPreset={() => undefined}
        onStripeTopUp={() => undefined}
        paymentLoadingAmount={null}
      />
    )

    expect(html).toContain('Choose an amount')
    expect(html).toContain('$10')
    expect(html).toContain('$20')
    expect(html).toContain('$200')
    expect(html).toContain('Top up $10')
    expect(html).toContain(
      'The amount you pay is added to your balance at face value.'
    )
    expect(html).not.toContain('bonus')
    expect(html).not.toContain('free')
    expect(html).not.toContain('discount')
    expect(html).not.toContain('Enterprise')
  })

  test('renders only amounts supplied by backend presets', () => {
    const html = renderToStaticMarkup(
      <RechargeFormCard
        topupInfo={topupInfoWithStripe}
        presetAmounts={[{ value: 20 }, { value: 50 }]}
        selectedPreset={20}
        onSelectPreset={() => undefined}
        onStripeTopUp={() => undefined}
      />
    )

    expect(html).not.toContain('$10')
    expect(html).toContain('$20')
    expect(html).toContain('$50')
  })

  test('uses checkout currency for both discounted and original recall top-up amounts', () => {
    const html = renderToStaticMarkup(
      <RechargeFormCard
        topupInfo={{
          ...topupInfoWithStripe,
          stripe_price_ids: { 10: 'price_topup_10' },
        }}
        presetAmounts={[{ value: 10 }]}
        selectedPreset={10}
        onSelectPreset={() => undefined}
        onStripeTopUp={() => undefined}
        checkoutCurrency='BRL'
        recallOffers={[brlRecallOffer]}
      />
    )

    expect(html).toContain('R$8')
    expect(html).toContain('R$10')
    expect(html).not.toContain('>$10</span>')
  })
})

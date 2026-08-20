import { beforeAll, describe, expect, mock, test } from 'bun:test'
import i18n from 'i18next'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { initReactI18next } from 'react-i18next'
import type { RecallOfferView, TopupInfo } from '../types'

type ButtonProps = {
  children?: ReactNode
  disabled?: boolean
  onClick?: () => void
}

let latestButtonProps: ButtonProps[] = []

function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return ''
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(nodeText).join('')
  }
  if (typeof node === 'object' && 'props' in node) {
    return nodeText(
      (node as { props?: { children?: ReactNode } }).props?.children
    )
  }
  return ''
}

mock.module('@/components/ui/button', () => ({
  Button: (props: ButtonProps) => {
    latestButtonProps.push(props)
    return <button disabled={props.disabled}>{props.children}</button>
  },
}))

const { RechargeFormCard } = await import('./recharge-form-card')

const topupInfoWithStripe: TopupInfo = {
  enable_online_topup: false,
  enable_stripe_topup: true,
  pay_methods: [{ name: 'Stripe Card', type: 'stripe', min_topup: 1 }],
  min_topup: 1,
  stripe_min_topup: 1,
  amount_options: [],
  stripe_currency_prices: {
    USD: { 10: 1000, 20: 2000, 50: 5000, 200: 20000 },
  },
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

const usdPercentRecallOffer: RecallOfferView = {
  campaign_id: 3,
  recipient_id: 4,
  issued_at: 1_700_000_000,
  campaign_name: 'Welcome back',
  promotion_code_masked: 'FKSE****56',
  expires_at: 4_100_000_000,
  discount: {
    type: 'percent',
    percent_off: 20,
    amount_off: 0,
    currency: 'USD',
    currency_options: {},
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
          translation: {},
        },
      },
      interpolation: { escapeValue: false },
    })
  })

  test('renders Stripe configured prices for the active checkout currency', () => {
    const topupInfo: TopupInfo = {
      ...topupInfoWithStripe,
      stripe_currency_prices: {
        USD: { 20: 2000 },
        BRL: { 20: 9990 },
        JPY: { 20: 3000 },
      },
    }

    expect(
      renderToStaticMarkup(
        <RechargeFormCard
          topupInfo={topupInfo}
          presetAmounts={[{ value: 20 }]}
          selectedPreset={20}
          onSelectPreset={() => undefined}
          onStripeTopUp={() => undefined}
          checkoutCurrency='USD'
        />
      )
    ).toContain('$20')

    expect(
      renderToStaticMarkup(
        <RechargeFormCard
          topupInfo={topupInfo}
          presetAmounts={[{ value: 20 }]}
          selectedPreset={20}
          onSelectPreset={() => undefined}
          onStripeTopUp={() => undefined}
          checkoutCurrency='BRL'
        />
      )
    ).toContain('R$99.9')

    expect(
      renderToStaticMarkup(
        <RechargeFormCard
          topupInfo={topupInfo}
          presetAmounts={[{ value: 20 }]}
          selectedPreset={20}
          onSelectPreset={() => undefined}
          onStripeTopUp={() => undefined}
          checkoutCurrency='JPY'
        />
      )
    ).toContain('¥3,000')
  })

  test('falls back to USD display when BRL is not configured', () => {
    const html = renderToStaticMarkup(
      <RechargeFormCard
        topupInfo={{
          ...topupInfoWithStripe,
          stripe_currency_prices: { USD: { 20: 2000 } },
        }}
        presetAmounts={[{ value: 20 }]}
        selectedPreset={20}
        onSelectPreset={() => undefined}
        onStripeTopUp={() => undefined}
        checkoutCurrency='USD'
      />
    )

    expect(html).toContain('$20')
    expect(html).not.toContain('R$')
  })

  test('submits the preset selected under the checkout currency', () => {
    const submittedPresets: number[] = []
    latestButtonProps = []

    renderToStaticMarkup(
      <RechargeFormCard
        topupInfo={{
          ...topupInfoWithStripe,
          stripe_currency_prices: { BRL: { 20: 9990 } },
        }}
        presetAmounts={[{ value: 20 }]}
        selectedPreset={20}
        onSelectPreset={() => undefined}
        onStripeTopUp={(preset) => submittedPresets.push(preset.value)}
        checkoutCurrency='BRL'
      />
    )

    const continueButton = [...latestButtonProps]
      .reverse()
      .find((props) => nodeText(props.children) === 'Continue to payment')
    continueButton?.onClick?.()

    expect(submittedPresets).toEqual([20])
  })

  test('shows only checkout currency choices with configured prices', () => {
    const html = renderToStaticMarkup(
      <RechargeFormCard
        topupInfo={{
          ...topupInfoWithStripe,
          stripe_currency_prices: {
            USD: { 20: 2000 },
            JPY: { 20: 3000 },
          },
        }}
        presetAmounts={[{ value: 20 }]}
        selectedPreset={20}
        onSelectPreset={() => undefined}
        onStripeTopUp={() => undefined}
        checkoutCurrency='JPY'
        showCurrencySelector
      />
    )

    expect(html).toContain('$ USD')
    expect(html).toContain('¥ JPY')
    expect(html).not.toContain('R$ BRL')
    expect(html).not.toContain('₹ INR')
  })

  test('ignores legacy bonus fields in top-up presets', () => {
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

    expect(html).toContain('$10')
    expect(html).toContain('$20')
    expect(html).toContain('$200')
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
          stripe_currency_prices: { BRL: { 10: 1000 } },
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
    expect(html).toContain('2.00 BRL OFF')
    expect(html).toContain('Save R$2')
    expect(html).not.toContain('>$10</span>')
  })

  test('renders percent recall top-up savings on the selected amount', () => {
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
        recallOffers={[usdPercentRecallOffer]}
      />
    )

    expect(html).toContain('20% OFF')
    expect(html).toContain('$8')
    expect(html).toContain('$10')
    expect(html).toContain('line-through')
    expect(html).toContain('Save $2')
  })

  test('calculates percent recall savings from the configured checkout price', () => {
    const html = renderToStaticMarkup(
      <RechargeFormCard
        topupInfo={{
          ...topupInfoWithStripe,
          stripe_price_ids: { 20: 'price_topup_10' },
          stripe_currency_prices: { BRL: { 20: 9990 } },
        }}
        presetAmounts={[{ value: 20 }]}
        selectedPreset={20}
        onSelectPreset={() => undefined}
        onStripeTopUp={() => undefined}
        checkoutCurrency='BRL'
        recallOffers={[usdPercentRecallOffer]}
      />
    )

    expect(html).toContain('20% OFF')
    expect(html).toContain('R$79.92')
    expect(html).toContain('R$99.9')
    expect(html).toContain('Save R$19.98')
    expect(html).not.toContain('R$16')
    expect(html).not.toContain('R$20')
  })
})

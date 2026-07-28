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
import zh from '@/i18n/locales/zh.json'
import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { readdirSync, readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { RecallClaimProvider } from '@/features/subscriptions/components/dialogs/subscription-purchase-dialog'
import type {
  PlanRecord,
  SubscriptionPaymentQuote,
} from '@/features/subscriptions/types'
import {
  buildFlexiblePurchaseRequest,
  buildFlexibleQuoteRequest,
  getMatchingPaymentQuote,
  mergeFlexibleQuoteProjection,
  normalizePurchaseMonths,
  normalizeSelfSubscriptionData,
  requiresSignedCheckoutQuote,
} from '../lib/subscription-plan-lifecycle'
import type { RecallClaimView, TopupInfo } from '../types'
import { PlanPurchaseDialogContent } from './plan-purchase-dialog'
import { SubscriptionPlansCard } from './subscription-plans-card'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} }, zh },
    interpolation: { escapeValue: false },
  })
})

const topupInfo = {
  enable_online_topup: true,
  enable_stripe_topup: true,
  pay_methods: [],
  min_topup: 1,
  stripe_min_topup: 1,
  amount_options: [],
  discount: {},
  bonus: {},
} satisfies TopupInfo

function plan(id: number, title: string, price: number): PlanRecord {
  return {
    plan: {
      id,
      title,
      price_amount: price,
      currency: 'USD',
      duration_unit: 'month',
      duration_value: 1,
      quota_reset_period: 'monthly',
      enabled: true,
      sort_order: id,
      allow_balance_pay: true,
      max_purchase_per_user: 0,
      total_amount: price * 1000,
      window_5h_amount: price * 100,
      window_week_amount: price * 250,
      media_credits_monthly: price,
      payment_modes: ['stripe_recurring', 'balance_one_period'],
    },
  }
}

const plans = [plan(1, 'Go', 10), plan(2, 'Pro', 20), plan(3, 'Max', 40)]
const TEST_NOW_SECONDS = 4_000_000_000
const VALID_QUOTE_EXPIRES_AT = TEST_NOW_SECONDS + 60

function localPaymentQuote(
  choice: 'pix' | 'upi',
  overrides: Partial<SubscriptionPaymentQuote> = {}
): SubscriptionPaymentQuote {
  const unitPrice = choice === 'pix' ? 100 : 1800
  return {
    currency: choice === 'pix' ? 'BRL' : 'INR',
    months: 3,
    unit_price: unitPrice,
    total: unitPrice * 3,
    quote_id: `quote-${choice}-3`,
    expires_at: VALID_QUOTE_EXPIRES_AT,
    ...overrides,
  }
}

function alipayPaymentQuote(
  overrides: Partial<SubscriptionPaymentQuote> = {}
): SubscriptionPaymentQuote {
  return {
    currency: 'USD',
    months: 3,
    unit_price: 20,
    total: 60,
    quote_id: 'quote-alipay-3',
    expires_at: VALID_QUOTE_EXPIRES_AT,
    ...overrides,
  }
}

function stripePaymentQuote(
  overrides: Partial<SubscriptionPaymentQuote> = {}
): SubscriptionPaymentQuote {
  return {
    currency: 'USD',
    months: 1,
    unit_price: 20,
    total: 20,
    quote_id: 'quote-stripe-1',
    expires_at: VALID_QUOTE_EXPIRES_AT,
    ...overrides,
  }
}

function balancePaymentQuote(
  overrides: Partial<SubscriptionPaymentQuote> = {}
): SubscriptionPaymentQuote {
  return {
    currency: 'USD',
    months: 3,
    unit_price: 100,
    total: 300,
    quote_id: 'quote-balance-3',
    expires_at: VALID_QUOTE_EXPIRES_AT,
    ...overrides,
  }
}

function matchLocalPaymentQuote(
  choice: 'pix' | 'upi',
  quote: SubscriptionPaymentQuote
) {
  return getMatchingPaymentQuote(
    choice,
    { [choice]: quote },
    3,
    TEST_NOW_SECONDS
  )
}

function renderWalletCard(selfData = normalizeSelfSubscriptionData(undefined)) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <SubscriptionPlansCard
        topupInfo={topupInfo}
        initialPlans={plans}
        initialSelfData={selfData}
        initialLoading={false}
        userQuota={12345}
      />
    </I18nextProvider>
  )
}

const subscriptionRecallClaim: RecallClaimView = {
  campaign_id: 17,
  recipient_id: 29,
  campaign_name: 'Come back offer',
  promotion_code_masked: 'FKSE****34',
  expires_at: 4_100_000_000,
  discount: {
    type: 'percent',
    percent_off: 20,
    amount_off: 0,
    currency: '',
    minimum_amount: 0,
    minimum_amount_currency: '',
    coupon_redeem_by: 4_100_000_000,
  },
  products: {
    topup_price_ids: [],
    subscription_price_ids: ['price_go'],
    subscription_plan_ids: [1],
  },
  redeemed: false,
}

function renderWalletCardWithRecall(
  recallView: RecallClaimView = subscriptionRecallClaim
) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <RecallClaimProvider claim='signed-recall-claim' view={recallView}>
        <SubscriptionPlansCard
          topupInfo={topupInfo}
          initialPlans={plans}
          initialSelfData={normalizeSelfSubscriptionData(undefined)}
          initialLoading={false}
          userQuota={12345}
        />
      </RecallClaimProvider>
    </I18nextProvider>
  )
}

describe('SubscriptionPlansCard flexible wallet plan UI', () => {
  test('hides the current plan module when there is no active plan and shows Go Pro Max first', () => {
    const html = renderWalletCard()

    expect(html).not.toContain('Current subscription')
    expect(html).not.toContain('No active plan')
    expect(html).not.toContain('Choose a plan now')
    expect(html.indexOf('Go')).toBeLessThan(html.indexOf('Pro'))
    expect(html.indexOf('Pro')).toBeLessThan(html.indexOf('Max'))
    expect(html).toContain('Buy now')
  })

  test('shows localized plan positioning and recommends Go only', async () => {
    await testI18n.changeLanguage('zh')
    try {
      const html = renderWalletCard()
      const goStart = html.indexOf('Go')
      const proStart = html.indexOf('Pro')
      const maxStart = html.indexOf('Max')

      expect(html).toContain('适合个人与轻量日常使用')
      expect(html).toContain('适合日常开发与高频请求')
      expect(html).toContain('适合团队与高强度任务')
      expect(goStart).toBeGreaterThanOrEqual(0)
      expect(proStart).toBeGreaterThan(goStart)
      expect(maxStart).toBeGreaterThan(proStart)
      expect(html.slice(goStart, proStart)).toContain('推荐')
      expect(html.slice(proStart, maxStart)).not.toContain('推荐')
      expect(html.match(/推荐/g)?.length).toBe(1)
    } finally {
      await testI18n.changeLanguage('en')
    }
  })

  test('keeps the Go recommendation badge visible when there is an active plan', () => {
    const html = renderWalletCard(
      normalizeSelfSubscriptionData({
        contract: {
          contract_id: 14,
          id: 14,
          status: 'active',
          payment_mode: 'prepaid',
          current_plan_id: 2,
          current_entitlement_id: 20,
          current_provider_binding_id: 0,
          latest_change_intent_id: 0,
          pending_plan_id: 0,
          pending_effective_at: 0,
          current_period_start: 1717200000,
          current_period_end: 1719792000,
          grace_period_end: 0,
          change_version: 1,
        },
      })
    )
    const goStart = html.indexOf('Go')
    const proStart = html.indexOf('Pro', goStart)
    const maxStart = html.indexOf('Max', proStart)

    expect(goStart).toBeGreaterThanOrEqual(0)
    expect(proStart).toBeGreaterThan(goStart)
    expect(maxStart).toBeGreaterThan(proStart)
    expect(html.slice(goStart, proStart)).toContain('Recommended')
    expect(html.slice(proStart, maxStart)).not.toContain('Recommended')
    expect(html.match(/Recommended/g)?.length).toBe(1)
  })

  test('keeps the refresh control in the subscription card header action', () => {
    const html = renderWalletCard()
    const headerStart = html.indexOf('data-slot="card-header"')
    const contentStart = html.indexOf('data-slot="card-content"', headerStart)
    const refreshButton = html.indexOf(
      'aria-label="Refresh subscription plans"'
    )

    expect(headerStart).toBeGreaterThanOrEqual(0)
    expect(contentStart).toBeGreaterThan(headerStart)
    expect(refreshButton).toBeGreaterThan(headerStart)
    expect(refreshButton).toBeLessThan(contentStart)
    expect(html).toContain('size-7')
    expect(html).not.toContain('min-h-11 min-w-11')
  })

  test('renders a read-only current card with correct badges and only the three active usage meters', () => {
    const html = renderWalletCard(
      normalizeSelfSubscriptionData({
        contract: {
          contract_id: 9,
          id: 9,
          status: 'active',
          payment_mode: 'prepaid',
          current_plan_id: 2,
          current_entitlement_id: 20,
          current_provider_binding_id: 0,
          latest_change_intent_id: 0,
          pending_plan_id: 0,
          pending_effective_at: 0,
          current_period_start: 1717200000,
          current_period_end: 1719792000,
          grace_period_end: 0,
          change_version: 1,
        },
        renewal_source: 'wallet_auto',
        renewal_status: 'enabled',
        capabilities: {
          can_cancel: true,
          requires_support: false,
        },
        current_entitlement: {
          entitlement_id: 20,
          plan_id: 2,
          provider_binding_id: 0,
          status: 'active',
          payment_mode: 'balance_one_period',
          start_time: 1717200000,
          end_time: 1719792000,
          access_end_time: 1719792000,
        },
        quota: {
          amount_total: 20000,
          amount_used: 7000,
          amount_remaining: 13000,
          unlimited: false,
        },
        window_5h: { used: 200, total: 2000, remaining: 1800, reset_at: 1 },
        window_7d: { used: 1000, total: 5000, remaining: 4000, reset_at: 1 },
        media_credits: { used: 3, total: 20, remaining: 17, reset_at: 1 },
      })
    )

    expect(html).toContain('Current plan')
    expect(html).toContain('Pro')
    expect(html).toContain('Active')
    expect(html).toContain('Auto-renew on')
    expect(html).not.toContain('Auto-renew enabled')
    expect(html).not.toContain('Renewal time')
    expect(html).not.toContain('future charge')
    expect(html.match(/data-wallet-usage-meter=/g)?.length).toBe(3)
    expect(html.match(/data-wallet-secondary-meter=/g)?.length).toBe(3)
    expect(html).not.toContain('data-wallet-usage-meter="Monthly model quota"')
    expect(html).toContain('data-wallet-usage-meter="5-hour limit"')
    expect(html).toContain('data-wallet-usage-meter="7-day limit"')
    expect(html).toContain('data-wallet-usage-meter="Media generation credits"')
    expect(html).toContain('$0.0004 / $0.004 used')
    expect(html).toContain('$0.002 / $0.01 used')
    expect(html).toContain('3 / 20 used')
    expect(html).not.toContain('Cancel auto-renewal')
    expect(html).not.toContain('Resume auto-renewal')
    expect(html).not.toContain('Manage')
    expect(html).not.toContain('Renewal time')
  })

  test('does not show the Flatkey wallet auto-renew badge for provider recurring contracts', () => {
    const html = renderWalletCard(
      normalizeSelfSubscriptionData({
        contract: {
          contract_id: 10,
          id: 10,
          status: 'active',
          payment_mode: 'stripe_recurring',
          current_plan_id: 2,
          current_entitlement_id: 20,
          current_provider_binding_id: 88,
          latest_change_intent_id: 0,
          pending_plan_id: 0,
          pending_effective_at: 0,
          current_period_start: 1717200000,
          current_period_end: 1719792000,
          grace_period_end: 0,
          change_version: 1,
        },
        renewal_source: 'provider_recurring',
        renewal_status: 'enabled',
      })
    )

    expect(html).toContain('Active')
    expect(html).not.toContain('Auto-renew enabled')
    expect(html).not.toContain('Auto-renew on')
  })

  test('renders Chinese remaining days without a replacement question mark', async () => {
    await testI18n.changeLanguage('zh')
    try {
      const html = renderWalletCard(
        normalizeSelfSubscriptionData({
          contract: {
            contract_id: 13,
            id: 13,
            status: 'active',
            payment_mode: 'prepaid',
            current_plan_id: 2,
            current_entitlement_id: 20,
            current_provider_binding_id: 0,
            latest_change_intent_id: 0,
            pending_plan_id: 0,
            pending_effective_at: 0,
            current_period_start: 1717200000,
            current_period_end: 1719792000,
            grace_period_end: 0,
            change_version: 1,
          },
          remaining_days: 31,
        })
      )

      expect(html).toContain('31 天')
      expect(html).not.toContain('31 ?')
    } finally {
      await testI18n.changeLanguage('en')
    }
  })

  test('renders zero media credits as not included instead of unlimited', () => {
    const html = renderWalletCard(
      normalizeSelfSubscriptionData({
        contract: {
          contract_id: 11,
          id: 11,
          status: 'active',
          payment_mode: 'prepaid',
          current_plan_id: 2,
          current_entitlement_id: 20,
          current_provider_binding_id: 0,
          latest_change_intent_id: 0,
          pending_plan_id: 0,
          pending_effective_at: 0,
          current_period_start: 1717200000,
          current_period_end: 1719792000,
          grace_period_end: 0,
          change_version: 1,
        },
        media_credits: {
          used: 0,
          total: 0,
          remaining: 0,
          reset_at: 0,
          unlimited: false,
        },
      })
    )

    expect(html).toContain('Not included')
    expect(html).toContain('0 remaining')
  })

  test('defaults absent current media credits to not included while keeping rolling windows unlimited', () => {
    const html = renderWalletCard(
      normalizeSelfSubscriptionData({
        contract: {
          contract_id: 12,
          id: 12,
          status: 'active',
          payment_mode: 'prepaid',
          current_plan_id: 2,
          current_entitlement_id: 20,
          current_provider_binding_id: 0,
          latest_change_intent_id: 0,
          pending_plan_id: 0,
          pending_effective_at: 0,
          current_period_start: 1717200000,
          current_period_end: 1719792000,
          grace_period_end: 0,
          change_version: 1,
        },
      })
    )
    const mediaMeterStart = html.indexOf(
      'data-wallet-usage-meter="Media generation credits"'
    )
    const mediaMeter = html.slice(mediaMeterStart, mediaMeterStart + 900)

    expect(mediaMeter).toContain('Not included')
    expect(mediaMeter).not.toContain('Unlimited')
    expect(html).toContain('data-wallet-usage-meter="5-hour limit"')
    expect(html).toContain('No usage limit')
  })

  test('shows not included for zero media credits on plan cards', () => {
    const noMediaPlan = {
      ...plans[0],
      plan: {
        ...plans[0].plan,
        media_credits_monthly: 0,
      },
    }
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <SubscriptionPlansCard
          topupInfo={topupInfo}
          initialPlans={[noMediaPlan]}
          initialSelfData={normalizeSelfSubscriptionData(undefined)}
          initialLoading={false}
          userQuota={12345}
        />
      </I18nextProvider>
    )

    expect(html).toContain('Media generation credits: Not included')
    expect(html).not.toContain('Media generation credits: Unlimited')
  })

  test('labels plan card rolling quotas and media credits explicitly', () => {
    const html = renderWalletCard()

    expect(html).toContain('5-hour limit: $0.002')
    expect(html).toContain('7-day limit: $0.005')
    expect(html).toContain('Media generation credits: 10 credits')
    expect(html).not.toContain('5-hour: $0.002')
    expect(html).not.toContain('7-day: $0.005')
    expect(html).not.toContain('Image + video: 10 credits')
  })

  test('keeps media generation credits visible when the plan field is absent', () => {
    const { media_credits_monthly: _media, ...planWithoutMedia } = plans[0].plan
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <SubscriptionPlansCard
          topupInfo={topupInfo}
          initialPlans={[{ ...plans[0], plan: planWithoutMedia }]}
          initialSelfData={normalizeSelfSubscriptionData(undefined)}
          initialLoading={false}
          userQuota={12345}
        />
      </I18nextProvider>
    )

    expect(html).toContain('Media generation credits: Not included')
    expect(html).not.toContain('Image + video: Not included')
  })

  test('labels the current stripe-recurring plan as current subscription and switch for every other active plan without next-period copy', () => {
    const html = renderWalletCard(
      normalizeSelfSubscriptionData({
        contract: {
          contract_id: 10,
          id: 10,
          status: 'active',
          payment_mode: 'stripe_recurring',
          current_plan_id: 2,
          current_entitlement_id: 20,
          current_provider_binding_id: 88,
          latest_change_intent_id: 0,
          pending_plan_id: 0,
          pending_effective_at: 0,
          current_period_start: 1717200000,
          current_period_end: 1719792000,
          grace_period_end: 0,
          change_version: 1,
        },
      })
    )

    // A live Stripe recurring subscription renews itself: its own card must
    // read as the current subscription, not prompt the buyer to repurchase.
    expect(html).toContain('Current subscription')
    expect(html).not.toContain('Repurchase now')
    expect(html.match(/Switch now/g)?.length).toBe(2)
    expect(html).not.toContain('Downgrade next period')
    expect(html).not.toContain('next period')
  })

  test('does not locally discount plan card prices for recall offers', () => {
    const html = renderWalletCardWithRecall()
    const goStart = html.indexOf('Go')
    const proStart = html.indexOf('Pro', goStart)
    const maxStart = html.indexOf('Max', proStart)
    const goSlice = html.slice(goStart, proStart)
    const proSlice = html.slice(proStart, maxStart)
    const maxSlice = html.slice(maxStart)

    expect(goSlice).toContain('$10')
    expect(goSlice).not.toContain('20% OFF')
    expect(goSlice).not.toContain('line-through')
    expect(goSlice).not.toContain('$8')
    expect(proSlice).not.toContain('20% OFF')
    expect(maxSlice).not.toContain('20% OFF')
  })

  test('does not locally render fixed recall discount labels on plan cards', () => {
    const html = renderWalletCardWithRecall({
      ...subscriptionRecallClaim,
      discount: {
        ...subscriptionRecallClaim.discount,
        type: 'fixed',
        percent_off: 0,
        amount_off: 200,
        currency: 'USD',
      },
    })

    expect(html).not.toContain('2.00 USD OFF')
    expect(html).not.toContain('$2 USD OFF')
  })
})

describe('PlanPurchaseDialog payment choices', () => {
  test('wraps the purchase review in the shared Dialog modal surface', () => {
    const source = readFileSync(
      new URL('./plan-purchase-dialog.tsx', import.meta.url),
      'utf8'
    ).replace(/\r\n/g, '\n')

    expect(source).toContain(
      "import {\n  Dialog,\n  DialogContent,\n  DialogDescription,\n  DialogFooter,\n  DialogHeader,\n  DialogTitle,\n} from '@/components/ui/dialog'"
    )
    expect(source).toContain(
      '<Dialog open={props.open} onOpenChange={props.onOpenChange}>'
    )
    expect(source).toContain(
      "<DialogContent className='sm:max-w-xl' showCloseButton={false}>"
    )
  })

  test('defaults to Stripe recurring and hides the month selector', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <PlanPurchaseDialogContent
          plan={plans[1]}
          currentPlanId={0}
          paymentAvailability={{}}
          selectedPaymentChoice='stripe_recurring'
          months={1}
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).toContain('Stripe automatic subscription')
    expect(html.indexOf('Stripe automatic subscription')).toBeLessThan(
      html.indexOf('Alipay')
    )
    expect(html.indexOf('Alipay')).toBeLessThan(html.indexOf('Pix'))
    expect(html.indexOf('Pix')).toBeLessThan(html.indexOf('UPI'))
    expect(html.indexOf('UPI')).toBeLessThan(html.indexOf('Flatkey balance'))
    expect(html).not.toContain('1 month')
    expect(html).not.toContain('12 months')
  })

  test('reveals a direct month input with common shortcuts for one-time payment choices', () => {
    for (const selectedPaymentChoice of [
      'alipay',
      'pix',
      'upi',
      'balance',
    ] as const) {
      const html = renderToStaticMarkup(
        <I18nextProvider i18n={testI18n}>
          <PlanPurchaseDialogContent
            plan={plans[1]}
            currentPlanId={2}
            paymentAvailability={{}}
            selectedPaymentChoice={selectedPaymentChoice}
            months={6}
            onOpenChange={() => undefined}
            onConfirm={() => undefined}
          />
        </I18nextProvider>
      )

      expect(html).toContain('1 month')
      expect(html).toContain('3 months')
      expect(html).toContain('12 months')
      expect(html).toContain('type="number"')
      expect(html).toContain('min="1"')
      expect(html).toContain('max="12"')
      expect(html).not.toContain('<select')
      expect(html).toContain('No prorating or credit is applied.')
      expect(html).not.toContain('future months')
    }
  })

  test('normalizes purchase months to whole months between 1 and 12', () => {
    expect(normalizePurchaseMonths('')).toBe(1)
    expect(normalizePurchaseMonths('0')).toBe(1)
    expect(normalizePurchaseMonths('-2')).toBe(1)
    expect(normalizePurchaseMonths('2.5')).toBe(2)
    expect(normalizePurchaseMonths('13')).toBe(12)
    expect(normalizePurchaseMonths(12)).toBe(12)
  })

  test('does not render future-month refund value in the purchase review', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <PlanPurchaseDialogContent
          plan={plans[1]}
          currentPlanId={2}
          paymentAvailability={{}}
          selectedPaymentChoice='balance'
          months={3}
          refundableNotStartedValue={12345}
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).not.toContain('Refundable not-started value')
    expect(html).not.toContain('12,345')
  })

  test('uses backend quote snapshots for Pix BRL and UPI INR display amounts', () => {
    const pixHtml = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <PlanPurchaseDialogContent
          plan={plans[1]}
          currentPlanId={0}
          paymentAvailability={{}}
          paymentQuotes={{
            pix: {
              currency: 'BRL',
              months: 3,
              unit_price: 1234.56,
              total: 3703.68,
              quote_id: 'quote-pix-3',
              expires_at: VALID_QUOTE_EXPIRES_AT,
            },
            upi: {
              currency: 'INR',
              months: 3,
              unit_price: 1800,
              total: 5400,
              quote_id: 'quote-upi-3',
              expires_at: VALID_QUOTE_EXPIRES_AT,
            },
          }}
          selectedPaymentChoice='pix'
          months={3}
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
        />
      </I18nextProvider>
    )
    const upiHtml = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <PlanPurchaseDialogContent
          plan={plans[1]}
          currentPlanId={0}
          paymentAvailability={{}}
          paymentQuotes={{
            pix: {
              currency: 'BRL',
              months: 3,
              unit_price: 1234.56,
              total: 3703.68,
              quote_id: 'quote-pix-3',
              expires_at: VALID_QUOTE_EXPIRES_AT,
            },
            upi: {
              currency: 'INR',
              months: 3,
              unit_price: 1800,
              total: 5400,
              quote_id: 'quote-upi-3',
              expires_at: VALID_QUOTE_EXPIRES_AT,
            },
          }}
          selectedPaymentChoice='upi'
          months={3}
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
        />
      </I18nextProvider>
    )

    expect(pixHtml).toContain('Unit price')
    expect(pixHtml).toContain('R$')
    expect(pixHtml).toContain('1.234,56')
    expect(pixHtml).toContain('3.703,68')
    expect(upiHtml).toContain('Unit price')
    expect(upiHtml).toContain('₹1,800.00')
    expect(upiHtml).toContain('₹5,400.00')
    expect(pixHtml).not.toContain('$60')
    expect(upiHtml).not.toContain('$60')
  })

  test('keeps Pix selectable when a quote is missing and disables only Continue', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <PlanPurchaseDialogContent
          plan={plans[1]}
          currentPlanId={0}
          paymentAvailability={{}}
          paymentQuotes={{}}
          selectedPaymentChoice='pix'
          months={3}
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).toContain('Payment quote is unavailable.')
    expect(html).not.toContain('$60')
    expect(html).toContain('checked="" value="pix"')
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('checked="" disabled="" value="pix"')
  })

  test('shows local quote loading while keeping the selected choice active', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <PlanPurchaseDialogContent
          plan={plans[1]}
          currentPlanId={0}
          paymentAvailability={{}}
          paymentQuotes={{}}
          selectedPaymentChoice='upi'
          months={2}
          isQuoteLoading
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).toContain('Loading payment quote...')
    expect(html).not.toContain('$40')
    expect(html).toContain('checked="" value="upi"')
  })

  test('requires a valid signed Alipay quote before showing quote totals', () => {
    const invalidQuotes = [
      { name: 'missing quote', quote: undefined },
      {
        name: 'blank signed quote token',
        quote: alipayPaymentQuote({ quote_id: '   ' }),
      },
      {
        name: 'expired quote',
        quote: alipayPaymentQuote({ expires_at: 1 }),
      },
      {
        name: 'quote for different months',
        quote: alipayPaymentQuote({ months: 2 }),
      },
    ]

    for (const { name, quote } of invalidQuotes) {
      const html = renderToStaticMarkup(
        <I18nextProvider i18n={testI18n}>
          <PlanPurchaseDialogContent
            plan={plans[1]}
            currentPlanId={0}
            paymentAvailability={{}}
            paymentQuotes={quote ? { alipay: quote } : {}}
            selectedPaymentChoice='alipay'
            months={3}
            onOpenChange={() => undefined}
            onConfirm={() => undefined}
          />
        </I18nextProvider>
      )

      expect(html, name).toContain('Payment quote is unavailable.')
      expect(html, name).not.toContain('$60')
      expect(html, name).toMatch(
        /<button[^>]*disabled=""[^>]*>Continue<\/button>/
      )
    }
  })

  test('enables Alipay checkout for a future signed same-month quote', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <PlanPurchaseDialogContent
          plan={plans[1]}
          currentPlanId={0}
          paymentAvailability={{}}
          paymentQuotes={{ alipay: alipayPaymentQuote() }}
          selectedPaymentChoice='alipay'
          months={3}
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
        />
      </I18nextProvider>
    )
    const continueButton = html.match(/<button[^>]*>Continue<\/button>/)?.[0]

    expect(html).toContain('$60')
    expect(continueButton).toBeDefined()
    expect(continueButton).not.toContain('disabled=""')
  })

  test('requires a valid signed Stripe recurring quote before continuing', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <PlanPurchaseDialogContent
          plan={plans[1]}
          currentPlanId={0}
          paymentAvailability={{}}
          paymentQuotes={{}}
          selectedPaymentChoice='stripe_recurring'
          months={1}
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
        />
      </I18nextProvider>
    )
    const continueButton = html.match(/<button[^>]*>Continue<\/button>/)?.[0]

    expect(html).toContain('Payment quote is unavailable.')
    expect(html).not.toContain('$20')
    expect(continueButton).toBeDefined()
    expect(continueButton).toContain('disabled=""')
  })

  test('enables Stripe recurring checkout for a future signed quote', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <PlanPurchaseDialogContent
          plan={plans[1]}
          currentPlanId={0}
          paymentAvailability={{}}
          paymentQuotes={{ stripe_recurring: stripePaymentQuote() }}
          selectedPaymentChoice='stripe_recurring'
          months={1}
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
        />
      </I18nextProvider>
    )
    const continueButton = html.match(/<button[^>]*>Continue<\/button>/)?.[0]

    expect(html).toContain('$20')
    expect(continueButton).toBeDefined()
    expect(continueButton).not.toContain('disabled=""')
  })

  test('requires a valid signed balance quote before purchase', () => {
    for (const { name, quote } of [
      { name: 'missing quote', quote: undefined },
      {
        name: 'blank signed quote token',
        quote: balancePaymentQuote({ quote_id: '   ' }),
      },
      {
        name: 'expired quote',
        quote: balancePaymentQuote({ expires_at: 1 }),
      },
      {
        name: 'quote for different months',
        quote: balancePaymentQuote({ months: 2 }),
      },
    ]) {
      const html = renderToStaticMarkup(
        <I18nextProvider i18n={testI18n}>
          <PlanPurchaseDialogContent
            plan={plans[1]}
            currentPlanId={0}
            paymentAvailability={{}}
            paymentQuotes={quote ? { balance: quote } : {}}
            selectedPaymentChoice='balance'
            months={3}
            onOpenChange={() => undefined}
            onConfirm={() => undefined}
          />
        </I18nextProvider>
      )

      expect(html, name).toContain('Payment quote is unavailable.')
      expect(html, name).not.toContain('$60')
      expect(html, name).toMatch(
        /<button[^>]*disabled=""[^>]*>Continue<\/button>/
      )
    }
  })

  test('shows backend quote discount totals for Pix and Balance without changing unit price', () => {
    for (const [choice, quote] of [
      [
        'pix',
        localPaymentQuote('pix', {
          unit_price: 100,
          original_total: 300,
          discount_amount: 20,
          total: 280,
        }),
      ],
      [
        'balance',
        balancePaymentQuote({
          unit_price: 100,
          original_total: 300,
          discount_amount: 20,
          total: 280,
        }),
      ],
    ] as const) {
      const html = renderToStaticMarkup(
        <I18nextProvider i18n={testI18n}>
          <PlanPurchaseDialogContent
            plan={plans[1]}
            currentPlanId={0}
            paymentAvailability={{}}
            paymentQuotes={{ [choice]: quote }}
            selectedPaymentChoice={choice}
            months={3}
            onOpenChange={() => undefined}
            onConfirm={() => undefined}
          />
        </I18nextProvider>
      )

      expect(html, choice).toContain('Original plan total')
      expect(html, choice).toContain('Final amount')
      expect(html, choice).toContain(choice === 'pix' ? '300,00' : '$300')
      expect(html, choice).toContain(choice === 'pix' ? '280,00' : '$280')
      expect(html, choice).toContain(choice === 'pix' ? '100,00' : '$100')
    }
  })

  test('shows invitation discount quote details exactly as returned by the backend', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <PlanPurchaseDialogContent
          plan={plans[1]}
          currentPlanId={0}
          paymentAvailability={{}}
          paymentQuotes={{
            balance: balancePaymentQuote({
              unit_price: 20,
              original_total: 60,
              discount_kind: 'invitation',
              discount_amount: 15,
              invitation_available_usd: 50,
              invitation_discount_usd: 15,
              invitation_discount_amount: 15,
              invitation_remaining_usd: 35,
              total: 45,
            }),
          }}
          selectedPaymentChoice='balance'
          months={3}
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).toContain('Original plan total')
    expect(html).toContain('$60')
    expect(html).toContain('Invitation plan credit')
    expect(html).toContain('$15')
    expect(html).toContain('Final amount')
    expect(html).toContain('$45')
    expect(html).toContain('Estimated remaining invitation plan credit')
    expect(html).toContain('$35')
  })

  test('shows the winning non-invitation discount and states invitation credit is not consumed', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <PlanPurchaseDialogContent
          plan={plans[1]}
          currentPlanId={0}
          paymentAvailability={{}}
          paymentQuotes={{
            balance: balancePaymentQuote({
              unit_price: 20,
              original_total: 60,
              discount_kind: 'recall',
              discount_amount: 20,
              invitation_available_usd: 50,
              invitation_discount_usd: 15,
              invitation_discount_amount: 15,
              invitation_remaining_usd: 50,
              other_discount_kind: 'recall',
              other_discount_amount: 20,
              total: 40,
            }),
          }}
          selectedPaymentChoice='balance'
          months={3}
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).toContain('Original plan total')
    expect(html).toContain('$60')
    expect(html).toContain('Other discount')
    expect(html).toContain('$20')
    expect(html).toContain('Final amount')
    expect(html).toContain('$40')
    expect(html).toContain('Invitation credit was not consumed.')
    expect(html).toContain('Estimated remaining invitation plan credit')
    expect(html).toContain('$50')
  })

  test('does not strike through totals for undiscounted quotes', () => {
    for (const quote of [
      balancePaymentQuote({
        original_total: 300,
        discount_amount: 0,
        total: 300,
      }),
      balancePaymentQuote({
        original_total: 300,
        discount_amount: 20,
        total: 300,
      }),
    ]) {
      const html = renderToStaticMarkup(
        <I18nextProvider i18n={testI18n}>
          <PlanPurchaseDialogContent
            plan={plans[1]}
            currentPlanId={0}
            paymentAvailability={{}}
            paymentQuotes={{ balance: quote }}
            selectedPaymentChoice='balance'
            months={3}
            onOpenChange={() => undefined}
            onConfirm={() => undefined}
          />
        </I18nextProvider>
      )

      expect(html).toContain('$300')
      expect(html).not.toContain('line-through')
    }
  })

  test('does not keep a local recall discount pricing path in the purchase dialog', () => {
    const source = readFileSync(
      new URL('./plan-purchase-dialog.tsx', import.meta.url),
      'utf8'
    )

    expect(source).not.toContain('recallDiscount?:')
    expect(source).not.toContain('stripeRecallDiscount')
  })

  test('treats invalid local quotes as unavailable without a USD fallback', () => {
    const { quote_id: _quoteId, ...pixWithoutToken } = localPaymentQuote('pix')
    const invalidQuotes = [
      {
        name: 'Pix with the wrong currency',
        choice: 'pix' as const,
        quote: localPaymentQuote('pix', { currency: 'INR' }),
      },
      {
        name: 'UPI with the wrong currency',
        choice: 'upi' as const,
        quote: localPaymentQuote('upi', { currency: 'BRL' }),
      },
      {
        name: 'Pix without a signed quote token',
        choice: 'pix' as const,
        quote: pixWithoutToken,
      },
      {
        name: 'UPI with a blank signed quote token',
        choice: 'upi' as const,
        quote: localPaymentQuote('upi', { quote_id: '   ' }),
      },
      {
        name: 'UPI with an expired same-month quote',
        choice: 'upi' as const,
        quote: localPaymentQuote('upi', { expires_at: 1 }),
      },
      {
        name: 'Pix with a quote for different months',
        choice: 'pix' as const,
        quote: localPaymentQuote('pix', { months: 2 }),
      },
    ]

    for (const { name, choice, quote } of invalidQuotes) {
      const html = renderToStaticMarkup(
        <I18nextProvider i18n={testI18n}>
          <PlanPurchaseDialogContent
            plan={plans[1]}
            currentPlanId={0}
            paymentAvailability={{}}
            paymentQuotes={{ [choice]: quote }}
            selectedPaymentChoice={choice}
            months={3}
            onOpenChange={() => undefined}
            onConfirm={() => undefined}
          />
        </I18nextProvider>
      )

      expect(html, name).toContain('Payment quote is unavailable.')
      expect(html, name).not.toContain('$60')
      expect(html, name).toMatch(
        /<button[^>]*disabled=""[^>]*>Continue<\/button>/
      )
    }
  })
})

describe('flexible payment quote interaction helpers', () => {
  test('requests embedded checkout for hosted subscription payment choices only', () => {
    expect(
      buildFlexiblePurchaseRequest({
        planId: 2,
        paymentChoice: 'stripe_recurring',
        months: 1,
        requestId: 'request-1',
        quoteId: 'quote-stripe-1',
      }).ui_mode
    ).toBe('embedded')
    expect(
      buildFlexiblePurchaseRequest({
        planId: 2,
        paymentChoice: 'alipay',
        months: 3,
        requestId: 'request-1',
        quoteId: 'quote-alipay-3',
      }).ui_mode
    ).toBe('embedded')
    expect(
      buildFlexiblePurchaseRequest({
        planId: 2,
        paymentChoice: 'pix',
        months: 3,
        requestId: 'request-1',
        quoteId: 'quote-pix-3',
      }).ui_mode
    ).toBe('embedded')
    expect(
      buildFlexiblePurchaseRequest({
        planId: 2,
        paymentChoice: 'upi',
        months: 3,
        requestId: 'request-1',
        quoteId: 'quote-upi-3',
      }).ui_mode
    ).toBe('embedded')
    expect(
      buildFlexiblePurchaseRequest({
        planId: 2,
        paymentChoice: 'balance',
        months: 3,
        requestId: 'request-1',
        quoteId: 'quote-balance-3',
      })
    ).not.toHaveProperty('ui_mode')
  })

  test('purchase requests fail closed without a signed quote for every payment choice', () => {
    for (const paymentChoice of [
      'stripe_recurring',
      'alipay',
      'pix',
      'upi',
      'balance',
    ] as const) {
      expect(() =>
        buildFlexiblePurchaseRequest({
          planId: 2,
          paymentChoice,
          months: 3,
          requestId: `missing-${paymentChoice}-quote`,
        })
      ).toThrow('quote_id is required')
    }
  })

  test('requires signed checkout quotes for every purchase choice', () => {
    expect(requiresSignedCheckoutQuote('alipay')).toBe(true)
    expect(requiresSignedCheckoutQuote('pix')).toBe(true)
    expect(requiresSignedCheckoutQuote('upi')).toBe(true)
    expect(requiresSignedCheckoutQuote('balance')).toBe(true)
    expect(requiresSignedCheckoutQuote('stripe_recurring')).toBe(true)
  })

  test('accepts only future signed same-month Stripe recurring quotes', () => {
    expect(
      getMatchingPaymentQuote(
        'stripe_recurring',
        { stripe_recurring: stripePaymentQuote({ quote_id: '   ' }) },
        1,
        TEST_NOW_SECONDS
      )
    ).toBeUndefined()
    expect(
      getMatchingPaymentQuote(
        'stripe_recurring',
        {
          stripe_recurring: stripePaymentQuote({
            expires_at: TEST_NOW_SECONDS,
          }),
        },
        1,
        TEST_NOW_SECONDS
      )
    ).toBeUndefined()
    expect(
      getMatchingPaymentQuote(
        'stripe_recurring',
        { stripe_recurring: stripePaymentQuote({ months: 2 }) },
        1,
        TEST_NOW_SECONDS
      )
    ).toBeUndefined()
    expect(
      getMatchingPaymentQuote(
        'stripe_recurring',
        { stripe_recurring: stripePaymentQuote() },
        12,
        TEST_NOW_SECONDS
      )?.quote_id
    ).toBe('quote-stripe-1')
  })

  test('accepts only future signed same-month Alipay quotes', () => {
    expect(
      getMatchingPaymentQuote(
        'alipay',
        { alipay: alipayPaymentQuote({ quote_id: '   ' }) },
        3,
        TEST_NOW_SECONDS
      )
    ).toBeUndefined()
    expect(
      getMatchingPaymentQuote(
        'alipay',
        { alipay: alipayPaymentQuote({ expires_at: TEST_NOW_SECONDS }) },
        3,
        TEST_NOW_SECONDS
      )
    ).toBeUndefined()
    expect(
      getMatchingPaymentQuote(
        'alipay',
        { alipay: alipayPaymentQuote({ months: 2 }) },
        3,
        TEST_NOW_SECONDS
      )
    ).toBeUndefined()
    expect(
      getMatchingPaymentQuote(
        'alipay',
        { alipay: alipayPaymentQuote() },
        3,
        TEST_NOW_SECONDS
      )?.quote_id
    ).toBe('quote-alipay-3')
  })

  test('selecting Pix and UPI creates quote requests for the selected months', () => {
    expect(
      buildFlexibleQuoteRequest({
        planId: 2,
        paymentChoice: 'pix',
        months: 3,
        requestId: 'request-1',
        recallClaim: 'signed-recall-claim',
      })
    ).toEqual({
      plan_id: 2,
      payment_choice: 'pix',
      months: 3,
      request_id: 'request-1',
      recall_claim: 'signed-recall-claim',
    })

    expect(
      buildFlexibleQuoteRequest({
        planId: 2,
        paymentChoice: 'upi',
        months: 12,
        requestId: 'request-1',
      }).months
    ).toBe(12)
  })

  test('selecting plan-eligible fixed discounts sends recall claim for quote eligibility without local currency filtering', () => {
    expect(
      buildFlexibleQuoteRequest({
        planId: 1,
        paymentChoice: 'balance',
        months: 3,
        requestId: 'request-fixed-currency',
        recallClaim: 'signed-recall-claim',
      }).recall_claim
    ).toBe('signed-recall-claim')
  })

  test('uses only the quote matching the selected local-currency months', () => {
    const quotes = {
      pix: {
        currency: 'BRL',
        months: 1,
        unit_price: 100,
        total: 100,
        quote_id: 'quote-pix-1',
        expires_at: VALID_QUOTE_EXPIRES_AT,
      },
    }

    expect(
      getMatchingPaymentQuote('pix', quotes, 3, TEST_NOW_SECONDS)
    ).toBeUndefined()
    expect(
      getMatchingPaymentQuote('pix', quotes, 1, TEST_NOW_SECONDS)?.quote_id
    ).toBe('quote-pix-1')
  })

  test('rejects Pix and UPI quotes with the wrong local currency', () => {
    expect(
      matchLocalPaymentQuote(
        'pix',
        localPaymentQuote('pix', { currency: 'INR' })
      )
    ).toBeUndefined()
    expect(
      matchLocalPaymentQuote(
        'upi',
        localPaymentQuote('upi', { currency: 'BRL' })
      )
    ).toBeUndefined()
  })

  test('rejects missing or blank quote tokens and expired same-month quotes', () => {
    const { quote_id: _quoteId, ...quoteWithoutToken } =
      localPaymentQuote('pix')

    expect(matchLocalPaymentQuote('pix', quoteWithoutToken)).toBeUndefined()
    expect(
      matchLocalPaymentQuote(
        'upi',
        localPaymentQuote('upi', { quote_id: '   ' })
      )
    ).toBeUndefined()
    expect(
      matchLocalPaymentQuote(
        'upi',
        localPaymentQuote('upi', { expires_at: TEST_NOW_SECONDS })
      )
    ).toBeUndefined()
  })

  test('accepts a signed same-month local quote with a future expiry', () => {
    const quote = matchLocalPaymentQuote('upi', localPaymentQuote('upi'))

    expect(quote?.quote_id).toBe('quote-upi-3')
  })

  test('month changes accept only the latest matching quote response', () => {
    const current = {
      status: 'applied' as const,
      payment_quotes: {
        pix: {
          currency: 'BRL',
          months: 1,
          unit_price: 100,
          total: 100,
          quote_id: 'quote-pix-1',
        },
      },
    }

    const latest = {
      sequence: 2,
      paymentChoice: 'pix' as const,
      months: 3,
      requestId: 'request-1',
    }

    const stale = mergeFlexibleQuoteProjection(
      current,
      {
        payment_quotes: {
          pix: {
            currency: 'BRL',
            months: 2,
            unit_price: 200,
            total: 400,
            quote_id: 'quote-pix-2',
          },
        },
      },
      { ...latest, sequence: 1 },
      latest
    )
    const accepted = mergeFlexibleQuoteProjection(
      current,
      {
        payment_quotes: {
          pix: {
            currency: 'BRL',
            months: 3,
            unit_price: 1234.56,
            total: 3703.68,
            quote_id: 'quote-pix-3',
          },
        },
      },
      latest,
      latest
    )

    expect(stale).toBe(current)
    expect(accepted?.payment_quotes?.pix?.quote_id).toBe('quote-pix-3')
  })
})

describe('subscription embedded checkout invariants', () => {
  test('keeps Stripe Embedded Checkout lifecycle only in the existing dialog', () => {
    const walletRoot = new URL('../', import.meta.url)
    const filesToScan = (directory: URL): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const child = new URL(
          `${entry.name}${entry.isDirectory() ? '/' : ''}`,
          directory
        )
        if (entry.isDirectory()) return filesToScan(child)
        if (!entry.name.match(/\.tsx?$/) || entry.name.includes('.test.')) {
          return []
        }
        return [child.pathname.replace(walletRoot.pathname, '')]
      })

    const filesWithStripeLifecycle = filesToScan(walletRoot)
      .filter((file) => {
        const source = readFileSync(new URL(file, walletRoot), 'utf8')
        return /createEmbeddedCheckoutPage|\.mount\(|\.destroy\(/.test(source)
      })
      .sort()

    expect(filesWithStripeLifecycle).toEqual([
      'components/dialogs/stripe-embedded-checkout-dialog.tsx',
    ])
  })

  test('routes subscription checkout through the shared opener without direct redirect', () => {
    const cardSource = readFileSync(
      new URL('./subscription-plans-card.tsx', import.meta.url),
      'utf8'
    )

    expect(cardSource).not.toContain('window.location.assign')
    expect(cardSource).toContain('onOpenStripeCheckout')
  })

  test('uses only purchase-target quote state without stale self-data fallback', () => {
    const cardSource = readFileSync(
      new URL('./subscription-plans-card.tsx', import.meta.url),
      'utf8'
    )

    expect(cardSource).not.toContain(
      'purchaseProjection?.payment_quotes ?? selfData.payment_quotes'
    )
    expect(cardSource).not.toContain('quoteId: selectedQuote?.quote_id')
    expect(cardSource).toContain('quoteError')
  })

  test('does not compute subscription card recall prices locally', () => {
    const cardSource = readFileSync(
      new URL('./subscription-plans-card.tsx', import.meta.url),
      'utf8'
    )

    expect(cardSource).not.toContain('getRecallPriceDiscount')
    expect(cardSource).not.toContain('discountedAmount')
  })
})

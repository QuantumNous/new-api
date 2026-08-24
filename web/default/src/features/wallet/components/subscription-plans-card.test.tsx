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
  SelfSubscriptionDataResponse,
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
import type { RecallClaimView, RecallOfferView, TopupInfo } from '../types'
import {
  CurrentPlanCard,
  CurrentPlanRenewalDialogContent,
} from './current-plan-card'
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
      media_credits_monthly: price,
      payment_modes: ['stripe_recurring', 'balance_one_period'],
    },
  }
}

const plans = [plan(1, 'Go', 10), plan(2, 'Pro', 20), plan(3, 'Max', 40)]
const localizedPlans = plans.map((item, index) => ({
  ...item,
  plan: {
    ...item.plan,
    currency_prices: {
      USD: [10, 20, 40][index],
      JPY: [1_500, 3_000, 6_000][index],
      BRL: [49.9, 99.9, 199.9][index],
    },
  },
}))
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

function renderWalletCardWithPlans(
  initialPlans: PlanRecord[],
  selfData = normalizeSelfSubscriptionData(undefined)
) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <SubscriptionPlansCard
        topupInfo={topupInfo}
        initialPlans={initialPlans}
        initialSelfData={selfData}
        initialLoading={false}
        userQuota={12345}
      />
    </I18nextProvider>
  )
}

function renderWalletCard(selfData = normalizeSelfSubscriptionData(undefined)) {
  return renderWalletCardWithPlans(plans, selfData)
}

function renderWalletCardWithPreviewQuote(
  quote: SubscriptionPaymentQuote,
  previewPlan = plans[0]
) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <SubscriptionPlansCard
        topupInfo={topupInfo}
        initialPlans={[previewPlan]}
        initialSelfData={normalizeSelfSubscriptionData(undefined)}
        initialLoading={false}
        initialPlanPreviewQuotes={{ [previewPlan.plan.id]: quote }}
        userQuota={12345}
      />
    </I18nextProvider>
  )
}

function rawSelfSubscriptionResponse(
  data: unknown
): SelfSubscriptionDataResponse {
  return data as SelfSubscriptionDataResponse
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

function renderWalletCardWithRecallOffers(recallOffers: RecallOfferView[]) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <RecallClaimProvider offers={recallOffers}>
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
  test('shows configured JPY plan prices for a Japanese interface', async () => {
    await testI18n.changeLanguage('ja-JP')
    try {
      const html = renderWalletCardWithPlans(localizedPlans)

      expect(html).toContain('¥1,500')
      expect(html).toContain('¥3,000')
      expect(html).toContain('¥6,000')
      expect(html).not.toContain('$10')
    } finally {
      await testI18n.changeLanguage('en')
    }
  })

  test('shows configured BRL plan prices for a Portuguese interface', async () => {
    await testI18n.changeLanguage('pt-BR')
    try {
      const html = renderWalletCardWithPlans(localizedPlans)

      expect(html).toContain('R$')
      expect(html).toContain('49,90')
      expect(html).toContain('99,90')
      expect(html).toContain('199,90')
      expect(html).not.toContain('$10')
    } finally {
      await testI18n.changeLanguage('en')
    }
  })

  test('falls all Japanese plan cards back to USD when one JPY price is missing', async () => {
    await testI18n.changeLanguage('ja')
    try {
      const incompletePlans = localizedPlans.map((item, index) =>
        index === 2
          ? {
              ...item,
              plan: {
                ...item.plan,
                currency_prices: { USD: item.plan.price_amount },
              },
            }
          : item
      )
      const html = renderWalletCardWithPlans(incompletePlans)

      expect(html).toContain('$10')
      expect(html).toContain('$20')
      expect(html).toContain('$40')
      expect(html).not.toContain('¥1,500')
    } finally {
      await testI18n.changeLanguage('en')
    }
  })

  test('hides the current plan module when there is no active plan and shows Go Pro Max first', () => {
    const html = renderWalletCard()

    expect(html).not.toContain('Current subscription')
    expect(html).not.toContain('No active plan')
    expect(html).not.toContain('Choose a plan now')
    expect(html.indexOf('Go')).toBeLessThan(html.indexOf('Pro'))
    expect(html.indexOf('Pro')).toBeLessThan(html.indexOf('Max'))
    expect(html).toContain('Buy now')
  })

  test('shows localized plan positioning and marks Pro as most popular', async () => {
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
      expect(html.slice(goStart, proStart)).not.toContain('最受欢迎')
      expect(html.slice(proStart, maxStart)).toContain('最受欢迎')
      expect(html.match(/最受欢迎/g)?.length).toBe(1)
    } finally {
      await testI18n.changeLanguage('en')
    }
  })

  test('keeps the Pro most-popular badge visible when there is an active plan', () => {
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
    expect(html.slice(goStart, proStart)).not.toContain('Most Popular')
    expect(html.slice(proStart, maxStart)).toContain('Most Popular')
    expect(html.match(/Most Popular/g)?.length).toBe(1)
  })

  test('does not render a refresh control in the subscription card header', () => {
    const html = renderWalletCard()

    expect(html).not.toContain('aria-label="Refresh subscription plans"')
  })

  test('renders a read-only current card with correct badges and only monthly plus media usage meters', () => {
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
          can_resume: false,
          requires_support: false,
        },
        current_entitlement: {
          entitlement_id: 20,
          plan_id: 2,
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
        monthly_bucket: {
          used: 7000,
          total: 20000,
          remaining: 13000,
          reset_at: 1,
          unlimited: false,
        },
        media_credits: { used: 3, total: 20, remaining: 17, reset_at: 1 },
      })
    )

    expect(html).toContain('Current plan')
    expect(html).toContain('Pro')
    expect(html).toContain('Active')
    expect(html).toContain('Auto-renew on')
    expect(html).toContain('Cancel subscription')
    expect(html).not.toContain('Auto-renew enabled')
    expect(html).not.toContain('Renewal time')
    expect(html).not.toContain('future charge')
    expect(html.match(/data-wallet-usage-meter=/g)?.length).toBe(2)
    expect(html.match(/data-wallet-secondary-meter=/g)?.length).toBe(2)
    expect(html).toContain('data-wallet-usage-meter="Monthly model quota"')
    expect(html).toContain('data-wallet-usage-meter="Media generation credits"')
    expect(html).not.toContain('data-wallet-usage-meter="5-hour limit"')
    expect(html).not.toContain('data-wallet-usage-meter="7-day limit"')
    expect(html).not.toContain('5-hour limit')
    expect(html).not.toContain('7-day limit')
    expect(html).toContain('$0.014 / $0.04 used')
    expect(html).toContain('3 / 20 used')
    expect(html).not.toContain('Cancel auto-renewal')
    expect(html).not.toContain('Resume auto-renewal')
    expect(html).not.toContain('Manage')
    expect(html).not.toContain('Renewal time')
  })

  test('shows the Stripe recurring renewal badge and cancel action from canonical state', () => {
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
        capabilities: {
          can_cancel: true,
          can_resume: false,
          requires_support: false,
        },
      })
    )

    expect(html).toContain('Active')
    expect(html).not.toContain('Auto-renew enabled')
    expect(html).toContain('Auto-renew on')
    expect(html).toContain('Cancel subscription')
  })

  test('shows wallet auto-renew off and resume action from canonical state', () => {
    const html = renderWalletCard(
      normalizeSelfSubscriptionData({
        contract: {
          contract_id: 18,
          id: 18,
          status: 'active',
          payment_mode: 'balance_one_period',
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
        renewal_status: 'cancelled_by_user',
        capabilities: {
          can_cancel: false,
          can_resume: true,
          requires_support: false,
        },
      })
    )

    expect(html).toContain('Auto-renew off')
    expect(html).toContain('Resume subscription')
    expect(html).not.toContain('Cancel subscription')
  })

  test('shows Stripe auto-renew off and resume action from canonical state', () => {
    const html = renderWalletCard(
      normalizeSelfSubscriptionData({
        contract: {
          contract_id: 19,
          id: 19,
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
        renewal_status: 'cancelled_by_user',
        capabilities: {
          can_cancel: false,
          can_resume: true,
          requires_support: false,
        },
      })
    )

    expect(html).toContain('Auto-renew off')
    expect(html).toContain('Resume subscription')
    expect(html).not.toContain('Cancel subscription')
  })

  test('hides renewal badge and action for one-time or unsupported states', () => {
    const html = renderWalletCard(
      normalizeSelfSubscriptionData({
        contract: {
          contract_id: 20,
          id: 20,
          status: 'active',
          payment_mode: 'balance_one_period',
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
          can_resume: false,
          requires_support: true,
        },
      })
    )

    expect(html).not.toContain('Auto-renew on')
    expect(html).not.toContain('Auto-renew off')
    expect(html).not.toContain('Cancel subscription')
    expect(html).not.toContain('Resume subscription')
  })

  test('renders provider-specific renewal dialog copy and access end date', () => {
    const stripeCancel = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CurrentPlanRenewalDialogContent
          action='cancel'
          renewalSource='provider_recurring'
          endTimestamp={1719792000}
          pending={false}
          plain
          onConfirm={() => undefined}
        />
      </I18nextProvider>
    )
    const walletCancel = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CurrentPlanRenewalDialogContent
          action='cancel'
          renewalSource='wallet_auto'
          endTimestamp={1719792000}
          pending={false}
          plain
          onConfirm={() => undefined}
        />
      </I18nextProvider>
    )
    const stripeResume = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CurrentPlanRenewalDialogContent
          action='resume'
          renewalSource='provider_recurring'
          endTimestamp={1719792000}
          pending={false}
          plain
          onConfirm={() => undefined}
        />
      </I18nextProvider>
    )

    expect(stripeCancel).toContain('Cancel automatic renewal?')
    expect(stripeCancel).toContain(
      'Future Stripe subscription charges stop after the current paid period.'
    )
    expect(walletCancel).toContain(
      'Future deductions from your Flatkey wallet balance stop after the current paid period.'
    )
    expect(stripeResume).toContain('Resume automatic renewal?')
    expect(stripeResume).toContain('Confirm resume')
    expect(stripeCancel).toContain(
      'Your current access and benefits continue through 2024-07-01 00:00:00.'
    )
  })

  test('omits the access end sentence when the renewal period end is unavailable', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CurrentPlanRenewalDialogContent
          action='cancel'
          renewalSource='provider_recurring'
          pending={false}
          plain
          onConfirm={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).not.toContain(
      'Your current access and benefits continue through'
    )
  })

  test('wires current plan renewal callbacks through the card props', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CurrentPlanCard
          plan={plans[1].plan}
          selfData={normalizeSelfSubscriptionData({
            contract: {
              contract_id: 21,
              id: 21,
              status: 'active',
              payment_mode: 'balance_one_period',
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
              can_resume: false,
              requires_support: false,
            },
          })}
          renewalMutationPending
          onCancelRenewal={async () => undefined}
          onResumeRenewal={async () => undefined}
        />
      </I18nextProvider>
    )

    expect(html).toContain('disabled=""')
    expect(html).toContain('Cancel subscription')
  })

  test('uses renewal preconditions and keeps a successful canonical refresh authoritative', () => {
    const cardSource = readFileSync(
      new URL('./subscription-plans-card.tsx', import.meta.url),
      'utf8'
    )

    expect(cardSource).toContain('buildRenewalLifecyclePrecondition(')
    expect(cardSource).toContain('status !== expectedStatus')
    expect(cardSource).toContain('!Number.isSafeInteger(contract.id)')
    expect(cardSource).toContain(
      '!Number.isSafeInteger(contract.change_version)'
    )
    expect(cardSource).toContain(
      '!Number.isSafeInteger(contract.current_period_end)'
    )
    expect(cardSource).toContain('cancelSubscriptionRenewal(precondition)')
    expect(cardSource).toContain('resumeSubscriptionRenewal(precondition)')
    expect(cardSource).toContain('expected_contract_id: contract.id')
    expect(cardSource).toContain(
      'expected_change_version: contract.change_version'
    )
    expect(cardSource).toContain(
      'expected_current_period_end: contract.current_period_end'
    )
    expect(cardSource).toContain('expected_renewal_source: source')
    expect(cardSource).toContain('expected_renewal_status: expectedStatus')
    expect(cardSource).toContain(
      "toast.success(t('Subscription renewal canceled'))"
    )
    expect(cardSource).toContain(
      "toast.success(t('Subscription renewal resumed'))"
    )
    expect(cardSource).toContain('await fetchSelfSubscription()')
    expect(cardSource).toMatch(/const refreshAfterRenewal = async \(\) =>/)
    expect(cardSource).toContain('await refreshAfterRenewal()')
    expect(cardSource).toContain('const selfRefreshResult =')
    expect(cardSource).toMatch(
      /try \{\s*await onPurchaseSuccess\?\.\(\)\s*\} catch \{\s*\/\/ onPurchaseSuccess is best-effort/
    )
    expect(cardSource).not.toContain('callbackFailed')
    expect(cardSource).not.toContain('if (callbackFailed) return')
    expect(cardSource).not.toContain('if (selfRefreshSucceeded && result)')
    expect(cardSource).not.toContain('SubscriptionRenewalLifecycleResult')
    expect(cardSource).not.toContain('sync_pending')
    expect(cardSource).not.toContain(
      'Subscription updated; renewal status is still syncing'
    )
    const selfRefreshFailureIndex = cardSource.indexOf(
      "if (selfRefreshResult === 'failed')"
    )
    const callbackIndex = cardSource.indexOf('await onPurchaseSuccess?.()')
    expect(selfRefreshFailureIndex).toBeGreaterThan(-1)
    expect(callbackIndex).toBeGreaterThan(selfRefreshFailureIndex)
    expect(cardSource).not.toContain(
      'applyRenewalLifecycleResultToSelfData(current, result)'
    )
    expect(
      cardSource.match(
        /const renewalContractId = selfData\.contract\?\.id \?\? null/g
      )
    ).toHaveLength(2)
    expect(
      cardSource.match(
        /applyRenewalLifecycleResultToSelfData\(\s*current,\s*res\.data,\s*renewalContractId\s*\)/g
      )
    ).toHaveLength(2)
    expect(cardSource).toContain(
      "toast.error(t('Subscription updated, but failed to refresh status'))"
    )
    expect(cardSource).toContain(
      "toast.error(t('Failed to refresh subscription status'))"
    )
    expect(cardSource).not.toMatch(
      /if \(!precondition\) \{\s*toast\.error\(t\('Payment request failed'\)\)/
    )
    expect(cardSource).not.toMatch(
      /if \(!precondition\) \{\s*toast\.error\(t\('Failed to refresh subscription status'\)\)/
    )
    expect(cardSource).toMatch(
      /await fetchSelfSubscription\(\{\s*preserveOnFailure: true,\s*\}\)/
    )
    expect(
      cardSource.match(/selfSubscriptionAppliedSequenceRef\.current === 0/g)
    ).toHaveLength(2)
    expect(cardSource).not.toContain(
      'let refreshFailed = !(await fetchSelfSubscription())'
    )
    expect(cardSource).not.toContain(
      'let refreshFailed = syncPending || !(await fetchSelfSubscription())'
    )
    expect(cardSource).not.toContain('refreshFailed = true')
    expect(cardSource).toContain(
      'const selfSubscriptionRequestSequenceRef = useRef(0)'
    )
    expect(cardSource).toContain(
      'const selfSubscriptionAppliedSequenceRef = useRef(0)'
    )
    expect(cardSource).toContain(
      'const requestSequence = ++selfSubscriptionRequestSequenceRef.current'
    )
    expect(cardSource).toContain(
      'if (requestSequence < selfSubscriptionAppliedSequenceRef.current)'
    )
    expect(
      cardSource.match(
        /if \(requestSequence !== selfSubscriptionRequestSequenceRef\.current\)/g
      )
    ).toHaveLength(1)
    expect(cardSource).toContain(
      'requestSequence !== selfSubscriptionRequestSequenceRef.current &&\n' +
        '          selfSubscriptionAppliedSequenceRef.current > 0'
    )
    expect(cardSource).not.toContain(
      'selfSubscriptionAppliedSequenceRef.current > requestSequence'
    )
    expect(cardSource).toContain(
      'selfSubscriptionAppliedSequenceRef.current = requestSequence'
    )
    expect(cardSource).toContain(
      "type SelfSubscriptionRefreshResult = 'applied' | 'superseded' | 'failed'"
    )
    expect(cardSource).toContain("return 'superseded'")
    expect(cardSource).not.toContain('return true\n        }')
    expect(cardSource).toContain("selfRefreshResult === 'failed'")
    expect(cardSource).toContain("selfRefreshResult === 'failed'")
    expect(
      cardSource.match(
        /const optimisticSequence = \+\+selfSubscriptionRequestSequenceRef\.current/g
      )
    ).toHaveLength(2)
    expect(
      cardSource.match(
        /selfSubscriptionAppliedSequenceRef\.current = optimisticSequence/g
      )
    ).toHaveLength(2)
    expect(cardSource.match(/if \(next !== current\) \{/g)).toHaveLength(2)
    expect(
      cardSource.match(/if \(renewalMutationInFlightRef\.current\) \{/g)
    ).toHaveLength(2)
    expect(
      cardSource.match(/throw new Error\(RENEWAL_MUTATION_ALREADY_IN_FLIGHT\)/g)
    ).toHaveLength(2)
    expect(
      cardSource.match(/renewalMutationInFlightRef\.current = true/g)
    ).toHaveLength(2)
    expect(
      cardSource.match(/renewalMutationInFlightRef\.current = false/g)
    ).toHaveLength(2)
    expect(cardSource).not.toContain('cancelRecurringSubscription')
    expect(cardSource).not.toContain('resumeRecurringSubscription')
    expect(cardSource).not.toContain('current_provider_binding_id')
    expect(
      cardSource.match(/let failureRefreshAttempted = false/g)
    ).toHaveLength(2)
    expect(cardSource.match(/failureRefreshAttempted = true/g)).toHaveLength(2)
    expect(
      cardSource.match(/if \(!failureRefreshAttempted\) \{/g)
    ).toHaveLength(2)
  })

  test('refreshes the canonical subscription after renewal mutation failures', () => {
    const cardSource = readFileSync(
      new URL('./subscription-plans-card.tsx', import.meta.url),
      'utf8'
    )

    expect(cardSource).toMatch(
      /const refreshAfterRenewalFailure = async \(\s*options: \{ staleFeedbackOnRefresh\?: boolean \} = \{\}\s*\) => \{\s*const selfRefreshResult = await fetchSelfSubscription\(\{\s*preserveOnFailure: true,\s*\}\)\s*if \(selfRefreshResult === 'failed'\) \{\s*toast\.error\(t\('Failed to refresh subscription status'\)\)\s*\} else if \(options\.staleFeedbackOnRefresh\) \{\s*toast\.error\(\s*t\('Subscription status changed\. Refresh complete; please retry\.'\)\s*\)\s*\}\s*\}/
    )
    expect(
      cardSource.match(/await refreshAfterRenewalFailure\(\)/g)
    ).toHaveLength(2)
    expect(
      cardSource.match(
        /await refreshAfterRenewalFailure\(\{ staleFeedbackOnRefresh: true \}\)/g
      )
    ).toHaveLength(2)
  })

  test('shows stale retry feedback when precondition refresh succeeds before renewal mutation', () => {
    const cardSource = readFileSync(
      new URL('./subscription-plans-card.tsx', import.meta.url),
      'utf8'
    )

    expect(cardSource).toMatch(
      /toast\.error\(\s*t\('Subscription status changed\. Refresh complete; please retry\.'\)\s*\)/
    )
    expect(cardSource).toMatch(
      /if \(!precondition\) \{\s*await refreshAfterRenewalFailure\(\{ staleFeedbackOnRefresh: true \}\)\s*failureRefreshAttempted = true\s*throw new Error\(RENEWAL_FAILURE_TOAST_SHOWN\)\s*\}\s*const res = await cancelSubscriptionRenewal\(precondition\)/
    )
    expect(cardSource).toMatch(
      /if \(!precondition\) \{\s*await refreshAfterRenewalFailure\(\{ staleFeedbackOnRefresh: true \}\)\s*failureRefreshAttempted = true\s*throw new Error\(RENEWAL_FAILURE_TOAST_SHOWN\)\s*\}\s*const res = await resumeSubscriptionRenewal\(precondition\)/
    )
    expect(cardSource).not.toMatch(
      /if \(!precondition\) \{\s*toast\.error\(t\('Payment request failed'\)\)/
    )
  })

  test('localizes renewal refresh warnings in every wallet locale', () => {
    for (const localeCode of ['en', 'zh', 'fr', 'ru', 'ja', 'vi', 'es', 'pt']) {
      const locale = JSON.parse(
        readFileSync(
          new URL(`../../../i18n/locales/${localeCode}.json`, import.meta.url),
          'utf8'
        )
      ) as { translation: Record<string, string> }

      expect(
        locale.translation['Subscription updated, but failed to refresh status']
      ).toBeTruthy()
      expect(
        locale.translation['Failed to refresh subscription status']
      ).toBeTruthy()
      expect(
        locale.translation[
          'Subscription status changed. Refresh complete; please retry.'
        ]
      ).toBeTruthy()
      expect(
        locale.translation[
          'Subscription updated; renewal status is still syncing'
        ]
      ).toBeUndefined()
    }
  })

  test('does not infer wallet auto-renew from a balance one-period contract without canonical renewal state', () => {
    const html = renderWalletCard(
      normalizeSelfSubscriptionData({
        contract: {
          contract_id: 15,
          id: 15,
          status: 'active',
          payment_mode: 'balance_one_period',
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

    expect(html).toContain('Active')
    expect(html).not.toContain('Auto-renew on')
  })

  test('does not infer wallet auto-renew from the legacy balance renewal source', () => {
    const html = renderWalletCard(
      normalizeSelfSubscriptionData(
        rawSelfSubscriptionResponse({
          contract: {
            contract_id: 16,
            id: 16,
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
          renewal_source: 'balance',
          renewal_status: 'enabled',
        })
      )
    )

    expect(html).toContain('Active')
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
    expect(html).toContain('data-wallet-usage-meter="Monthly model quota"')
    expect(html).not.toContain('data-wallet-usage-meter="5-hour limit"')
    expect(html).not.toContain('data-wallet-usage-meter="7-day limit"')
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

  test('labels plan card monthly quota and media credits without short-window quotas', () => {
    const html = renderWalletCard()

    expect(html).toContain('Monthly model quota: $0.02')
    expect(html).toContain('Media generation credits: 10 credits')
    expect(html).not.toContain('5-hour limit')
    expect(html).not.toContain('7-day limit')
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

  test('shows the backend-selected invitation discount on the plan card', () => {
    const html = renderWalletCardWithPreviewQuote(
      stripePaymentQuote({
        unit_price: 10,
        original_total: 10,
        discount_kind: 'invitation',
        discount_amount: 5,
        invitation_discount_amount: 5,
        total: 5,
      })
    )

    expect(html).toContain('OFF')
    expect(html).toContain('line-through')
    expect(html).toContain('$10')
    expect(html).toContain('$5')
    expect(html).toContain('Save $5')
  })

  test('shows Recall when the backend quote selects it over invitation credit', () => {
    const html = renderWalletCardWithPreviewQuote(
      stripePaymentQuote({
        unit_price: 10,
        original_total: 10,
        discount_kind: 'recall',
        discount_amount: 6,
        invitation_discount_amount: 5,
        other_discount_kind: 'recall',
        other_discount_amount: 6,
        total: 4,
      })
    )

    expect(html).toContain('OFF')
    expect(html).toContain('$10')
    expect(html).toContain('$4')
    expect(html).toContain('Save $6')
    expect(html).not.toContain('Save $5')
  })

  test('formats backend preview amounts in the quote currency', () => {
    const brlPlan = plan(4, 'Go', 100)
    brlPlan.plan.currency = 'BRL'
    const html = renderWalletCardWithPreviewQuote(
      stripePaymentQuote({
        currency: 'BRL',
        unit_price: 100,
        original_total: 100,
        discount_kind: 'invitation',
        discount_amount: 50,
        invitation_discount_amount: 50,
        total: 50,
      }),
      brlPlan
    )

    expect(html).toContain('R$')
    expect(html).toContain('50,00')
    expect(html).toContain('100,00')
  })

  test('formats JPY backend preview amounts without a USD fallback', () => {
    const jpyPlan = plan(5, 'Pro', 2000)
    jpyPlan.plan.currency = 'JPY'
    const html = renderWalletCardWithPreviewQuote(
      stripePaymentQuote({
        currency: 'JPY',
        unit_price: 2000,
        original_total: 2000,
        discount_kind: 'recall',
        discount_amount: 1000,
        other_discount_kind: 'recall',
        other_discount_amount: 1000,
        total: 1000,
      }),
      jpyPlan
    )

    expect(html).toContain('¥1,000')
    expect(html).toContain('¥2,000')
    expect(html).not.toContain('$1000')
  })

  test('falls back to USD when backend preview quote currency is not a string', () => {
    for (const runtimeCurrency of [null, 123]) {
      const html = renderWalletCardWithPreviewQuote(
        stripePaymentQuote({
          currency: runtimeCurrency as unknown as string,
          original_total: 10,
          discount_kind: 'invitation',
          discount_amount: 6,
          invitation_discount_amount: 6,
          total: 4,
        })
      )

      expect(html).toContain('$10')
      expect(html).toContain('$4')
      expect(html).toContain('Save $6')
    }
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

  test('does not locally discount plan card prices for account recall offers without backend quotes', () => {
    const html = renderWalletCardWithRecallOffers([
      {
        ...subscriptionRecallClaim,
        recipient_id: 101,
        issued_at: 1_700_000_001,
        discount: {
          ...subscriptionRecallClaim.discount,
          percent_off: 20,
        },
      },
      {
        ...subscriptionRecallClaim,
        recipient_id: 102,
        issued_at: 1_700_000_002,
        discount: {
          ...subscriptionRecallClaim.discount,
          percent_off: 50,
        },
      },
    ])
    const goStart = html.indexOf('Go')
    const proStart = html.indexOf('Pro', goStart)
    const goSlice = html.slice(goStart, proStart)

    expect(goSlice).toContain('$10')
    expect(goSlice).not.toContain('50% OFF')
    expect(goSlice).not.toContain('$5')
    expect(html).not.toContain('signed-recall-claim')
    expect(html).not.toContain('FKSE')
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

  test('formats backend recall subscription preview savings in the quote currency', () => {
    const formatBrl = (amount: number) =>
      Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    const basePlan = plan(4, 'Brazil', 50)
    const brlPlan = {
      ...basePlan,
      plan: {
        ...basePlan.plan,
        currency: 'BRL',
        stripe_price_id: 'price_brl',
      },
    }
    const html = renderWalletCardWithPreviewQuote(
      stripePaymentQuote({
        currency: 'BRL',
        unit_price: 50,
        original_total: 50,
        discount_kind: 'recall',
        discount_amount: 10,
        other_discount_kind: 'recall',
        other_discount_amount: 10,
        total: 40,
      }),
      brlPlan
    )

    expect(html).toContain(formatBrl(50))
    expect(html).toContain(formatBrl(40))
    expect(html).toContain(`Save ${formatBrl(10)}`)
    expect(html).not.toContain('$50')
    expect(html).not.toContain('$40')
    expect(html).not.toContain('Save $10')
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
      expect(html).toContain('Monthly and Image + video usage reset.')
      expect(html).not.toContain('5-hour')
      expect(html).not.toContain('7-day')
      expect(html).not.toContain('rolling usage')
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

  test('prefetches one-month Stripe quotes for plan-card previews', () => {
    const cardSource = readFileSync(
      new URL('./subscription-plans-card.tsx', import.meta.url),
      'utf8'
    )

    expect(cardSource).toContain('setPlanPreviewQuotes')
    expect(cardSource).toContain("paymentChoice: 'stripe_recurring'")
    expect(cardSource).toContain('months: 1')
  })
})

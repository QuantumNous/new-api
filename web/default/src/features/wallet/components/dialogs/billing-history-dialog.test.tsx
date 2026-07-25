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
import type { ComponentType } from 'react'
import { beforeAll, describe, expect, test } from 'bun:test'
import i18n from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import type { TopupRecord } from '../../types'
import * as billingHistoryDialog from './billing-history-dialog'

type RefundableTerm = {
  term_segment_id: number
  order_id: number
  plan_id: number
  plan_title: string
  start_time: number
  end_time: number
  remaining_days: number
  refund_money: number
  refund_quota: number
  status: 'not_started'
}

type RefundableTermsData = {
  items: RefundableTerm[]
  total_refund_money: number
  total_refund_quota: number
}

type RefundableTermsContentProps = {
  data: RefundableTermsData
  refundingTermId: number | null
  onRequestRefund: (term: RefundableTerm) => void
}

type RefundableTermsManagerProps = {
  data: RefundableTermsData
  refundingTermId: number | null
  onConfirmRefund: (term: RefundableTerm) => Promise<boolean>
}

type RefundableTermConfirmationDetailsProps = {
  term: RefundableTerm
}

type RefundableTermsLoadErrorProps = {
  retrying: boolean
  onRetry: () => void
}

type BillingHistoryAvailabilityInput = {
  billingTotal: number
  refundableTermCount: number
  refundableTermsError: boolean
}

type RefundableHistoryExports = {
  RefundableTermsContent?: ComponentType<RefundableTermsContentProps>
  RefundableTermsManager?: ComponentType<RefundableTermsManagerProps>
  RefundableTermConfirmationDetails?: ComponentType<RefundableTermConfirmationDetailsProps>
  RefundableTermsLoadError?: ComponentType<RefundableTermsLoadErrorProps>
  isBillingHistoryPanelAvailable?: (
    input: BillingHistoryAvailabilityInput
  ) => boolean
  isSubscriptionRecord?: (record: TopupRecord) => boolean
  isPendingStripeRecord?: (record: TopupRecord) => boolean
}

const term: RefundableTerm = {
  term_segment_id: 42,
  order_id: 8,
  plan_id: 3,
  plan_title: 'Flatkey Pro',
  start_time: 1_800_000_000,
  end_time: 1_802_592_000,
  remaining_days: 30,
  refund_money: 3.25,
  refund_quota: 2_125_000,
  status: 'not_started',
}

const data: RefundableTermsData = {
  items: [term],
  total_refund_money: term.refund_money,
  total_refund_quota: term.refund_quota,
}

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

function renderWithI18n(node: React.ReactNode): string {
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>{node}</I18nextProvider>
  )
}

describe('BillingHistoryPanel refundable plan terms', () => {
  test('shows the subdued management entry only when refundable terms exist', () => {
    const Manager = (billingHistoryDialog as RefundableHistoryExports)
      .RefundableTermsManager
    expect(Manager).toBeDefined()
    if (!Manager) return

    const emptyHtml = renderWithI18n(
      <Manager
        data={{ ...data, items: [] }}
        refundingTermId={null}
        onConfirmRefund={async () => true}
      />
    )
    const populatedHtml = renderWithI18n(
      <Manager
        data={data}
        refundingTermId={null}
        onConfirmRefund={async () => true}
      />
    )

    expect(emptyHtml).not.toContain('Manage not-started terms')
    expect(populatedHtml).toContain('Manage not-started terms')
  })

  test('renders the eligible period, remaining days, balance refund, and policy', () => {
    const Content = (billingHistoryDialog as RefundableHistoryExports)
      .RefundableTermsContent
    expect(Content).toBeDefined()
    if (!Content) return

    const html = renderWithI18n(
      <Content
        data={data}
        refundingTermId={null}
        onRequestRefund={() => undefined}
      />
    )

    expect(html).toContain('Flatkey Pro')
    expect(html).toContain('Start date')
    expect(html).toContain('End date')
    expect(html).toContain('30 days')
    expect(html).toContain('Started plan terms are not refundable.')
    expect(html).toContain('not the original payment method')
    expect(html).toContain('Refund term')
  })

  test('renders refund money and Flatkey balance quota independently for each term', () => {
    const Content = (billingHistoryDialog as RefundableHistoryExports)
      .RefundableTermsContent
    expect(Content).toBeDefined()
    if (!Content) return

    const html = renderWithI18n(
      <Content
        data={data}
        refundingTermId={null}
        onRequestRefund={() => undefined}
      />
    )

    expect(html).toContain('Refund amount')
    expect(html).toContain('$3.25')
    expect(html).toContain('Return to Flatkey available balance')
    expect(html).toContain('$4.25')
  })

  test('renders refund money and Flatkey balance quota independently in confirmation', () => {
    const ConfirmationDetails = (
      billingHistoryDialog as RefundableHistoryExports
    ).RefundableTermConfirmationDetails
    expect(ConfirmationDetails).toBeDefined()
    if (!ConfirmationDetails) return

    const html = renderWithI18n(<ConfirmationDetails term={term} />)

    expect(html).toContain('Refund amount')
    expect(html).toContain('$3.25')
    expect(html).toContain('Return to Flatkey available balance')
    expect(html).toContain('$4.25')
  })

  test('renders an inline refundable-terms error with a retry action', () => {
    const LoadError = (billingHistoryDialog as RefundableHistoryExports)
      .RefundableTermsLoadError
    expect(LoadError).toBeDefined()
    if (!LoadError) return

    const html = renderWithI18n(
      <LoadError retrying={false} onRetry={() => undefined} />
    )

    expect(html).toContain('Failed to load refundable plan terms')
    expect(html).toContain('Retry')
    expect(html).toMatch(/<button[^>]*>/)
  })

  test('keeps the billing history panel available when refundable terms fail and billing history is empty', () => {
    const isAvailable = (billingHistoryDialog as RefundableHistoryExports)
      .isBillingHistoryPanelAvailable
    expect(isAvailable).toBeDefined()
    if (!isAvailable) return

    expect(
      isAvailable({
        billingTotal: 0,
        refundableTermCount: 0,
        refundableTermsError: true,
      })
    ).toBe(true)
    expect(
      isAvailable({
        billingTotal: 0,
        refundableTermCount: 0,
        refundableTermsError: false,
      })
    ).toBe(false)
  })

  test('disables refund controls while a term refund is in flight', () => {
    const Content = (billingHistoryDialog as RefundableHistoryExports)
      .RefundableTermsContent
    expect(Content).toBeDefined()
    if (!Content) return

    const html = renderWithI18n(
      <Content
        data={data}
        refundingTermId={term.term_segment_id}
        onRequestRefund={() => undefined}
      />
    )

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>/)
    expect(html).toContain('Processing...')
  })
})

describe('BillingHistoryPanel subscription billing records', () => {
  const pendingStripeRecord: TopupRecord = {
    id: 91,
    user_id: 7,
    amount: 0,
    money: 12,
    trade_no: 'SUBSTR202607230001',
    payment_method: 'stripe',
    payment_provider: 'stripe',
    payment_currency: 'USD',
    gateway_trade_no: 'cs_test_subscription_checkout',
    create_time: 1_800_000_000,
    status: 'pending',
  }

  test('classifies mirrored subscription order prefixes without suppressing Stripe checkout recovery', () => {
    const exports = billingHistoryDialog as RefundableHistoryExports
    expect(exports.isSubscriptionRecord).toBeDefined()
    expect(exports.isPendingStripeRecord).toBeDefined()
    if (!exports.isSubscriptionRecord || !exports.isPendingStripeRecord) return

    expect(exports.isSubscriptionRecord(pendingStripeRecord)).toBe(true)
    expect(exports.isPendingStripeRecord(pendingStripeRecord)).toBe(true)
    expect(
      exports.isSubscriptionRecord({
        ...pendingStripeRecord,
        trade_no: 'SUBPUR202607230001',
        payment_method: 'alipay',
        payment_provider: 'alipay',
        gateway_trade_no: undefined,
      })
    ).toBe(true)
  })
})

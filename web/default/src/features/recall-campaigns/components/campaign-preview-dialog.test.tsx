import * as React from 'react'
import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import type { RecallCampaignPreview } from '../types'

mock.module('@/components/ui/dialog', () => ({
  Dialog: (props: { children: React.ReactNode; open?: boolean }) =>
    props.open ? <div>{props.children}</div> : null,
  DialogContent: (props: React.HTMLAttributes<HTMLDivElement>) => (
    <section {...props} />
  ),
  DialogDescription: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} />
  ),
  DialogFooter: ({
    showCloseButton: _showCloseButton,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { showCloseButton?: boolean }) => (
    <footer {...props} />
  ),
  DialogHeader: (props: React.HTMLAttributes<HTMLDivElement>) => (
    <header {...props} />
  ),
  DialogTitle: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...props} />
  ),
}))

const { CampaignPreviewDialogContent } =
  await import('./campaign-preview-dialog-content')
const { RECALL_CAMPAIGN_PREVIEW_DIALOG_DESCRIPTION } =
  await import('./campaign-preview-dialog')

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

describe('campaign preview dialog', () => {
  test('uses neutral activation review copy in the dialog description', () => {
    expect(RECALL_CAMPAIGN_PREVIEW_DIALOG_DESCRIPTION).toBe(
      'Review eligibility, exclusions, and delivery validation before activation.'
    )
    expect(RECALL_CAMPAIGN_PREVIEW_DIALOG_DESCRIPTION).not.toContain(
      'promotion validation'
    )
  })

  test('renders event-boundary lifecycle estimates with masked samples and recheck warning', () => {
    const preview = {
      eligible_total: 0,
      exclusions: {},
      sample: [],
      stripe: null,
      lifecycle: {
        processing_start_at: 1_900_000_000,
        collection_start_at: 1_899_900_000,
        earliest_available_at: 1_899_950_000,
        estimated_count: 12,
        due_count: 5,
        samples: [
          {
            id: 101,
            event_type: 'quota_low',
            user: 'user_***42',
            scope_type: 'balance',
            scope: 'global',
            business_key: 'trade_***123',
            recipient_identity: 'a***@example.com',
            disposition: 'due',
            disposition_reason_code: '',
            occurred_at: 1_899_960_000,
            available_at: 1_900_000_100,
            attempt_count: 1,
            last_error_code: '',
          },
        ],
      },
    } as RecallCampaignPreview

    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CampaignPreviewDialogContent data={preview} />
      </I18nextProvider>
    )

    expect(html).toContain('Lifecycle event boundary')
    expect(html).toContain('Collection start')
    expect(html).toContain('Processing start')
    expect(html).toContain('Earliest available')
    expect(html).toContain('Estimated events')
    expect(html).toContain('12')
    expect(html).toContain('Due now')
    expect(html).toContain('5')
    expect(html).toContain('quota_low')
    expect(html).toContain('user_***42')
    expect(html).toContain('a***@example.com')
    expect(html).toContain('trade_***123')
    expect(html).toContain('Occurred at')
    expect(html).toContain(
      'Send-time rechecks can reduce the final recipient count.'
    )
    expect(html).not.toContain('Eligible total')
    expect(html).not.toContain('Promotion validation')
  })

  test('renders a fixed discount when currency options are null', () => {
    const preview = {
      eligible_total: 1,
      exclusions: {},
      sample: [],
      stripe: {
        coupon_source: 'automatic',
        coupon_id: '',
        discount: {
          type: 'fixed',
          percent_off: 0,
          amount_off: 500,
          currency: 'usd',
          currency_options: null,
          minimum_amount: 0,
          minimum_amount_currency: '',
        },
        topup_price_ids: [],
        subscription_price_ids: [],
        product_ids: [],
      },
    } satisfies RecallCampaignPreview

    expect(() =>
      renderToStaticMarkup(
        <I18nextProvider i18n={testI18n}>
          <CampaignPreviewDialogContent data={preview} />
        </I18nextProvider>
      )
    ).not.toThrow()
  })

  test('uses neutral validation copy when no promotion preview applies', () => {
    const preview = {
      eligible_total: 0,
      exclusions: {},
      sample: [],
      stripe: null,
      lifecycle: null,
    } satisfies RecallCampaignPreview

    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CampaignPreviewDialogContent data={preview} />
      </I18nextProvider>
    )

    expect(html).toContain('Delivery validation')
    expect(html).toContain('Not applicable')
    expect(html).not.toContain('Promotion validation')
  })
})

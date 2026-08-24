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

const {
  CampaignPreviewDialogContent,
  formatRecallLifecycleOutcomeCode,
  formatRecallMessageState,
} = await import('./campaign-preview-dialog-content')
const { RECALL_CAMPAIGN_PREVIEW_DIALOG_DESCRIPTION } =
  await import('./campaign-preview-dialog')

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
      en: {
        translation: {
          quota_low: 'Low quota trigger',
          skipped: 'Skipped',
          invalid_email: 'Invalid lifecycle email',
          lease_recovered: 'Lease recovered for retry',
          lifecycle_enrollment_retry: 'Lifecycle enrollment retry',
          lifecycle_retry: 'Lifecycle retry',
          lifecycle_skipped: 'Lifecycle skipped',
          persistent_exclusion: 'Persistent exclusion',
          sending: 'Sending via SMTP',
          'SMTP accepted': 'SMTP accepted',
          'Unknown message state': 'Unknown message state',
          'Unknown lifecycle event': 'Unknown lifecycle event',
          'Unknown lifecycle outcome': 'Unknown lifecycle outcome',
        },
      },
    },
    interpolation: { escapeValue: false },
  })
})

describe('campaign preview dialog', () => {
  test('formats every audited lifecycle outcome without exposing known backend codes', () => {
    const t = testI18n.t.bind(testI18n)

    for (const code of [
      'lifecycle_enrollment_retry',
      'lifecycle_retry',
      'lifecycle_skipped',
      'persistent_exclusion',
    ]) {
      expect(formatRecallLifecycleOutcomeCode(code, t)).toBe(testI18n.t(code))
      expect(formatRecallLifecycleOutcomeCode(code, t)).not.toBe(code)
    }

    expect(formatRecallLifecycleOutcomeCode('unknown_future_code', t)).toBe(
      'Unknown lifecycle outcome'
    )
  })

  test('formats every audited recall message state with a safe fallback', () => {
    const t = testI18n.t.bind(testI18n)

    expect(formatRecallMessageState('accepted', t)).toBe('SMTP accepted')
    expect(formatRecallMessageState('sending', t)).toBe('Sending via SMTP')
    expect(formatRecallMessageState('unknown_future_state', t)).toBe(
      'Unknown message state'
    )
  })

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
            disposition: 'skipped',
            disposition_reason_code: 'invalid_email',
            occurred_at: 1_899_960_000,
            available_at: 1_900_000_100,
            attempt_count: 1,
            last_error_code: 'lease_recovered',
          },
          {
            id: 102,
            event_type: 'unknown_future_event',
            user: 'user_***99',
            scope_type: 'balance',
            scope: 'global',
            business_key: 'trade_***999',
            recipient_identity: 'b***@example.com',
            disposition: 'skipped',
            disposition_reason_code: 'unknown_future_reason',
            occurred_at: 1_899_960_100,
            available_at: 1_900_000_200,
            attempt_count: 1,
            last_error_code: 'unknown_future_error',
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
    expect(html).toContain('Low quota trigger')
    expect(html).not.toContain('quota_low')
    expect(html).toContain('user_***42')
    expect(html).toContain('a***@example.com')
    expect(html).toContain('trade_***123')
    expect(html).toContain('Skipped (Invalid lifecycle email)')
    expect(html).not.toContain('skipped (invalid_email)')
    expect(html).toContain('Lease recovered for retry')
    expect(html).not.toContain('lease_recovered')
    expect(html).toContain('Unknown lifecycle event')
    expect(html).toContain('Skipped (Unknown lifecycle outcome)')
    expect(html).toContain('Unknown lifecycle outcome')
    expect(html).not.toContain('unknown_future_event')
    expect(html).not.toContain('unknown_future_reason')
    expect(html).not.toContain('unknown_future_error')
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

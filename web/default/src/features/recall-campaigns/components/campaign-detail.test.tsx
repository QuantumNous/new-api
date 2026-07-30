import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { recallCampaignKeys } from '../api'
import type {
  RecallCampaignDetail,
  RecallCampaignMetrics,
  RecallCampaignType,
  RecallEmailStage,
} from '../types'

mock.module('@tanstack/react-router', () => ({
  Link: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} />
  ),
  Outlet: () => null,
  useLocation: (options?: {
    select?: (location: { href: string; pathname: string }) => unknown
  }) => {
    const location = {
      href: '/recall-campaigns/42',
      pathname: '/recall-campaigns/42',
    }
    return options?.select ? options.select(location) : location
  },
  useNavigate: () => () => Promise.resolve(),
  useBlocker: () => ({
    proceed: () => undefined,
    reset: () => undefined,
    status: 'idle',
  }),
  useRouterState: (options?: {
    select?: (state: { location: { pathname: string } }) => unknown
  }) => {
    const state = { location: { pathname: '/recall-campaigns/42' } }
    return options?.select ? options.select(state) : state
  },
}))

mock.module('./campaign-preview-dialog', () => ({
  CampaignPreviewDialog: () => null,
}))

mock.module('./campaign-action-dialog', () => ({
  CampaignActionDialog: () => null,
}))

const {
  CampaignDetail,
  formatRecallDeliveryErrorMessage,
  getRecallActivationReadiness,
  getRecallCampaignMetricCards,
} = await import('./campaign-detail')

const locales = ['en', 'zh', 'es', 'fr', 'pt', 'ru', 'ja', 'vi'] as const
const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

function makeStage(): RecallEmailStage {
  return {
    stage_no: 1,
    delay_seconds: 0,
    template_version: 1,
    source_revision: 3,
    translated_source_revision: 3,
    manual_locales: [],
    templates: Object.fromEntries(
      locales.map((locale) => [
        locale,
        { subject: `${locale} subject`, body_html: `<p>${locale}</p>` },
      ])
    ),
  }
}

function makeMetrics(): RecallCampaignMetrics {
  return {
    candidate_count: 10,
    enrolled_count: 8,
    excluded_count: 2,
    customer_success_count: 7,
    customer_failure_count: 1,
    code_success_count: 6,
    code_failure_count: 1,
    messages_scheduled_count: 9,
    messages_accepted_count: 4,
    messages_failed_count: 2,
    messages_cancelled_count: 1,
    opened_recipient_count: 5,
    observed_click_count: 3,
    direct_count: 1,
    assisted_count: 2,
    no_coupon_count: 1,
    currency_metrics: [],
  }
}

function makeDetail(campaignType: RecallCampaignType): RecallCampaignDetail {
  return {
    id: 42,
    campaign_type: campaignType,
    name: 'Rendered campaign',
    status: 'running',
    audience_template: 'registered_only',
    execution_mode: 'manual',
    scheduled_at: 0,
    next_run_at: 0,
    coupon_source: 'automatic',
    stripe_coupon_id: '',
    promotion_expiry_mode: 'relative',
    promotion_expires_at: 0,
    promotion_valid_seconds: 604800,
    enrollment_limit: 100,
    worker_concurrency: 2,
    config_revision: 1,
    created_by: 1,
    created_at: 0,
    updated_at: 0,
    activated_at: 0,
    completed_at: 0,
    recipient_total: 0,
    draft: {
      campaign_type: campaignType,
      name: 'Rendered campaign',
      audience_template: 'registered_only',
      audience_config: {
        registration_age_days: 30,
        min_request_count: 0,
        max_quota: 0,
        min_paid_amount: 0,
        last_api_call_age_days: 0,
        last_payment_age_days: 0,
        subscription_expired_days: 0,
        min_subscription_amount: 0,
        min_subscription_count: 0,
        payment_providers: [],
        groups: [],
        group_mode: '',
        require_verified_email: false,
        registration_start_at: 0,
        registration_end_at: 0,
        specified_user_ids: [],
        specified_emails: [],
      },
      execution_mode: 'manual',
      schedule: {
        scheduled_at: 0,
        timezone: 'UTC',
        frequency: 'daily',
        weekday: 1,
        hour: 9,
        minute: 0,
      },
      coupon_source: 'automatic',
      existing_coupon_id: '',
      discount_config: {
        type: 'percent',
        percent_off: 20,
        amount_off: 0,
        currency: '',
        currency_options: {},
        minimum_amount: 0,
        minimum_amount_currency: '',
      },
      product_scope: {
        topup_price_ids: [],
        subscription_price_ids: [],
      },
      promotion_expiry_mode: 'relative',
      promotion_expires_at: 0,
      promotion_valid_seconds: 604800,
      enrollment_limit: 100,
      worker_concurrency: 2,
      email_sequence: [makeStage()],
      defer_localization: false,
    },
  }
}

function renderCampaignDetail(campaignType: RecallCampaignType): string {
  const campaignId = 42
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        enabled: false,
        retry: false,
      },
    },
  })
  queryClient.setQueryData(recallCampaignKeys.detail(campaignId), {
    success: true,
    data: makeDetail(campaignType),
  })
  queryClient.setQueryData(recallCampaignKeys.metrics(campaignId), {
    success: true,
    data: makeMetrics(),
  })
  queryClient.setQueryData(recallCampaignKeys.recipients(campaignId, 1), {
    success: true,
    data: { items: [], total: 0, page: 1, page_size: 100 },
  })
  queryClient.setQueryData(recallCampaignKeys.events(campaignId, 1), {
    success: true,
    data: { items: [], total: 0, page: 1, page_size: 100 },
  })

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={testI18n}>
        <CampaignDetail campaignId={campaignId} />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

function campaignMetricsMarkup(html: string): string {
  const start = html.indexOf('Campaign metrics')
  const end = html.indexOf('Recipients and messages')
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return html.slice(start, end)
}

describe('Recall campaign activation readiness', () => {
  test('allows activation only for exact current eight-locale templates', () => {
    expect(getRecallActivationReadiness([makeStage()])).toEqual({
      ready: true,
      blockers: [],
    })

    const stale = makeStage()
    stale.source_revision = 4
    const staleReadiness = getRecallActivationReadiness([stale])
    expect(staleReadiness.ready).toBeFalse()
    expect(staleReadiness.blockers[0]).toEqual({
      stage_no: 1,
      locale: 'zh',
      reason: 'stale',
    })

    const missing = makeStage()
    delete missing.templates.fr
    const missingReadiness = getRecallActivationReadiness([missing])
    expect(missingReadiness.ready).toBeFalse()
    expect(missingReadiness.blockers).toContainEqual({
      stage_no: 1,
      locale: 'fr',
      reason: 'missing',
    })

    const invalid = makeStage()
    invalid.templates.de = {
      subject: 'Unexpected locale',
      body_html: '<p>Unexpected</p>',
    }
    const invalidReadiness = getRecallActivationReadiness([invalid])
    expect(invalidReadiness.ready).toBeFalse()
    expect(invalidReadiness.blockers).toContainEqual({
      stage_no: 1,
      locale: 'de',
      reason: 'invalid',
    })
  })

  test.each(['null', 'undefined'] as const)(
    'reports legacy %s templates as missing without crashing',
    (shape) => {
      const legacy = makeStage()
      legacy.templates = (shape === 'null'
        ? null
        : undefined) as unknown as RecallEmailStage['templates']

      const readiness = getRecallActivationReadiness([legacy])

      expect(readiness.ready).toBeFalse()
      expect(readiness.blockers).toContainEqual({
        stage_no: 1,
        locale: 'en',
        reason: 'missing',
      })
      expect(readiness.blockers).toContainEqual({
        stage_no: 1,
        locale: 'fr',
        reason: 'missing',
      })
    }
  )
})

describe('Recall campaign delivery errors', () => {
  test('translates stable Activity SMTP error codes without exposing known raw messages', () => {
    const t = (key: string) =>
      key ===
      'Activity SMTP delivery failed. Check the host, port, credentials, TLS mode, and sender authorization, then retry.'
        ? 'Translated Activity SMTP failure'
        : key ===
            'Activity SMTP is not configured. Configure it before sending.'
          ? 'Translated Activity SMTP not configured'
          : key ===
              'Delivery status is uncertain. Check the mailbox provider before retrying.'
            ? 'Translated uncertain SMTP delivery'
            : `translated:${key}`

    expect(
      formatRecallDeliveryErrorMessage(
        'activity_smtp_send_failed',
        'raw smtp transport detail',
        t
      )
    ).toBe('Translated Activity SMTP failure')

    expect(
      formatRecallDeliveryErrorMessage(
        'activity_smtp_not_configured',
        'raw config detail',
        t
      )
    ).toBe('Translated Activity SMTP not configured')

    expect(
      formatRecallDeliveryErrorMessage(
        'smtp_uncertain',
        'raw timeout detail',
        t
      )
    ).toBe('Translated uncertain SMTP delivery')
  })

  test('uses backend message only as an unknown error fallback', () => {
    const t = (key: string) =>
      key ===
      'Activity SMTP delivery failed. Check the host, port, credentials, TLS mode, and sender authorization, then retry.'
        ? 'Translated Activity SMTP failure'
        : `translated:${key}`

    expect(
      formatRecallDeliveryErrorMessage(
        'unknown_backend_code',
        'Raw backend detail',
        t
      )
    ).toBe('Raw backend detail')

    expect(formatRecallDeliveryErrorMessage('', 'Raw backend detail', t)).toBe(
      'Raw backend detail'
    )
    expect(formatRecallDeliveryErrorMessage('', '', t)).toBe('')
  })
})

describe('Recall campaign metric cards', () => {
  test('shows opened users as a same-level engagement metric for content-only campaigns', () => {
    const cards = getRecallCampaignMetricCards(makeMetrics(), false)

    expect(cards).toContainEqual(['Users who opened', 5])
    expect(cards).toContainEqual(['Observed clicks', 3])
    expect(cards).not.toContainEqual(['Direct conversions', 1])

    const openedIndex = cards.findIndex(
      ([label]) => label === 'Users who opened'
    )
    const clickIndex = cards.findIndex(([label]) => label === 'Observed clicks')
    expect(openedIndex).toBeGreaterThan(-1)
    expect(clickIndex).toBe(openedIndex + 1)
  })

  test('keeps opened users beside observed clicks while retaining promotion conversion metrics', () => {
    const cards = getRecallCampaignMetricCards(makeMetrics(), true)

    expect(cards).toContainEqual(['Users who opened', 5])
    expect(cards).toContainEqual(['Observed clicks', 3])
    expect(cards).toContainEqual(['Direct conversions', 1])
    expect(cards).toContainEqual(['Assisted conversions', 2])
    expect(cards).toContainEqual(['No-coupon conversions', 1])

    const openedIndex = cards.findIndex(
      ([label]) => label === 'Users who opened'
    )
    const clickIndex = cards.findIndex(([label]) => label === 'Observed clicks')
    expect(openedIndex).toBeGreaterThan(-1)
    expect(clickIndex).toBe(openedIndex + 1)
  })
})

describe('CampaignDetail metric rendering', () => {
  test('renders opened users beside observed clicks for content-only campaign metrics', () => {
    const metricsHtml = campaignMetricsMarkup(
      renderCampaignDetail('content_only')
    )

    expect(metricsHtml).toContain('Users who opened')
    expect(metricsHtml).toContain('>5</div>')
    expect(metricsHtml).toContain('Observed clicks')
    expect(metricsHtml).toContain('>3</div>')
    expect(metricsHtml).not.toContain('Direct conversions')
  })

  test('renders opened users and keeps promotion conversion metrics for promotion campaigns', () => {
    const metricsHtml = campaignMetricsMarkup(renderCampaignDetail('promotion'))

    expect(metricsHtml).toContain('Users who opened')
    expect(metricsHtml).toContain('>5</div>')
    expect(metricsHtml).toContain('Observed clicks')
    expect(metricsHtml).toContain('>3</div>')
    expect(metricsHtml).toContain('Direct conversions')
    expect(metricsHtml).toContain('Assisted conversions')
    expect(metricsHtml).toContain('No-coupon conversions')
  })
})

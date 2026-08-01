import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { recallCampaignKeys } from '../api'
import type {
  RecallCampaignDetail,
  RecallCampaignMetrics,
  RecallCampaignType,
  RecallEmailStage,
  RecallMetricCard,
  RecallMetricKey,
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

afterAll(() => {
  mock.restore()
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
    candidate_count: 999,
    enrolled_count: 999,
    excluded_count: 999,
    customer_success_count: 7,
    customer_failure_count: 1,
    code_success_count: 6,
    code_failure_count: 1,
    messages_scheduled_count: 9,
    messages_accepted_count: 999,
    messages_failed_count: 999,
    messages_cancelled_count: 1,
    opened_recipient_count: 999,
    observed_click_count: 999,
    direct_count: 999,
    assisted_count: 999,
    no_coupon_count: 999,
    currency_metrics: [],
    metric_cards: {
      candidates: makeMetricCard('candidates', 10, 'identity'),
      enrolled: makeMetricCard('enrolled', 8, 'identity'),
      excluded: makeMetricCard('excluded', 2, 'identity'),
      opened_recipients: makeMetricCard('opened_recipients', 5, 'identity'),
      observed_clicks: makeMetricCard('observed_clicks', 3, 'identity'),
      messages_accepted: makeMetricCard('messages_accepted', 4, 'message'),
      messages_failed: makeMetricCard('messages_failed', 2, 'message'),
      direct_conversions: makeMetricCard('direct_conversions', 1, 'conversion'),
      assisted_conversions: makeMetricCard(
        'assisted_conversions',
        2,
        'conversion'
      ),
      no_coupon_conversions: makeMetricCard(
        'no_coupon_conversions',
        1,
        'conversion'
      ),
    },
  }
}

function makeMetricCard(
  key: RecallMetricKey,
  total: number,
  rowGrain: string
): RecallMetricCard {
  return {
    key,
    total,
    amounts: [],
    row_grain: rowGrain,
    snapshot: `${key}-snapshot`,
    legacy_unidentified_count: 0,
    drilldown_complete: true,
    supported_filters: { search: true },
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

function renderCampaignDetail(
  campaignType: RecallCampaignType,
  metrics: RecallCampaignMetrics = makeMetrics()
): string {
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
    data: metrics,
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

describe('CampaignDetail metric rendering', () => {
  test('renders opened users beside observed clicks from authoritative metric cards', () => {
    const metricsHtml = campaignMetricsMarkup(
      renderCampaignDetail('content_only')
    )

    expect(metricsHtml).toContain('Users who opened')
    expect(metricsHtml).toContain('>5</div>')
    expect(metricsHtml).toContain('Observed clicks')
    expect(metricsHtml).toContain('>3</div>')
    expect(metricsHtml).toContain('Direct conversions')
    expect(metricsHtml).not.toContain('>999</span>')
  })

  test('renders promotion conversion metric cards with backend totals', () => {
    const metricsHtml = campaignMetricsMarkup(renderCampaignDetail('promotion'))

    expect(metricsHtml).toContain('Users who opened')
    expect(metricsHtml).toContain('>5</div>')
    expect(metricsHtml).toContain('Observed clicks')
    expect(metricsHtml).toContain('>3</div>')
    expect(metricsHtml).toContain('Direct conversions')
    expect(metricsHtml).toContain('Assisted conversions')
    expect(metricsHtml).toContain('No-coupon conversions')
    expect(metricsHtml).not.toContain('>999</span>')
  })

  test('does not reconstruct cards from legacy fields when metric cards are absent', () => {
    const metrics = makeMetrics()
    delete metrics.metric_cards
    const metricsHtml = campaignMetricsMarkup(
      renderCampaignDetail('content_only', metrics)
    )

    expect(metricsHtml).toContain(
      'Campaign metric cards are not available yet.'
    )
    expect(metricsHtml).not.toContain('>999</span>')
  })
})

import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { api } from '@/lib/api'
import {
  createRecallCampaign,
  exportRecallCampaign,
  exportRecallCampaignMetricUsers,
  generateRecallEmailTranslations,
  getRecallActivitySMTPStatus,
  getLatestRecallEmailTranslationTask,
  getRecallCampaignExclusionBatch,
  getRecallEmailQuotaStatus,
  getRecallEmailTranslationTask,
  updateRecallEmailQuotaLimit,
  getRecallSubscriptionProductConfiguration,
  getRecallTopUpProductConfiguration,
  getRecallUserGroups,
  getRecallCampaign,
  getRecallCampaignMetrics,
  getRecallCampaignMetricUsers,
  listRecallAudienceUsers,
  listRecallCampaigns,
  listRecallEvents,
  listRecallRecipients,
  previewRecallEmail,
  previewRecallCampaign,
  previewRecallCampaignExclusions,
  recallCampaignKeys,
  retryRecallRecipient,
  runRecallCampaignAction,
  confirmRecallCampaignExclusionBatch,
  updateRecallCampaign,
  updateRecallActivitySMTP,
  validateRecallStripeConfig,
  RecallApiError,
} from './api'
import type {
  RecallActivitySMTPInput,
  RecallCampaignDraft,
  RecallEmailGenerationRequest,
  RecallMetricFilters,
  RecallMetricResult,
  RecallTranslationTask,
} from './types'

const originalAdapter = api.defaults.adapter
let capturedConfig: InternalAxiosRequestConfig | undefined

function respondWith(data: unknown, status = 200): void {
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    capturedConfig = config
    return {
      data,
      status,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    }
  }
}

afterEach(() => {
  api.defaults.adapter = originalAdapter
  capturedConfig = undefined
})

describe('recall campaign API contracts', () => {
  function makeZeroAudienceConfig(): RecallCampaignDraft['audience_config'] {
    return {
      registration_age_days: 0,
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
    }
  }

  function makeRecallDraft(): RecallCampaignDraft {
    return {
      campaign_type: 'content_only',
      name: 'Continuous recall',
      audience_template: '',
      audience_config: makeZeroAudienceConfig(),
      execution_mode: 'continuous',
      lifecycle_trigger: 'user_registered',
      lifecycle_trigger_config: {},
      schedule: {
        scheduled_at: 0,
        timezone: '',
        frequency: '',
        weekday: 0,
        hour: 0,
        minute: 0,
      },
      coupon_source: '',
      existing_coupon_id: '',
      discount_config: {
        type: 'percent',
        percent_off: 0,
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
      promotion_expiry_mode: '',
      promotion_expires_at: 0,
      promotion_valid_seconds: 0,
      enrollment_limit: 0,
      worker_concurrency: 1,
      email_sequence: [],
      defer_localization: false,
    }
  }

  function makeContinuousDraftWithStaleAudienceTemplate(): RecallCampaignDraft {
    const draft = makeRecallDraft()
    draft.audience_template = 'first_purchase'
    return draft
  }

  function makeContinuousDraftWithStaleCanonicalFields(): RecallCampaignDraft {
    const draft = makeRecallDraft()
    return {
      ...draft,
      campaign_type: 'promotion',
      audience_template: 'first_purchase',
      audience_config: {
        ...makeZeroAudienceConfig(),
        registration_age_days: 30,
        groups: ['paid'],
        group_mode: 'allow',
        require_verified_email: true,
      },
      schedule: {
        scheduled_at: 2_000_100_000,
        timezone: 'America/New_York',
        frequency: 'weekly',
        weekday: 5,
        hour: 18,
        minute: 45,
      },
      coupon_source: 'existing',
      existing_coupon_id: 'coupon_existing',
      discount_config: {
        type: 'fixed',
        percent_off: 0,
        amount_off: 500,
        currency: 'USD',
        currency_options: { eur: 450 },
        minimum_amount: 1000,
        minimum_amount_currency: 'USD',
      },
      product_scope: {
        topup_price_ids: ['price_topup_usd'],
        subscription_price_ids: ['price_sub_usd'],
      },
      promotion_expiry_mode: 'fixed',
      promotion_expires_at: 2_000_200_000,
      promotion_valid_seconds: 604_800,
      lifecycle_trigger_config: { stale: true } as Record<string, never>,
    }
  }

  function parseCapturedPayload(): Record<string, unknown> {
    return JSON.parse(String(capturedConfig?.data)) as Record<string, unknown>
  }

  function makeRecallCampaignDetail(
    lifecycleTriggerConfig: unknown
  ): Record<string, unknown> {
    return {
      id: 42,
      campaign_type: 'content_only',
      name: 'Continuous recall',
      status: 'draft',
      audience_template: '',
      execution_mode: 'continuous',
      lifecycle_trigger: 'user_registered',
      scheduled_at: 0,
      next_run_at: 0,
      coupon_source: '',
      stripe_coupon_id: '',
      promotion_expiry_mode: '',
      promotion_expires_at: 0,
      promotion_valid_seconds: 0,
      enrollment_limit: 0,
      worker_concurrency: 1,
      config_revision: 1,
      created_by: 1,
      created_at: 1,
      updated_at: 1,
      activated_at: 0,
      completed_at: 0,
      recipient_total: 0,
      draft: {
        ...makeRecallDraft(),
        lifecycle_trigger_config: lifecycleTriggerConfig,
      },
    }
  }

  test.each([
    ['create', () => createRecallCampaign(makeRecallDraft()), 'post'],
    ['update', () => updateRecallCampaign(42, makeRecallDraft()), 'put'],
    [
      'Stripe validation',
      () => validateRecallStripeConfig(makeRecallDraft()),
      'post',
    ],
  ])(
    'serializes lifecycle trigger config as a JSON string for %s',
    async (_name, call, method) => {
      respondWith({ success: true, data: {} })

      await call()

      const payload = parseCapturedPayload()
      expect(capturedConfig?.method).toBe(method)
      expect(payload.lifecycle_trigger_config).toBe('{}')
    }
  )

  test.each([
    [
      'create',
      () =>
        createRecallCampaign(makeContinuousDraftWithStaleAudienceTemplate()),
    ],
    [
      'update',
      () =>
        updateRecallCampaign(
          42,
          makeContinuousDraftWithStaleAudienceTemplate()
        ),
    ],
    [
      'Stripe validation',
      () =>
        validateRecallStripeConfig(
          makeContinuousDraftWithStaleAudienceTemplate()
        ),
    ],
  ])(
    'serializes continuous %s audience and discount as backend zero-value objects',
    async (_name, call) => {
      respondWith({ success: true, data: {} })

      await call()

      const payload = parseCapturedPayload()
      expect(payload.audience_template).toBe('')
      expect(payload.audience_config).toEqual({})
      expect(payload.discount_config).toEqual({})
    }
  )

  test('serializes continuous drafts with a complete canonical wire shape', async () => {
    respondWith({ success: true, data: {} })

    await createRecallCampaign(makeContinuousDraftWithStaleCanonicalFields())

    expect(parseCapturedPayload()).toMatchObject({
      campaign_type: 'content_only',
      audience_template: '',
      audience_config: {},
      discount_config: {},
      schedule: {
        scheduled_at: 0,
        timezone: '',
        frequency: '',
        weekday: 0,
        hour: 0,
        minute: 0,
      },
      coupon_source: '',
      existing_coupon_id: '',
      product_scope: { topup_price_ids: [], subscription_price_ids: [] },
      promotion_expiry_mode: '',
      promotion_expires_at: 0,
      promotion_valid_seconds: 0,
      lifecycle_trigger_config: '{}',
    })
  })

  test('preserves legacy audience and discount config while adapting a draft for the wire API', async () => {
    const draft = makeRecallDraft()
    draft.execution_mode = 'manual'
    draft.audience_template = 'first_purchase'
    draft.audience_config = {
      ...makeZeroAudienceConfig(),
      registration_age_days: 30,
      min_request_count: 3,
      payment_providers: ['stripe'],
      groups: ['paid'],
      group_mode: 'allow',
      require_verified_email: true,
    }
    draft.discount_config = {
      ...draft.discount_config,
      type: 'fixed',
      amount_off: 500,
      currency: 'USD',
      currency_options: { eur: 450 },
      minimum_amount: 1000,
      minimum_amount_currency: 'usd',
    }
    respondWith({ success: true, data: {} })

    await createRecallCampaign(draft)

    const payload = parseCapturedPayload()
    expect(payload.audience_template).toBe('first_purchase')
    expect(payload.audience_config).toEqual(draft.audience_config)
    expect(payload.discount_config).toEqual(draft.discount_config)
  })

  test('does not mutate a recall campaign draft while adapting it for the wire API', async () => {
    const draft = makeRecallDraft()
    const originalDraft = structuredClone(draft)
    respondWith({ success: true, data: {} })

    await createRecallCampaign(draft)

    expect(draft).toEqual(originalDraft)
    expect(draft.lifecycle_trigger_config).toEqual({})
  })

  test('decodes a lifecycle trigger config JSON string from campaign detail responses', async () => {
    const detail = makeRecallCampaignDetail('{"custom":true}')
    respondWith({ success: true, data: detail })

    const response = await getRecallCampaign(42)

    expect(response.data?.draft.lifecycle_trigger_config).toEqual({
      custom: true,
    })
    expect(
      (detail.draft as Record<string, unknown>).lifecycle_trigger_config
    ).toBe('{"custom":true}')
    expect(response.data).not.toBe(detail)
    expect(response.data?.draft).not.toBe(detail.draft)
  })

  test.each([
    ['blank', ''],
    ['missing', undefined],
  ])(
    'decodes a %s lifecycle trigger config from campaign detail responses as an empty object',
    async (_name, lifecycleTriggerConfig) => {
      const detail = makeRecallCampaignDetail(lifecycleTriggerConfig)
      if (lifecycleTriggerConfig === undefined) {
        delete (detail.draft as Record<string, unknown>)
          .lifecycle_trigger_config
      }
      respondWith({ success: true, data: detail })

      const response = await getRecallCampaign(42)

      expect(response.data?.draft.lifecycle_trigger_config).toEqual({})
    }
  )

  test('rejects malformed lifecycle trigger config JSON before campaign detail data reaches the UI', async () => {
    respondWith({
      success: true,
      data: makeRecallCampaignDetail('{not json'),
    })

    await expect(getRecallCampaign(42)).rejects.toThrow(
      'Invalid recall campaign lifecycle_trigger_config JSON'
    )
  })

  test.each([
    ['null', 'null'],
    ['array', '[]'],
    ['string', '"invalid"'],
  ])(
    'rejects non-object lifecycle trigger config JSON (%s) before campaign detail data reaches the UI',
    async (_name, lifecycleTriggerConfig) => {
      respondWith({
        success: true,
        data: makeRecallCampaignDetail(lifecycleTriggerConfig),
      })

      await expect(getRecallCampaign(42)).rejects.toThrow(
        'Invalid recall campaign lifecycle_trigger_config: expected JSON object'
      )
    }
  )

  test('keeps campaign detail failure envelope handling ahead of lifecycle trigger config decoding', async () => {
    respondWith({
      success: false,
      message: 'Campaign detail unavailable',
      data: makeRecallCampaignDetail('{not json'),
    })

    await expect(getRecallCampaign(42)).rejects.toThrow(
      'Campaign detail unavailable'
    )
  })

  test('loads configured top-up and subscription products from existing APIs', async () => {
    respondWith({ success: true, data: { stripe_price_ids: {} } })

    await getRecallTopUpProductConfiguration()
    expect(capturedConfig?.url).toBe('/api/user/topup/info')

    respondWith({ success: true, data: [] })
    await getRecallSubscriptionProductConfiguration()
    expect(capturedConfig?.url).toBe('/api/subscription/admin/plans')
  })

  test('loads configured user groups from the authoritative user-group API', async () => {
    respondWith({ success: true, data: ['admin'] })

    await getRecallUserGroups()

    expect(capturedConfig?.url).toBe('/api/group/')
    expect(capturedConfig?.params).toEqual({ type: 'user' })
  })

  test('loads recall audience users by trimmed keyword', async () => {
    respondWith({ success: true, data: [] })

    await listRecallAudienceUsers({ keyword: '  alice  ', ids: [1, 2] })

    expect(capturedConfig?.url).toBe('/api/recall-campaigns/audience-users')
    expect(capturedConfig?.params).toEqual({
      keyword: 'alice',
      page_size: 50,
    })
  })

  test('loads recall audience users by exact IDs', async () => {
    respondWith({ success: true, data: [] })

    await listRecallAudienceUsers({ ids: [2, 5] })

    expect(capturedConfig?.url).toBe('/api/recall-campaigns/audience-users')
    expect(capturedConfig?.params).toEqual({ ids: '2,5' })
  })

  test('uses p and ps for campaign list pagination', async () => {
    respondWith({ success: true, data: { items: [], total: 0 } })

    await listRecallCampaigns({ p: 2, ps: 40 })

    expect(capturedConfig?.params).toEqual({ p: 2, ps: 40 })
  })

  test('uses p and ps for recipient and event pagination', async () => {
    respondWith({ success: true, data: { items: [], total: 0 } })

    await listRecallRecipients(9, 3, 25)
    expect(capturedConfig?.params).toEqual({ p: 3, ps: 25, state: '' })

    await listRecallEvents(9, 4, 30)
    expect(capturedConfig?.params).toEqual({ p: 4, ps: 30 })
  })

  const draft = {} as RecallCampaignDraft
  test.each([
    ['list', () => listRecallCampaigns({})],
    ['create', () => createRecallCampaign(draft)],
    ['detail', () => getRecallCampaign(1)],
    ['update', () => updateRecallCampaign(1, draft)],
    ['preview', () => previewRecallCampaign(1)],
    [
      'email preview',
      () =>
        previewRecallEmail({
          template: { subject: 'Subject', body_html: '<p>Hello</p>' },
        }),
    ],
    ['Stripe validation', () => validateRecallStripeConfig(draft)],
    ['action', () => runRecallCampaignAction(1, 'pause')],
    ['recipients', () => listRecallRecipients(1, 1)],
    ['events', () => listRecallEvents(1, 1)],
    ['metrics', () => getRecallCampaignMetrics(1)],
    ['retry', () => retryRecallRecipient(1, 2, false)],
    ['audience users', () => listRecallAudienceUsers({ keyword: 'alice' })],
    ['top-up product configuration', getRecallTopUpProductConfiguration],
    [
      'subscription product configuration',
      getRecallSubscriptionProductConfiguration,
    ],
    ['user groups', getRecallUserGroups],
  ])('rejects a success:false envelope from %s', async (_name, call) => {
    respondWith({ success: false, message: 'Recall request failed' })

    await expect(call()).rejects.toThrow('Recall request failed')
  })

  test('serializes uncertain recipient retry acknowledgment in the request body', async () => {
    respondWith({ success: true })

    await retryRecallRecipient(42, 73, true)

    expect(capturedConfig?.url).toBe(
      '/api/recall-campaigns/42/recipients/73/retry'
    )
    expect(capturedConfig?.method).toBe('post')
    expect(JSON.parse(String(capturedConfig?.data))).toEqual({
      acknowledge_uncertain: true,
    })
  })

  test('rejects a JSON failure envelope returned from export as a Blob', async () => {
    respondWith(
      new Blob(
        [JSON.stringify({ success: false, message: 'Export unavailable' })],
        { type: 'application/json' }
      )
    )

    await expect(exportRecallCampaign(1)).rejects.toThrow('Export unavailable')
  })

  test('rejects non-envelope JSON returned from export as a Blob', async () => {
    respondWith(
      new Blob([JSON.stringify({ error: 'Export unavailable' })], {
        type: 'application/json',
      })
    )

    await expect(exportRecallCampaign(1)).rejects.toThrow(
      'Recall campaign export returned JSON instead of CSV'
    )
  })

  test('rejects empty-MIME JSON failure envelopes returned from CSV exports', async () => {
    respondWith(
      new Blob(
        [JSON.stringify({ success: false, message: 'Export unavailable' })],
        { type: '' }
      )
    )
    await expect(exportRecallCampaign(1)).rejects.toThrow('Export unavailable')

    respondWith(
      new Blob(
        [
          JSON.stringify({
            success: false,
            message: 'Metric export unavailable',
          }),
        ],
        { type: '' }
      )
    )
    await expect(
      exportRecallCampaignMetricUsers(42, 'messages_failed', {})
    ).rejects.toThrow('Metric export unavailable')
  })

  test('returns empty-MIME CSV exports without JSON envelope handling', async () => {
    const csv = new Blob(['email,amount\nalice@example.com,9600\n'], {
      type: '',
    })
    const text = mock(csv.text.bind(csv))
    Object.defineProperty(csv, 'text', { value: text })
    respondWith(csv)

    await expect(exportRecallCampaign(1)).resolves.toBe(csv)
    expect(text).not.toHaveBeenCalled()
  })

  test('loads metric users with metric and supplied filters in query params', async () => {
    const filters: RecallMetricFilters = {
      q: 'alice',
      stage_no: 2,
      state: 'converted',
      conversion_kind: 'direct',
      payment_category: 'direct_topup',
      currency: 'USD',
      snapshot: '2026-08-01T00:00:00Z',
      cursor: 'next-page',
      limit: 50,
    }
    const result: RecallMetricResult = {
      items: [],
      total: 0,
      amounts: [],
      snapshot: filters.snapshot,
      legacy_unidentified_count: 0,
      drilldown_complete: true,
    }
    respondWith({ success: true, data: result })

    await getRecallCampaignMetricUsers(42, 'direct_conversions', filters)

    expect(capturedConfig?.url).toBe('/api/recall-campaigns/42/metric-users')
    expect(capturedConfig?.method).toBe('get')
    expect(capturedConfig?.params).toEqual({
      metric: 'direct_conversions',
      ...filters,
    })
  })

  test('keeps the explicit metric argument ahead of a forged runtime filter metric', async () => {
    const forgedFilters = {
      metric: 'messages_failed',
      state: 'converted',
      currency: 'USD',
    } as RecallMetricFilters & { metric: string }
    respondWith({
      success: true,
      data: {
        items: [],
        total: 0,
        amounts: [],
        snapshot: '',
        legacy_unidentified_count: 0,
        drilldown_complete: true,
      },
    })

    await getRecallCampaignMetricUsers(42, 'direct_conversions', forgedFilters)

    expect(capturedConfig?.params).toEqual({
      ...forgedFilters,
      metric: 'direct_conversions',
    })
  })

  test('exports metric users with the same query contract and blob duplicate protection', async () => {
    const csv = new Blob(['email,amount\nalice@example.com,9600\n'], {
      type: 'text/csv',
    })
    const filters: RecallMetricFilters = {
      state: 'converted',
      currency: 'USD',
      snapshot: '2026-08-01T00:00:00Z',
      cursor: 'export-cursor',
      limit: 500,
    }
    respondWith(csv)

    const result = await exportRecallCampaignMetricUsers(
      42,
      'attributed_spend',
      filters
    )

    expect(result).toBe(csv)
    expect(capturedConfig?.url).toBe(
      '/api/recall-campaigns/42/metric-users/export'
    )
    expect(capturedConfig?.method).toBe('get')
    expect(capturedConfig?.responseType).toBe('blob')
    expect(capturedConfig?.disableDuplicate).toBe(true)
    expect(capturedConfig?.params).toEqual({
      metric: 'attributed_spend',
      ...filters,
    })
  })

  test('keeps the explicit export metric ahead of a forged runtime filter metric', async () => {
    const csv = new Blob(['email,amount\nalice@example.com,9600\n'], {
      type: 'text/csv',
    })
    const forgedFilters = {
      metric: 'messages_failed',
      currency: 'USD',
      snapshot: '2026-08-01T00:00:00Z',
    } as RecallMetricFilters & { metric: string }
    respondWith(csv)

    await exportRecallCampaignMetricUsers(42, 'attributed_spend', forgedFilters)

    expect(capturedConfig?.params).toEqual({
      ...forgedFilters,
      metric: 'attributed_spend',
    })
  })

  test('rejects a JSON failure envelope returned from metric export as a Blob', async () => {
    respondWith(
      new Blob(
        [
          JSON.stringify({
            success: false,
            message: 'Metric export unavailable',
          }),
        ],
        { type: 'application/json' }
      )
    )

    await expect(
      exportRecallCampaignMetricUsers(42, 'messages_failed', {})
    ).rejects.toThrow('Metric export unavailable')
  })

  test('previews exclusion uploads as multipart form data with a file field', async () => {
    const file = new File(['email\nalice@example.com\n'], 'exclusions.csv', {
      type: 'text/csv',
    })
    respondWith({
      success: true,
      data: {
        batch_id: 73,
        total_rows: 1,
        resolved_users: 1,
        duplicate_rows: 0,
        unresolved_rows: 0,
        conflict_rows: 0,
        blocking_errors: [],
        warnings: [],
        cancelable_work: 0,
        confirmable: true,
      },
    })

    await previewRecallCampaignExclusions(42, file)

    expect(capturedConfig?.url).toBe(
      '/api/recall-campaigns/42/exclusions/preview'
    )
    expect(capturedConfig?.method).toBe('post')
    expect(capturedConfig?.data).toBeInstanceOf(FormData)
    const uploaded = (capturedConfig?.data as FormData).get('file')
    expect(uploaded).toBeInstanceOf(File)
    expect((uploaded as File).name).toBe('exclusions.csv')
    expect((uploaded as File).type).toBe('text/csv')
    expect(await (uploaded as File).text()).toBe('email\nalice@example.com\n')
  })

  test('loads and confirms an exclusion batch', async () => {
    respondWith({
      success: true,
      data: {
        batch_id: 73,
        total_rows: 1,
        resolved_users: 1,
        duplicate_rows: 0,
        unresolved_rows: 0,
        conflict_rows: 0,
        blocking_errors: [],
        warnings: [],
        cancelable_work: 0,
        confirmable: true,
      },
    })

    await getRecallCampaignExclusionBatch(42, 73)
    expect(capturedConfig?.url).toBe(
      '/api/recall-campaigns/42/exclusions/batches/73'
    )
    expect(capturedConfig?.method).toBe('get')

    await confirmRecallCampaignExclusionBatch(42, 73)
    expect(capturedConfig?.url).toBe(
      '/api/recall-campaigns/42/exclusions/batches/73/confirm'
    )
    expect(capturedConfig?.method).toBe('post')
  })

  test('preserves structured failure data for activation recovery', async () => {
    const blockers = [{ stage_no: 1, locale: 'es', reason: 'stale' }]
    respondWith({
      success: false,
      message: 'Translations are not ready',
      data: { blockers },
    })

    try {
      await runRecallCampaignAction(9, 'activate')
      throw new Error('Expected activation to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(RecallApiError)
      expect((error as RecallApiError).data).toEqual({ blockers })
    }
  })

  test('posts campaign actions with local error handling enabled', async () => {
    respondWith({ success: true })

    await runRecallCampaignAction(9, 'activate')

    expect(capturedConfig?.url).toBe('/api/recall-campaigns/9/activate')
    expect(capturedConfig?.method).toBe('post')
    expect(capturedConfig?.skipBusinessError).toBe(true)
    expect(capturedConfig?.skipErrorHandler).toBe(true)
  })

  test('posts email preview requests with the template wrapper', async () => {
    respondWith({
      success: true,
      data: { subject: 'Subject', body_html: '<p>Hello</p>' },
    })

    await previewRecallEmail({
      campaign_type: 'content_only',
      template: { subject: 'Subject', body_html: '<p>Hello</p>' },
    })

    expect(capturedConfig?.url).toBe('/api/recall-campaigns/email-preview')
    expect(JSON.parse(String(capturedConfig?.data))).toEqual({
      campaign_type: 'content_only',
      template: { subject: 'Subject', body_html: '<p>Hello</p>' },
    })
  })

  test('posts Continuous email preview context with delivery policy and lifecycle trigger', async () => {
    respondWith({
      success: true,
      data: { subject: 'Subject', body_html: '<p>Trade preview-trade-no</p>' },
    })

    await previewRecallEmail({
      campaign_type: 'content_only',
      delivery_policy: 'service',
      lifecycle_trigger: 'payment_succeeded',
      template: {
        subject: 'Subject',
        body_html: '<p>{{.trade_no}}</p>',
      },
    })

    expect(JSON.parse(String(capturedConfig?.data))).toEqual({
      campaign_type: 'content_only',
      delivery_policy: 'service',
      lifecycle_trigger: 'payment_succeeded',
      template: { subject: 'Subject', body_html: '<p>{{.trade_no}}</p>' },
    })
  })

  test('generates all email translations with the campaign revision', async () => {
    const request: RecallEmailGenerationRequest = {
      config_revision: 7,
      name: 'Win back customers',
      email_sequence: [],
    }
    respondWith({ success: true, data: request })

    await generateRecallEmailTranslations(42, request)

    expect(capturedConfig?.url).toBe(
      '/api/recall-campaigns/42/email-translations/generate'
    )
    expect(JSON.parse(String(capturedConfig?.data))).toEqual(request)
  })

  test('starts an email translation task from the HTTP 202 success envelope', async () => {
    const request: RecallEmailGenerationRequest = {
      config_revision: 7,
      name: 'Win back customers',
      email_sequence: [],
    }
    const task: RecallTranslationTask = {
      id: 55,
      campaign_id: 42,
      status: 'queued',
      requested_config_revision: 7,
      attempt_count: 0,
      created_at: 1_900_000_000,
      started_at: 0,
    }
    respondWith({ success: true, data: task }, 202)

    const response = await generateRecallEmailTranslations(42, request)

    expect(capturedConfig?.url).toBe(
      '/api/recall-campaigns/42/email-translations/generate'
    )
    expect(response.data).toEqual(task)
  })

  test('loads email translation tasks by id and latest campaign task', async () => {
    const task: RecallTranslationTask = {
      id: 55,
      campaign_id: 42,
      status: 'succeeded',
      requested_config_revision: 7,
      result_config_revision: 8,
      attempt_count: 1,
      created_at: 1_900_000_000,
      started_at: 1_900_000_000,
      finished_at: 1_900_000_001,
    }
    respondWith({ success: true, data: task })

    await getRecallEmailTranslationTask(42, 55)
    expect(capturedConfig?.url).toBe(
      '/api/recall-campaigns/42/email-translations/tasks/55'
    )
    expect(capturedConfig?.method).toBe('get')

    await getLatestRecallEmailTranslationTask(42)
    expect(capturedConfig?.url).toBe(
      '/api/recall-campaigns/42/email-translations/tasks/latest'
    )
    expect(capturedConfig?.method).toBe('get')
  })

  test('accepts a missing latest email translation task as null data', async () => {
    const emptyLatestTaskResponse: Awaited<
      ReturnType<typeof getLatestRecallEmailTranslationTask>
    > = { success: true, data: null }
    respondWith(emptyLatestTaskResponse)

    const response = await getLatestRecallEmailTranslationTask(42)

    expect(capturedConfig?.url).toBe(
      '/api/recall-campaigns/42/email-translations/tasks/latest'
    )
    expect(capturedConfig?.method).toBe('get')
    expect(response.data).toBeNull()
  })

  test('exposes stable email translation task query keys', () => {
    expect(recallCampaignKeys.translationTask(42, 55)).toEqual([
      'recall-campaigns',
      42,
      'email-translations',
      'tasks',
      55,
    ])
    expect(recallCampaignKeys.latestTranslationTask(42)).toEqual([
      'recall-campaigns',
      42,
      'email-translations',
      'tasks',
      'latest',
    ])
  })

  test('loads the activity email quota from its dedicated endpoint', async () => {
    respondWith({
      success: true,
      data: {
        limit: 100,
        used: 12,
        remaining: 88,
        window_started_at: 1_900_000_000,
        resets_at: 1_900_003_600,
        exhausted: false,
      },
    })

    await getRecallEmailQuotaStatus()

    expect(capturedConfig?.url).toBe('/api/recall-campaigns/email-quota')
  })

  test('updates the activity email quota through its admin-scoped endpoint', async () => {
    respondWith({
      success: true,
      data: {
        limit: 250,
        used: 12,
        remaining: 238,
        window_started_at: 1_900_000_000,
        resets_at: 1_900_003_600,
        exhausted: false,
      },
    })

    await updateRecallEmailQuotaLimit(250)

    expect(capturedConfig?.url).toBe('/api/recall-campaigns/email-quota')
    expect(capturedConfig?.method).toBe('put')
    expect(JSON.parse(String(capturedConfig?.data))).toEqual({ limit: 250 })
  })

  test('uses a stable query key for the dedicated activity SMTP settings', () => {
    expect(recallCampaignKeys.smtp).toEqual(['recall-campaigns', 'smtp'])
  })

  test('loads redacted activity SMTP status from the dedicated endpoint', async () => {
    respondWith({
      success: true,
      data: {
        server: 'smtp.example.com',
        port: 465,
        account: 'activity-user',
        email_from: 'activity@example.com',
        ssl_enabled: true,
        force_auth_login: true,
        token_configured: true,
        configured: true,
      },
    })

    const response = await getRecallActivitySMTPStatus()

    expect(capturedConfig?.url).toBe('/api/recall-campaigns/smtp')
    expect(capturedConfig?.method).toBe('get')
    expect(response.data).toEqual({
      server: 'smtp.example.com',
      port: 465,
      account: 'activity-user',
      email_from: 'activity@example.com',
      ssl_enabled: true,
      force_auth_login: true,
      token_configured: true,
      configured: true,
    })
    expect(response.data).not.toHaveProperty('token')
  })

  test('updates activity SMTP with the complete input and never reads token from status', async () => {
    const input: RecallActivitySMTPInput = {
      server: 'smtp.example.com',
      port: 587,
      account: 'activity-user',
      email_from: 'activity@example.com',
      token: ' real password bytes ',
      ssl_enabled: false,
      force_auth_login: true,
      reply_to: 'support@example.com',
      unsubscribe_mailto: 'mailto:unsubscribe@example.com',
    }
    respondWith({
      success: true,
      data: {
        server: input.server,
        port: input.port,
        account: input.account,
        email_from: input.email_from,
        ssl_enabled: input.ssl_enabled,
        force_auth_login: input.force_auth_login,
        token_configured: true,
        configured: true,
      },
    })

    const response = await updateRecallActivitySMTP(input)

    expect(capturedConfig?.url).toBe('/api/recall-campaigns/smtp')
    expect(capturedConfig?.method).toBe('put')
    expect(capturedConfig?.skipBusinessError).toBe(true)
    expect(capturedConfig?.skipErrorHandler).toBe(true)
    expect(JSON.parse(String(capturedConfig?.data))).toEqual(input)
    expect(response.data).not.toHaveProperty('token')
  })
})

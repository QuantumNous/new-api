import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'
import { api } from '@/lib/api'
import {
  createRecallCampaign,
  exportRecallCampaign,
  generateRecallEmailTranslations,
  getRecallActivitySMTPStatus,
  getRecallEmailQuotaStatus,
  updateRecallEmailQuotaLimit,
  getRecallSubscriptionProductConfiguration,
  getRecallTopUpProductConfiguration,
  getRecallUserGroups,
  getRecallCampaign,
  getRecallCampaignMetrics,
  listRecallAudienceUsers,
  listRecallCampaigns,
  listRecallEvents,
  listRecallRecipients,
  previewRecallEmail,
  previewRecallCampaign,
  recallCampaignKeys,
  retryRecallRecipient,
  runRecallCampaignAction,
  updateRecallCampaign,
  updateRecallActivitySMTP,
  validateRecallStripeConfig,
  RecallApiError,
} from './api'
import type {
  RecallActivitySMTPInput,
  RecallCampaignDraft,
  RecallEmailGenerationRequest,
} from './types'

const originalAdapter = api.defaults.adapter
let capturedConfig: InternalAxiosRequestConfig | undefined

function respondWith(data: unknown): void {
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    capturedConfig = config
    return {
      data,
      status: 200,
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

  test('rejects a JSON failure envelope returned from export as a Blob', async () => {
    respondWith(
      new Blob(
        [JSON.stringify({ success: false, message: 'Export unavailable' })],
        { type: 'application/json' }
      )
    )

    await expect(exportRecallCampaign(1)).rejects.toThrow('Export unavailable')
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

import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'
import { api } from '@/lib/api'
import {
  createRecallCampaign,
  exportRecallCampaign,
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
  retryRecallRecipient,
  runRecallCampaignAction,
  updateRecallCampaign,
  validateRecallStripeConfig,
} from './api'
import type { RecallCampaignDraft } from './types'

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

  test('posts email preview requests with the template wrapper', async () => {
    respondWith({
      success: true,
      data: { subject: 'Subject', body_html: '<p>Hello</p>' },
    })

    await previewRecallEmail({
      template: { subject: 'Subject', body_html: '<p>Hello</p>' },
    })

    expect(capturedConfig?.url).toBe('/api/recall-campaigns/email-preview')
    expect(JSON.parse(String(capturedConfig?.data))).toEqual({
      template: { subject: 'Subject', body_html: '<p>Hello</p>' },
    })
  })
})

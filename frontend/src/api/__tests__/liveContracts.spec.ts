import { describe, expect, it } from 'vitest'

import {
  parseLogPage,
  parseLogStat,
  parsePerfMetricsSummary,
  parsePricingModels,
  parseRedeemedQuota,
  parseTokenPage,
  parseTopupInfo,
  parseTopupPage,
  parseUsageRows,
  parseUserModels,
} from '@/api/liveContracts'

function expectInvalidResponse(parse: () => unknown): void {
  try {
    parse()
    throw new Error('expected INVALID_RESPONSE')
  } catch (error) {
    expect(error).toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
    })
  }
}

describe('live API contracts', () => {
  it('parses user models in both supported backend shapes', () => {
    expect(parseUserModels(['gpt-4o', 'claude-3-7-sonnet'])).toEqual([
      'gpt-4o',
      'claude-3-7-sonnet',
    ])
    expect(parseUserModels({ models: [] })).toEqual([])
    expectInvalidResponse(() => parseUserModels({ models: [1] }))
  })

  it('parses model pricing and performance summaries with optional metadata', () => {
    expect(
      parsePricingModels([
        {
          model_name: 'gpt-4o',
          description: 'Fast model',
          quota_type: 0,
          model_ratio: 0.5,
          completion_ratio: 1.2,
          cache_ratio: 0.25,
          owner_by: 'OpenAI',
          supported_endpoint_types: ['chat'],
          enable_groups: ['default'],
        },
      ])[0]
    ).toMatchObject({
      model_name: 'gpt-4o',
      model_ratio: 0.5,
      cache_ratio: 0.25,
      owner_by: 'OpenAI',
    })
    expect(
      parsePerfMetricsSummary({
        models: [
          {
            model_name: 'gpt-4o',
            avg_latency_ms: 850,
            success_rate: 99.5,
            avg_tps: 42,
          },
        ],
      })[0]
    ).toEqual({
      model_name: 'gpt-4o',
      avg_latency_ms: 850,
      success_rate: 99.5,
      avg_tps: 42,
    })
    expectInvalidResponse(() => parsePricingModels([{ model_name: 'gpt-4o' }]))
    expectInvalidResponse(() => parsePerfMetricsSummary({ models: [{}] }))
  })

  it('parses the log overview contract and rejects missing fields', () => {
    expect(
      parseLogStat({
        total_requests: 20,
        total_quota: 500,
        today_requests: 2,
        today_quota: 70,
      })
    ).toEqual({
      total_requests: 20,
      total_quota: 500,
      today_requests: 2,
      today_quota: 70,
    })
    expectInvalidResponse(() => parseLogStat({ quota: 500 }))
  })

  it('preserves backend token groups and safely normalizes legacy fields', () => {
    const page = parseTokenPage({
      page: 1,
      page_size: 20,
      total: 1,
      items: [
        {
          id: 7,
          name: 'vip-key',
          key: 'sk-12**********7890',
          group: 'vip',
          status: 1,
          used_quota: 120,
          remain_quota: 880,
          unlimited_quota: false,
          model_limits_enabled: true,
          model_limits: 'gpt-4o, claude-3-7-sonnet',
          allow_ips: '127.0.0.1\n10.0.0.1',
          expired_time: -1,
          created_time: 1_700_000_000,
        },
      ],
    })

    expect(page.items[0]).toMatchObject({
      group: 'vip',
      type: 'manual',
      model_limits: ['gpt-4o', 'claude-3-7-sonnet'],
      ip_limits: ['127.0.0.1', '10.0.0.1'],
    })
    expect(
      parseTokenPage({ page: 1, page_size: 20, total: 0, items: [] }).items
    ).toEqual([])
    expectInvalidResponse(() =>
      parseTokenPage({ page: 1, page_size: 20, total: 1, items: [{}] })
    )
  })

  it('parses usage rows and rejects missing required fields', () => {
    expect(
      parseUsageRows([
        {
          model_name: 'gpt-4o',
          created_at: 1_700_000_000,
          count: 2,
          quota: 300,
          token_used: 42,
        },
      ])
    ).toEqual([
      {
        model_name: 'gpt-4o',
        created_at: 1_700_000_000,
        count: 2,
        quota: 300,
        token_used: 42,
      },
    ])
    expect(parseUsageRows([])).toEqual([])
    expectInvalidResponse(() => parseUsageRows([{ model_name: 'gpt-4o' }]))
  })

  it('parses wallet capabilities, top-up records, and redeemed quota', () => {
    const info = parseTopupInfo({
      enable_online_topup: true,
      enable_stripe_topup: true,
      enable_creem_topup: false,
      enable_waffo_topup: true,
      enable_waffo_pancake_topup: false,
      enable_redemption: true,
      pay_methods: [
        { name: 'Stripe', type: 'stripe', min_topup: '5' },
        { name: 'Waffo', type: 'waffo', min_topup: 10 },
      ],
      min_topup: 1,
      stripe_min_topup: 5,
      waffo_min_topup: 10,
      waffo_pancake_min_topup: 20,
      amount_options: [5, '10'],
    })
    expect(info.pay_methods).toEqual([
      { name: 'Stripe', type: 'stripe', min_topup: 5, color: undefined },
      { name: 'Waffo', type: 'waffo', min_topup: 10, color: undefined },
    ])
    expect(info.amount_options).toEqual([5, 10])

    const page = parseTopupPage({
      page: 1,
      page_size: 20,
      total: 1,
      items: [
        {
          id: 9,
          trade_no: 'trade-9',
          amount: 500_000,
          money: 5.25,
          payment_method: 'card',
          payment_provider: 'stripe',
          status: 'success',
          create_time: 1_700_000_000,
        },
      ],
    })
    expect(page.items[0]).toMatchObject({
      amount: 5.25,
      money: 500_000,
      method: 'stripe',
      provider: 'stripe',
      created: 1_700_000_000,
    })
    expect(parseRedeemedQuota(500_000)).toBe(500_000)
    expect(parseRedeemedQuota({ quota: 250_000 })).toBe(250_000)
    expectInvalidResponse(() => parseTopupInfo({}))
    expectInvalidResponse(() => parseRedeemedQuota({ amount: 1 }))
  })

  it('parses safe user log DTOs without requiring internal channel fields', () => {
    const page = parseLogPage({
      page: 1,
      page_size: 20,
      total: 1,
      items: [
        {
          id: 11,
          type: 2,
          token_name: 'app-key',
          model_name: 'gpt-4o',
          channel_name: 'OpenAI',
          prompt_tokens: 10,
          completion_tokens: 20,
          other: '{"frt":250}',
          quota: 300,
          use_time: 1000,
          is_stream: true,
          content: '',
          created_at: 1_700_000_000,
        },
      ],
    })

    expect(page.items[0]).toMatchObject({
      type: 'consume',
      channel: 'OpenAI',
      latency: 1,
      first_token_latency: 0.25,
      request_mode: 'stream',
      tps: 20,
    })
    expect(
      parseLogPage({ page: 1, page_size: 20, total: 0, items: [] }).items
    ).toEqual([])
    expectInvalidResponse(() =>
      parseLogPage({
        page: 1,
        page_size: 20,
        total: 1,
        items: [{ id: 1, type: 2 }],
      })
    )
  })
})

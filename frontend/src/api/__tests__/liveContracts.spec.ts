import { describe, expect, it } from 'vitest'

import {
  parseDrawingLogPage,
  parseLogPage,
  parseLogStat,
  parsePerfMetricsSummary,
  parsePricingModels,
  parseRedeemedQuota,
  parseTaskLogPage,
  parseTokenPage,
  parseTopupInfo,
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
      enable_redemption: true,
      pay_methods: [
        { name: 'Alipay', type: 'alipay', min_topup: '5' },
        { name: 'WeChat Pay', type: 'wxpay', min_topup: 10 },
      ],
      min_topup: 1,
      amount_options: [5, '10'],
    })
    expect(info.pay_methods).toEqual([
      { name: 'Alipay', type: 'alipay', min_topup: 5, color: undefined },
      { name: 'WeChat Pay', type: 'wxpay', min_topup: 10, color: undefined },
    ])
    expect(info.amount_options).toEqual([5, 10])

    expect(parseRedeemedQuota(500_000)).toBe(500_000)
    expect(parseRedeemedQuota({ quota: 250_000 })).toBe(250_000)
    expectInvalidResponse(() => parseTopupInfo({}))
    expectInvalidResponse(() =>
      parseTopupInfo({
        pay_methods: [],
        min_topup: 0,
        amount_options: [10],
      })
    )
    expectInvalidResponse(() =>
      parseTopupInfo({
        pay_methods: [],
        min_topup: 1,
        amount_options: [-10],
      })
    )
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

  it('parses drawing logs, defaults optional fields, and keeps unknown statuses', () => {
    const page = parseDrawingLogPage({
      page: 1,
      page_size: 20,
      total: 1,
      items: [
        {
          id: 3,
          mj_id: '1719923456789',
          action: 'IMAGINE',
          prompt: 'a red fox',
          prompt_en: 'a red fox',
          status: 'SUCCESS',
          progress: '100%',
          fail_reason: '',
          image_url: 'https://cdn.example.com/fox.png',
          quota: 5000,
          submit_time: 1_700_000_000_000,
          finish_time: 1_700_000_060_000,
        },
      ],
    })

    expect(page.items[0]).toMatchObject({
      mj_id: '1719923456789',
      action: 'IMAGINE',
      status: 'SUCCESS',
      image_url: 'https://cdn.example.com/fox.png',
      video_url: '',
      submit_time: 1_700_000_000_000,
    })

    const futureStatus = parseDrawingLogPage({
      page: 1,
      page_size: 20,
      total: 1,
      items: [{ id: 4, status: 'BRAND_NEW_STATE' }],
    })
    expect(futureStatus.items[0]).toMatchObject({
      status: 'BRAND_NEW_STATE',
      quota: 0,
      finish_time: 0,
    })

    expect(
      parseDrawingLogPage({ page: 1, page_size: 20, total: 0, items: [] }).items
    ).toEqual([])
    expectInvalidResponse(() =>
      parseDrawingLogPage({
        page: 1,
        page_size: 20,
        total: 1,
        items: [{ mj_id: 'no-id' }],
      })
    )
  })

  it('parses relay task logs including optional result URLs', () => {
    const page = parseTaskLogPage({
      page: 1,
      page_size: 20,
      total: 2,
      items: [
        {
          id: 9,
          task_id: 'suno-abc',
          platform: 'suno',
          action: 'MUSIC',
          status: 'SUCCESS',
          progress: '100%',
          fail_reason: '',
          result_url: 'https://cdn.example.com/song.mp3',
          quota: 12_000,
          submit_time: 1_700_000_000,
          finish_time: 1_700_000_090,
        },
        {
          id: 10,
          task_id: 'kling-def',
          platform: 'kling',
          action: 'VIDEO',
          status: 'FAILURE',
          progress: '0%',
          fail_reason: 'upstream timeout',
          quota: 0,
          submit_time: 1_700_000_100,
          finish_time: 0,
        },
      ],
    })

    expect(page.items[0]).toMatchObject({
      task_id: 'suno-abc',
      platform: 'suno',
      result_url: 'https://cdn.example.com/song.mp3',
    })
    expect(page.items[1]).toMatchObject({
      status: 'FAILURE',
      fail_reason: 'upstream timeout',
      result_url: '',
    })
    expectInvalidResponse(() =>
      parseTaskLogPage({
        page: 1,
        page_size: 20,
        total: 1,
        items: [{ task_id: 'missing-id' }],
      })
    )
  })
})

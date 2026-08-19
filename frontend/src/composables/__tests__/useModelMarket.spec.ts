import { describe, expect, it } from 'vitest'

import { buildLiveModelCatalog } from '@/composables/useModelMarket'
import { vendorMeta } from '@/constants/console'

describe('live model market adapter', () => {
  it('combines pricing and performance without dropping models lacking metrics', () => {
    const catalog = buildLiveModelCatalog(
      ['gpt-4o', 'text-embedding-3-small'],
      [
        {
          model_name: 'gpt-4o',
          description: 'General model',
          icon: '',
          tags: '',
          vendor_id: 1,
          quota_type: 0,
          model_ratio: 0.5,
          model_price: 0,
          owner_by: 'OpenAI',
          completion_ratio: 1.2,
          cache_ratio: 0.25,
          create_cache_ratio: 0.5,
          enable_groups: [],
          supported_endpoint_types: ['chat'],
          billing_mode: '',
        },
        {
          model_name: 'text-embedding-3-small',
          description: '',
          icon: '',
          tags: '',
          vendor_id: 0,
          quota_type: 1,
          model_ratio: 0,
          model_price: 0.0001,
          owner_by: '',
          completion_ratio: 0,
          cache_ratio: 0.5,
          create_cache_ratio: 0.75,
          enable_groups: [],
          supported_endpoint_types: ['embeddings'],
          billing_mode: '',
        },
      ],
      [
        {
          model_name: 'gpt-4o',
          avg_latency_ms: 800,
          success_rate: 98,
          avg_tps: 40,
        },
      ]
    )

    expect(catalog.vendors).toEqual(['OpenAI', '平台'])
    expect(catalog).not.toHaveProperty('channels')
    expect(catalog.models[0]).toMatchObject({
      type: 'chat',
      billing: 'token',
      price: {
        input: 1,
        output: 1.2,
        cache_read: 0.25,
        cache_write: 0.5,
      },
      latency: 0.8,
      tps: 40,
      health: 98,
    })
    expect(catalog.models[1]).toMatchObject({
      type: 'embedding',
      billing: 'per_call',
      price: { per_call: 0.0001 },
      health: 0,
    })
    expect(catalog.models[1].price).not.toHaveProperty('cache_read')
    expect(catalog.models[1].price).not.toHaveProperty('cache_write')
  })

  it('preserves canonical Model Lab vendor names from pricing', () => {
    const vendors = [
      'Alibaba',
      'Moonshot AI',
      'Zhipu AI',
      'Bytedance Seed',
      'Tencent',
    ]
    const catalog = buildLiveModelCatalog(
      vendors.map((vendor) => `model-${vendor}`),
      vendors.map((vendor) => ({
        model_name: `model-${vendor}`,
        description: '',
        icon: '',
        tags: '',
        vendor_id: 1,
        quota_type: 0,
        model_ratio: 1,
        model_price: 0,
        owner_by: vendor,
        completion_ratio: 1,
        cache_ratio: null,
        create_cache_ratio: null,
        enable_groups: [],
        supported_endpoint_types: ['chat'],
        billing_mode: '',
      })),
      []
    )

    expect(catalog.vendors).toEqual(vendors)
    for (const vendor of vendors) expect(vendorMeta[vendor]).toBeTruthy()
  })

  it('hides only strict GPT Compact virtual models from the market', () => {
    const names = [
      'gpt-5.3-codex',
      'gpt-5.3-codex-openai-compact',
      'claude-3-openai-compact',
      'gpt--openai-compact',
      'gpt-5.3-openai-compact-preview',
    ]
    const catalog = buildLiveModelCatalog(
      names,
      names.map((name, index) => ({
        model_name: name,
        description: '',
        icon: '',
        tags: '',
        vendor_id: index + 1,
        quota_type: 0,
        model_ratio: 1,
        model_price: 0,
        owner_by:
          name === 'gpt-5.3-codex-openai-compact' ? 'Virtual' : 'OpenAI',
        completion_ratio: 1,
        cache_ratio: null,
        create_cache_ratio: null,
        enable_groups: [],
        supported_endpoint_types: ['chat'],
        billing_mode: '',
      })),
      []
    )

    expect(catalog.models.map((model) => model.name)).toEqual([
      'gpt-5.3-codex',
      'claude-3-openai-compact',
      'gpt--openai-compact',
      'gpt-5.3-openai-compact-preview',
    ])
    expect(catalog.vendors).toEqual(['OpenAI'])
  })

  it('preserves zero cache-write prices and omits unavailable cache prices', () => {
    const catalog = buildLiveModelCatalog(
      ['zero-cache-write', 'missing-cache-write'],
      [
        {
          model_name: 'zero-cache-write',
          description: '',
          icon: '',
          tags: '',
          vendor_id: 1,
          quota_type: 0,
          model_ratio: 2,
          model_price: 0,
          owner_by: 'OpenAI',
          completion_ratio: 3,
          cache_ratio: 0.25,
          create_cache_ratio: 0,
          enable_groups: [],
          supported_endpoint_types: ['chat'],
          billing_mode: '',
        },
        {
          model_name: 'missing-cache-write',
          description: '',
          icon: '',
          tags: '',
          vendor_id: 1,
          quota_type: 0,
          model_ratio: 2,
          model_price: 0,
          owner_by: 'OpenAI',
          completion_ratio: 3,
          cache_ratio: null,
          create_cache_ratio: null,
          enable_groups: [],
          supported_endpoint_types: ['chat'],
          billing_mode: '',
        },
      ],
      []
    )

    expect(catalog.models[0].price).toEqual({
      input: 4,
      output: 12,
      cache_read: 1,
      cache_write: 0,
    })
    expect(catalog.models[1].price).toEqual({ input: 4, output: 12 })
  })
})

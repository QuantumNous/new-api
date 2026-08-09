import { describe, expect, it } from 'vitest'

import { buildLiveModelCatalog } from '@/composables/useModelMarket'

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
          cache_ratio: null,
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
    expect(catalog.models[0]).toMatchObject({
      type: 'chat',
      billing: 'token',
      price: { input: 1, output: 1.2, cache_read: 0.25 },
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
  })
})

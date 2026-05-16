import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { inferModelMetadata } from './model-metadata'
import type { PricingModel } from '../types'

function pricingModel(overrides: Partial<PricingModel>): PricingModel {
  return {
    id: 1,
    model_name: 'unknown-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: [],
    supported_endpoint_types: ['anthropic', 'openai'],
    ...overrides,
  }
}

describe('inferModelMetadata', () => {
  test('parses token limits from model descriptions before name heuristics', () => {
    const metadata = inferModelMetadata(
      pricingModel({
        model_name: 'gpt-5.5',
        description:
          'GPT-5.5 is OpenAI\'s newest frontier API model for the most complex professional work, with text and image input, text output, a 1,050,000-token context window, and up to 128,000 output tokens.',
        supported_endpoint_types: ['openai'],
      })
    )

    assert.equal(metadata.context_length, 1_050_000)
    assert.equal(metadata.max_output_tokens, 128_000)
    assert.equal(metadata.knowledge_cutoff, undefined)
    assert.equal(metadata.release_date, undefined)
  })

  test('uses known Claude metadata instead of random fallback buckets', () => {
    const sonnet = inferModelMetadata(
      pricingModel({ model_name: 'claude-sonnet-4-6' })
    )
    assert.equal(sonnet.context_length, 1_000_000)
    assert.equal(sonnet.max_output_tokens, 64_000)

    const opus = inferModelMetadata(
      pricingModel({ model_name: 'claude-opus-4-7' })
    )
    assert.equal(opus.context_length, 1_000_000)
    assert.equal(opus.max_output_tokens, 128_000)

    const haiku = inferModelMetadata(
      pricingModel({ model_name: 'claude-haiku-4-5-20251001' })
    )
    assert.equal(haiku.context_length, 200_000)
    assert.equal(haiku.max_output_tokens, 64_000)
  })

  test('does not invent release or knowledge dates without explicit metadata', () => {
    const metadata = inferModelMetadata(
      pricingModel({ model_name: 'unknown-vendor-model' })
    )

    assert.equal(metadata.knowledge_cutoff, undefined)
    assert.equal(metadata.release_date, undefined)
  })
})

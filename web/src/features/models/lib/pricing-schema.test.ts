import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { HFPipelineTag } from './hf-taxonomy'
import {
  PIPELINE_TAG_TO_KIND,
  PRICING_KINDS,
  getKindLabelKey,
  getPriceUnitKey,
  getSchemaFields,
  normalizePricingKind,
  type PricingKind,
} from './pricing-schema'

/**
 * These tests protect the mapping contract between HF pipeline_tag (which
 * the model-name inference layer returns) and PricingKind (which the drawer
 * uses to pick fields). If the two vocabularies drift apart, the drawer
 * silently shows the wrong fields for a whole class of models.
 */
describe('pricing-schema — pipeline_tag → PricingKind mapping', () => {
  test('image generation models land on image-gen', () => {
    assert.equal(PIPELINE_TAG_TO_KIND['text-to-image'], 'image-gen')
    assert.equal(PIPELINE_TAG_TO_KIND['image-to-image'], 'image-gen')
  })

  test('video generation models land on video-gen', () => {
    assert.equal(PIPELINE_TAG_TO_KIND['text-to-video'], 'video-gen')
    assert.equal(PIPELINE_TAG_TO_KIND['image-to-video'], 'video-gen')
    assert.equal(PIPELINE_TAG_TO_KIND['video-to-video'], 'video-gen')
  })

  test('multimodal chat models land on multimodal-chat', () => {
    assert.equal(PIPELINE_TAG_TO_KIND['image-text-to-text'], 'multimodal-chat')
    assert.equal(PIPELINE_TAG_TO_KIND['video-text-to-text'], 'multimodal-chat')
    assert.equal(PIPELINE_TAG_TO_KIND['any-to-any'], 'multimodal-chat')
  })

  test('embedding-family models land on embedding', () => {
    assert.equal(PIPELINE_TAG_TO_KIND['feature-extraction'], 'embedding')
    assert.equal(PIPELINE_TAG_TO_KIND['sentence-similarity'], 'embedding')
    assert.equal(PIPELINE_TAG_TO_KIND['text-ranking'], 'embedding')
  })

  test('speech recognition → audio-in, TTS → audio-out', () => {
    assert.equal(
      PIPELINE_TAG_TO_KIND['automatic-speech-recognition'],
      'audio-in'
    )
    assert.equal(PIPELINE_TAG_TO_KIND['text-to-speech'], 'audio-out')
    assert.equal(PIPELINE_TAG_TO_KIND['audio-to-audio'], 'audio-out')
  })

  test('every HF pipeline tag has a mapping (no undefined)', () => {
    const seen: HFPipelineTag[] = Object.keys(
      PIPELINE_TAG_TO_KIND
    ) as HFPipelineTag[]
    for (const tag of seen) {
      const kind = PIPELINE_TAG_TO_KIND[tag]
      assert.ok(
        (PRICING_KINDS as readonly string[]).includes(kind),
        `pipeline_tag "${tag}" mapped to unknown kind "${kind}"`
      )
    }
  })
})

describe('pricing-schema — normalize + getters', () => {
  test('normalizePricingKind falls back to chat', () => {
    assert.equal(normalizePricingKind(undefined), 'chat')
    assert.equal(normalizePricingKind(null), 'chat')
    assert.equal(normalizePricingKind(''), 'chat')
    assert.equal(normalizePricingKind('unknown'), 'chat')
    assert.equal(normalizePricingKind('CHAT'), 'chat', 'case sensitive')
    assert.equal(normalizePricingKind('chat'), 'chat')
    assert.equal(normalizePricingKind('video-gen'), 'video-gen')
  })

  test('getSchemaFields returns disjoint sets per kind', () => {
    // Sanity check: video-gen shows NO token ratio fields, chat shows NO
    // video fields. If the drawer stops honoring the field list, admins
    // could accidentally see ratio inputs on an image model.
    const videoFields = new Set(getSchemaFields('video-gen'))
    assert.ok(!videoFields.has('ratio' as never))
    assert.ok(!videoFields.has('completionRatio' as never))
    assert.ok(videoFields.has('videoPricePerSecond'))
    assert.ok(videoFields.has('videoResolutionMultipliers'))

    const chatFields = new Set(getSchemaFields('chat'))
    assert.ok(chatFields.has('ratio' as never))
    assert.ok(!chatFields.has('videoPricePerSecond' as never))
  })

  test('embedding has ratio only — no completion / cache / image / audio', () => {
    const fields = getSchemaFields('embedding')
    assert.deepEqual(fields, ['ratio'])
  })

  test('getPriceUnitKey returns natural billing units', () => {
    assert.equal(getPriceUnitKey('image-gen'), 'per image')
    assert.equal(getPriceUnitKey('video-gen'), 'per second')
    assert.equal(getPriceUnitKey('audio-in'), 'per minute')
    assert.equal(getPriceUnitKey('audio-out'), 'per 1M characters')
    assert.equal(getPriceUnitKey('chat'), 'per 1M tokens')
    assert.equal(getPriceUnitKey('embedding'), 'per 1M tokens')
  })

  test('getKindLabelKey returns a distinct label per kind', () => {
    const seen = new Set<string>()
    for (const kind of PRICING_KINDS) {
      const label = getKindLabelKey(kind as PricingKind)
      assert.ok(label, `no label for kind ${kind}`)
      assert.ok(!seen.has(label), `duplicate label: ${label}`)
      seen.add(label)
    }
  })
})

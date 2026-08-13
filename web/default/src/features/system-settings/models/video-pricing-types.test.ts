import { describe, expect, test } from 'bun:test'
import {
  BASIS_OPTIONS,
  DIMENSION_KEYS,
  HAS_VIDEO_VALUES,
  MODE_VALUES,
  RESOLUTION_VALUES,
  createEmptyRule,
  type VideoPriceRule,
} from './video-pricing-types'

describe('video pricing vocabularies', () => {
  test('resolution values match the backend canonical set', () => {
    // setting/billing_setting/video_price.go canonicalResolutions.
    // 2160p is an alias that folds to 4k, so it is not offered separately.
    expect(RESOLUTION_VALUES).toEqual([
      '480p',
      '512p',
      '720p',
      '768p',
      '1080p',
      '2k',
      '4k',
    ])
  })

  test('mode values match the backend canonical set', () => {
    expect(MODE_VALUES).toEqual(['std', 'pro'])
  })

  test('has_video is a string boolean, matching what adapters emit', () => {
    expect(HAS_VIDEO_VALUES).toEqual(['true', 'false'])
  })

  test('dimension keys cover every channel shape', () => {
    expect(DIMENSION_KEYS).toEqual(['resolution', 'has_video', 'mode'])
  })

  test('basis options carry the two backend values', () => {
    expect(BASIS_OPTIONS.map((o) => o.value)).toEqual([
      'output_duration',
      'total_duration',
    ])
  })

  test('a new rule starts with no dimensions constrained', () => {
    const rule: VideoPriceRule = createEmptyRule()
    expect(rule.match).toEqual({})
    expect(rule.basis).toBe('output_duration')
    expect(rule.price_per_second).toBe(0)
  })
})

import {
  mergeModelRules,
  parseAllRules,
  rulesForModel,
} from './video-pricing-types'

describe('rule serialization', () => {
  const allRules: VideoPriceRule[] = [
    {
      model: 'a',
      match: { resolution: '720p' },
      price_per_second: 0.314,
      basis: 'output_duration',
    },
    {
      model: 'b',
      match: { has_video: 'true' },
      price_per_second: 0.08,
      basis: 'total_duration',
      fallback_seconds: 30,
    },
  ]

  test('parses a stored JSON string', () => {
    expect(parseAllRules(JSON.stringify(allRules))).toEqual(allRules)
  })

  test('an empty or absent value parses to no rules', () => {
    expect(parseAllRules('')).toEqual([])
    expect(parseAllRules('[]')).toEqual([])
    expect(parseAllRules(undefined)).toEqual([])
  })

  test('malformed JSON parses to no rules rather than throwing', () => {
    // A save would overwrite the key anyway; throwing here would break the
    // whole pricing sheet over one bad row.
    expect(parseAllRules('{not json')).toEqual([])
  })

  test('selects only the requested model', () => {
    expect(rulesForModel(allRules, 'a')).toEqual([allRules[0]])
    expect(rulesForModel(allRules, 'missing')).toEqual([])
  })

  test('merging replaces one model and leaves the others untouched', () => {
    const next = mergeModelRules(allRules, 'a', [
      {
        model: 'a',
        match: { resolution: '1080p' },
        price_per_second: 0.5,
        basis: 'output_duration',
      },
    ])
    expect(rulesForModel(next, 'b')).toEqual([allRules[1]])
    expect(rulesForModel(next, 'a')[0].price_per_second).toBe(0.5)
    expect(next).toHaveLength(2)
  })

  test('merging an empty list removes that model entirely', () => {
    const next = mergeModelRules(allRules, 'a', [])
    expect(rulesForModel(next, 'a')).toEqual([])
    expect(rulesForModel(next, 'b')).toEqual([allRules[1]])
  })

  test('merging stamps the model name onto every rule', () => {
    // The editor does not ask the administrator to retype the model per row.
    const next = mergeModelRules([], 'c', [
      { model: '', match: {}, price_per_second: 1, basis: 'output_duration' },
    ])
    expect(next[0].model).toBe('c')
  })
})

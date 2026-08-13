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

import { describe, expect, test } from 'bun:test'
import { normalizeJsonString } from './utils'

// billing_setting_video.video_price_rules does not exist until this feature
// writes it, so section-registry's plain lookup yields undefined on any
// deployment that has not saved a video rule yet -- which is every one of them
// on first load. An unguarded .trim() there takes down the whole billing page.
describe('normalizeJsonString with an absent option key', () => {
  test('undefined normalizes to empty rather than throwing', () => {
    expect(normalizeJsonString(undefined as unknown as string)).toBe('')
  })

  test('null normalizes to empty rather than throwing', () => {
    expect(normalizeJsonString(null as unknown as string)).toBe('')
  })

  test('existing behaviour is unchanged', () => {
    expect(normalizeJsonString('')).toBe('')
    expect(normalizeJsonString('  ')).toBe('')
    expect(normalizeJsonString('[{"a":1}]')).toBe('[{"a":1}]')
    expect(normalizeJsonString('not json')).toBe('not json')
  })
})

import { describe, expect, test } from 'bun:test'
import {
  buildRecallGroupOptions,
  selectedRecallGroupFallbackOptions,
} from './group-options'

describe('recall group options', () => {
  test('trims, discards empty values, and deduplicates in source order', () => {
    expect(
      buildRecallGroupOptions([' admin ', '', 'plg', 'admin', '  ', 'default'])
    ).toEqual([
      { label: 'admin', value: 'admin' },
      { label: 'plg', value: 'plg' },
      { label: 'default', value: 'default' },
    ])
  })

  test('maps saved values to fallback options', () => {
    expect(selectedRecallGroupFallbackOptions(['removed'])).toEqual([
      { label: 'removed', value: 'removed' },
    ])
  })
})

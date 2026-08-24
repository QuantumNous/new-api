import { describe, expect, test } from 'bun:test'
import { getDateTimePickerOpenState } from './datetime-picker'

describe('DateTimePicker interaction state', () => {
  test('never opens while disabled', () => {
    expect(getDateTimePickerOpenState(true, true)).toBe(false)
    expect(getDateTimePickerOpenState(true, false)).toBe(false)
    expect(getDateTimePickerOpenState(false, true)).toBe(true)
  })
})

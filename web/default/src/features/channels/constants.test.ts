import { expect, test } from 'bun:test'

import {
  CHANNEL_TYPE_OPTIONS,
  CHANNEL_TYPES,
  MODEL_FETCHABLE_TYPES,
} from './constants'
import { getDefaultBaseUrl } from './lib/channel-type-config'

test('Jimeng zhizinan channel is selectable and model-fetchable', () => {
  expect(CHANNEL_TYPES[104]).toBe('JimengZhizinan')
  expect(CHANNEL_TYPE_OPTIONS.some((option) => option.value === 104)).toBe(true)
  expect(MODEL_FETCHABLE_TYPES.has(104)).toBe(true)
})

test('TechMobiVideo channel is selectable but not model-fetchable', () => {
  expect(CHANNEL_TYPES[105]).toBe('TechMobiVideo')
  expect(CHANNEL_TYPE_OPTIONS.some((option) => option.value === 105)).toBe(true)
  expect(MODEL_FETCHABLE_TYPES.has(105)).toBe(false)
  expect(getDefaultBaseUrl(105)).toBe('https://api.chatgpttech.mobi')
})

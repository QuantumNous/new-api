import { expect, test } from 'bun:test'
import {
  CHANNEL_TYPE_OPTIONS,
  CHANNEL_TYPES,
  CREATE_MODEL_FETCHABLE_TYPES,
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

test('Codex model discovery is limited to channel creation', () => {
  expect(CHANNEL_TYPES[57]).toBe('Codex')
  expect(CREATE_MODEL_FETCHABLE_TYPES.has(57)).toBe(true)
  expect(MODEL_FETCHABLE_TYPES.has(57)).toBe(false)
})

test('BytePlus channel is selectable with its regional Ark base URL', () => {
  expect(CHANNEL_TYPES[107]).toBe('BytePlus')
  expect(CHANNEL_TYPE_OPTIONS.some((option) => option.value === 107)).toBe(true)
  expect(MODEL_FETCHABLE_TYPES.has(107)).toBe(false)
  expect(getDefaultBaseUrl(107)).toBe('https://ark.ap-southeast.bytepluses.com')
})

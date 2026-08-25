import { expect, test } from 'bun:test'
import {
  CHANNEL_STATUS,
  CHANNEL_STATUS_CONFIG,
  CHANNEL_STATUS_LABELS,
  CHANNEL_STATUS_OPTIONS,
  CHANNEL_TYPE_OPTIONS,
  CHANNEL_TYPES,
  CREATE_MODEL_FETCHABLE_TYPES,
  MODEL_FETCHABLE_TYPES,
} from './constants'
import {
  getChannelTypeConfig,
  getChannelTypeHints,
  getDefaultBaseUrl,
} from './lib/channel-type-config'
import { getChannelTypeIcon, getKeyPromptForType } from './lib/channel-utils'

test('Banned channel status is selectable and rendered as a dangerous status', () => {
  expect(CHANNEL_STATUS.BANNED).toBe(4)
  expect(CHANNEL_STATUS_LABELS[CHANNEL_STATUS.BANNED]).toBe('Banned')
  expect(CHANNEL_STATUS_CONFIG[CHANNEL_STATUS.BANNED].variant).toBe('danger')
  expect(CHANNEL_STATUS_OPTIONS).toContainEqual({
    value: 'banned',
    label: 'Banned',
  })
})

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

test('BytePlus default public models include canonical pro but not legacy case alias', () => {
  const config = getChannelTypeConfig(107)
  const hints = getChannelTypeHints(107)

  expect(config.supportedModels).toContain('seedance2.0-pro')
  expect(config.supportedModels).not.toContain('Seedance2.0-pro')
  expect(hints.models).toContain('seedance2.0-pro')
  expect(hints.models).not.toContain('Seedance2.0-pro')
})

test('Sonilo channel is selectable with video-to-music defaults', () => {
  expect(CHANNEL_TYPES[109]).toBe('Sonilo')
  expect(CHANNEL_TYPE_OPTIONS.some((option) => option.value === 109)).toBe(true)
  expect(MODEL_FETCHABLE_TYPES.has(109)).toBe(false)
  expect(getDefaultBaseUrl(109)).toBe('https://api.sonilo.com')
})

test('MiniMax H3 channel has a visible channel type label', () => {
  expect(CHANNEL_TYPES[110]).toBe('MiniMax H3')
  expect(CHANNEL_TYPE_OPTIONS.some((option) => option.value === 110)).toBe(true)
})

test('ModelAPISeedance channel is selectable with internal video-channel metadata only', () => {
  expect(CHANNEL_TYPES[111]).toBe('ModelAPISeedance')
  expect(CHANNEL_TYPE_OPTIONS.some((option) => option.value === 111)).toBe(true)
  expect(MODEL_FETCHABLE_TYPES.has(111)).toBe(false)
  expect(CREATE_MODEL_FETCHABLE_TYPES.has(111)).toBe(false)
  expect(getDefaultBaseUrl(111)).toBe('https://api.modelapi.co')
  expect(getChannelTypeIcon(111)).toBe('Doubao')
  expect(getKeyPromptForType(111)).toBe('API key from the provider')

  const config = getChannelTypeConfig(111)
  const hints = getChannelTypeHints(111)

  expect(config.icon).toBe('doubao')
  expect(config.supportedModels).toEqual(['doubao-seedance-2-5-260628'])
  expect(hints.key).toBe('API key from the provider')
  expect(hints.models).toBe('doubao-seedance-2-5-260628')
  expect(hints.other).toBeUndefined()
})

test('GitHub Copilot channel is selectable with its official endpoint', () => {
  expect(CHANNEL_TYPES[112]).toBe('GitHub Copilot')
  expect(CHANNEL_TYPE_OPTIONS.some((option) => option.value === 112)).toBe(true)
  expect(MODEL_FETCHABLE_TYPES.has(112)).toBe(false)
  expect(CREATE_MODEL_FETCHABLE_TYPES.has(112)).toBe(false)
  expect(getDefaultBaseUrl(112)).toBe('https://api.githubcopilot.com')
  expect(getChannelTypeIcon(112)).toBe('Github')
  expect(getKeyPromptForType(112)).toBe(
    'Copilot authorization is available after saving the channel'
  )
})

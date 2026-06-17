import { describe, expect, test } from 'bun:test'
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  channelFormSchema,
  transformChannelToFormDefaults,
  transformFormDataToCreatePayload,
  transformFormDataToUpdatePayload,
} from './channel-form'
import type { Channel } from '../types'

const baseChannel: Channel = {
  id: 1,
  type: 1,
  key: '',
  openai_organization: null,
  test_model: null,
  status: 1,
  name: 'primary',
  weight: 1,
  max_concurrency: 0,
  created_time: 0,
  test_time: 0,
  response_time: 0,
  base_url: null,
  other: '',
  balance: 0,
  balance_updated_time: 0,
  models: 'gpt-4o',
  group: 'default',
  used_quota: 0,
  model_mapping: null,
  status_code_mapping: null,
  priority: 0,
  auto_ban: 1,
  other_info: '',
  tag: null,
  setting: null,
  param_override: null,
  header_override: null,
  remark: '',
  max_input_tokens: 0,
  channel_info: {
    is_multi_key: false,
    multi_key_size: 0,
    multi_key_polling_index: 0,
    multi_key_mode: 'random',
  },
  settings: '{}',
}

describe('channel max concurrency form mapping', () => {
  test('maps max_concurrency between API data and form payloads', () => {
    const channel = {
      ...baseChannel,
      max_concurrency: 7,
    } as Channel

    const defaults = transformChannelToFormDefaults(channel)
    expect(
      (defaults as unknown as { max_concurrency?: number }).max_concurrency
    ).toBe(7)

    const createPayload = transformFormDataToCreatePayload({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'primary',
      key: 'sk-test',
      models: 'gpt-4o',
      max_concurrency: 5,
    })
    expect(
      (createPayload.channel as Record<string, unknown>).max_concurrency
    ).toBe(5)

    const updatePayload = transformFormDataToUpdatePayload(
      {
        ...CHANNEL_FORM_DEFAULT_VALUES,
        name: 'primary',
        models: 'gpt-4o',
        max_concurrency: 3,
      },
      1
    )
    expect((updatePayload as Record<string, unknown>).max_concurrency).toBe(3)
  })

  test('rejects negative max_concurrency values', () => {
    const result = channelFormSchema.safeParse({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      max_concurrency: -1,
    })

    expect(result.success).toBe(false)
  })
})

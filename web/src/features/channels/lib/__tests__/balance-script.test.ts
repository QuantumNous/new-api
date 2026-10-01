/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { describe, expect, test } from 'vitest'

import type { Channel } from '../../types'
import {
  balanceScriptByteLength,
  CHANNEL_FORM_DEFAULT_VALUES,
  channelFormSchema,
  MAX_BALANCE_SCRIPT_SOURCE_BYTES,
  transformChannelToFormDefaults,
  transformFormDataToUpdatePayload,
  type ChannelFormValues,
} from '../channel-form'

const SAMPLE_SCRIPT = `export function buildBalanceRequest(ctx) {
  return { method: 'GET', url: ctx.channel.baseUrl + '/balance', headers: {}, body: '' }
}
export function parseBalanceResponse(ctx, response) {
  return JSON.parse(response.body).remaining
}`

function channelWithSettings(settings: Record<string, unknown>): Channel {
  return {
    id: 1,
    type: 1,
    key: '',
    status: 1,
    name: 'test-channel',
    weight: 0,
    created_time: 0,
    test_time: 0,
    response_time: 0,
    base_url: 'https://example.com',
    other: '',
    balance: 0,
    balance_updated_time: 0,
    models: 'gpt-5',
    group: 'default',
    used_quota: 0,
    model_mapping: '',
    status_code_mapping: '',
    priority: 0,
    auto_ban: 1,
    other_info: '',
    tag: '',
    setting: '',
    param_override: '',
    header_override: '',
    remark: '',
    max_input_tokens: 0,
    channel_info: {
      is_multi_key: false,
      multi_key_size: 0,
      multi_key_polling_index: 0,
      multi_key_mode: 'random',
    },
    settings: JSON.stringify(settings),
  }
}

describe('balance_script form field', () => {
  test('defaults to blank (built-in balance query)', () => {
    expect(CHANNEL_FORM_DEFAULT_VALUES.balance_script).toBe('')
  })

  test('hydrates from an existing channel and preserves the script unchanged', () => {
    const channel = channelWithSettings({ balance_script: SAMPLE_SCRIPT })
    const defaults = transformChannelToFormDefaults(channel)
    expect(defaults.balance_script).toBe(SAMPLE_SCRIPT)

    const payload = transformFormDataToUpdatePayload(defaults, channel.id)
    const settings = JSON.parse(payload.settings as string)
    expect(settings.balance_script).toBe(SAMPLE_SCRIPT)
  })

  test('hydrates to an empty string when the channel has no balance_script', () => {
    const channel = channelWithSettings({})
    const defaults = transformChannelToFormDefaults(channel)
    expect(defaults.balance_script).toBe('')

    const payload = transformFormDataToUpdatePayload(defaults, channel.id)
    const settings = JSON.parse(payload.settings as string)
    expect(settings.balance_script).toBeUndefined()
  })

  test('editing the field is reflected in the serialized settings', () => {
    const formData: ChannelFormValues = {
      ...CHANNEL_FORM_DEFAULT_VALUES,
      type: 1,
      base_url: 'https://example.com',
      models: 'gpt-5',
      balance_script: SAMPLE_SCRIPT,
    }
    const payload = transformFormDataToUpdatePayload(formData, 1)
    const settings = JSON.parse(payload.settings as string)
    expect(settings.balance_script).toBe(SAMPLE_SCRIPT)
  })

  test('clearing the field omits balance_script, falling back to the built-in query', () => {
    const channel = channelWithSettings({ balance_script: SAMPLE_SCRIPT })
    const defaults = transformChannelToFormDefaults(channel)

    const cleared: ChannelFormValues = { ...defaults, balance_script: '' }
    const payload = transformFormDataToUpdatePayload(cleared, channel.id)
    const settings = JSON.parse(payload.settings as string)
    expect(settings.balance_script).toBeUndefined()

    // Whitespace-only input is also treated as blank.
    const whitespaceOnly: ChannelFormValues = {
      ...defaults,
      balance_script: '   \n  ',
    }
    const whitespacePayload = transformFormDataToUpdatePayload(
      whitespaceOnly,
      channel.id
    )
    const whitespaceSettings = JSON.parse(whitespacePayload.settings as string)
    expect(whitespaceSettings.balance_script).toBeUndefined()
  })

  test('preserves unrelated settings when serializing balance_script', () => {
    const channel = channelWithSettings({
      balance_script: SAMPLE_SCRIPT,
      allow_service_tier: true,
    })
    const defaults = transformChannelToFormDefaults(channel)
    const payload = transformFormDataToUpdatePayload(defaults, channel.id)
    const settings = JSON.parse(payload.settings as string)
    expect(settings.balance_script).toBe(SAMPLE_SCRIPT)
  })

  test('accepts a script at the byte cap and rejects one above it', () => {
    const atCap = 'x'.repeat(MAX_BALANCE_SCRIPT_SOURCE_BYTES)
    const overCap = 'x'.repeat(MAX_BALANCE_SCRIPT_SOURCE_BYTES + 1)
    expect(balanceScriptByteLength(atCap)).toBe(MAX_BALANCE_SCRIPT_SOURCE_BYTES)

    const validForm = {
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'test-channel',
      type: 1,
      base_url: 'https://example.com',
      models: 'gpt-5',
      balance_script: atCap,
    }
    expect(channelFormSchema.safeParse(validForm).success).toBe(true)

    const invalidForm = { ...validForm, balance_script: overCap }
    const result = channelFormSchema.safeParse(invalidForm)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === 'balance_script')
      ).toBe(true)
    }
  })
})

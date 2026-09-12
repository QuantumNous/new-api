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

import {
  CHANNEL_TYPE_NEW_API,
  CHANNEL_TYPE_VLLM,
  CHANNEL_TYPE_OPTIONS,
  MODEL_FETCHABLE_TYPES,
} from '../../constants'
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  channelFormSchema,
  transformFormDataToCreatePayload,
} from '../channel-form'
import { getChannelTypeConfig } from '../channel-type-config'
import { getChannelTypeIcon, getKeyPromptForType } from '../channel-utils'

function newAPIForm(baseUrl: string) {
  return {
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'New API upstream',
    type: CHANNEL_TYPE_NEW_API,
    base_url: baseUrl,
    key: 'test-key',
    models: 'gpt-5',
  }
}

describe('New API channel', () => {
  test('registers selection, ordering, model discovery, and icon metadata', () => {
    const option = CHANNEL_TYPE_OPTIONS.find(
      (item) => item.value === CHANNEL_TYPE_NEW_API
    )

    expect(option).toEqual({
      value: CHANNEL_TYPE_NEW_API,
      label: 'New API',
    })
    expect(
      CHANNEL_TYPE_OPTIONS.findIndex(
        (item) => item.value === CHANNEL_TYPE_NEW_API
      ) + 1
    ).toBe(CHANNEL_TYPE_OPTIONS.findIndex((item) => item.value === 58))
    expect(MODEL_FETCHABLE_TYPES.has(CHANNEL_TYPE_NEW_API)).toBe(true)
    expect(getChannelTypeIcon(CHANNEL_TYPE_NEW_API)).toBe('NewAPI')
    expect(getKeyPromptForType(CHANNEL_TYPE_NEW_API)).toBe(
      'Enter API key for this channel'
    )
    expect(getChannelTypeConfig(CHANNEL_TYPE_NEW_API).icon).toBe('NewAPI')
  })

  test('requires a non-blank Base URL', () => {
    const blankResult = channelFormSchema.safeParse(newAPIForm('  '))

    expect(blankResult.success).toBe(false)
    if (!blankResult.success) {
      expect(
        blankResult.error.issues.some(
          (issue) =>
            issue.path[0] === 'base_url' &&
            issue.message === 'Base URL is required for this channel type'
        )
      ).toBe(true)
    }

    expect(
      channelFormSchema.safeParse(newAPIForm('https://new-api.example')).success
    ).toBe(true)
  })

  test('keeps Sub2API Base URL validation unchanged', () => {
    const result = channelFormSchema.safeParse({
      ...newAPIForm(''),
      type: 59,
    })

    expect(result.success).toBe(true)
  })
})

describe('vLLM channel', () => {
  test('can be selected and discover served models', () => {
    expect(CHANNEL_TYPE_OPTIONS).toContainEqual({
      value: CHANNEL_TYPE_VLLM,
      label: 'vLLM',
    })
    expect(MODEL_FETCHABLE_TYPES.has(CHANNEL_TYPE_VLLM)).toBe(true)
    expect(getChannelTypeIcon(CHANNEL_TYPE_VLLM)).toBe('Vllm')
    expect(getChannelTypeConfig(CHANNEL_TYPE_VLLM).icon).toBe('Vllm')
    expect(getKeyPromptForType(CHANNEL_TYPE_VLLM)).toBe(
      'vLLM API key, or EMPTY if authentication is disabled'
    )
  })

  test('requires an upstream address and submits the served model name', () => {
    const form = {
      ...newAPIForm(''),
      type: CHANNEL_TYPE_VLLM,
      models: 'deepseek-v4-flash-vision-exp',
      key: 'EMPTY',
    }
    const blank = channelFormSchema.safeParse(form)
    expect(blank.success).toBe(false)
    if (!blank.success) {
      expect(blank.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['base_url'],
            message: 'Base URL is required for this channel type',
          }),
        ])
      )
    }
    const parsed = channelFormSchema.parse({
      ...form,
      base_url: 'http://vllm:8000/',
    })
    const payload = transformFormDataToCreatePayload(parsed)
    expect(payload.channel).toMatchObject({
      type: CHANNEL_TYPE_VLLM,
      base_url: 'http://vllm:8000',
      models: 'deepseek-v4-flash-vision-exp',
      key: 'EMPTY',
    })
  })
})

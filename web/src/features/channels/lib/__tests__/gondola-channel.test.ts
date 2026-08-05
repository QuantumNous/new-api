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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  CHANNEL_TYPE_GONDOLA,
  CHANNEL_TYPE_OPTIONS,
  MODEL_FETCHABLE_TYPES,
} from '../../constants'
import type { ChannelFormValues } from '../channel-form'
import { CHANNEL_FORM_DEFAULT_VALUES, channelFormSchema } from '../channel-form'
import { getChannelTypeConfig } from '../channel-type-config'
import { getChannelTypeIcon, getKeyPromptForType } from '../channel-utils'

function gondolaForm(baseUrl: string): ChannelFormValues {
  return {
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Gondola upstream',
    type: CHANNEL_TYPE_GONDOLA,
    base_url: baseUrl,
    key: 'gnd_test_key',
    models: 'deepseek-v4-flash',
  }
}

describe('Gondola channel', () => {
  test('is selectable in the channel type dropdown', () => {
    assert.deepEqual(
      CHANNEL_TYPE_OPTIONS.find(
        (item) => item.value === CHANNEL_TYPE_GONDOLA
      ),
      { value: CHANNEL_TYPE_GONDOLA, label: 'Gondola' }
    )
  })

  test('is ordered directly after OpenRouter', () => {
    assert.equal(
      CHANNEL_TYPE_OPTIONS.findIndex(
        (item) => item.value === CHANNEL_TYPE_GONDOLA
      ),
      CHANNEL_TYPE_OPTIONS.findIndex((item) => item.value === 20) + 1
    )
  })

  test('supports upstream model discovery', () => {
    assert.equal(MODEL_FETCHABLE_TYPES.has(CHANNEL_TYPE_GONDOLA), true)
  })

  test('resolves the Gondola icon', () => {
    assert.equal(getChannelTypeIcon(CHANNEL_TYPE_GONDOLA), 'Gondola')
    assert.equal(getChannelTypeConfig(CHANNEL_TYPE_GONDOLA).icon, 'Gondola')
  })

  test('prompts for the gnd_ key format', () => {
    assert.equal(
      getKeyPromptForType(CHANNEL_TYPE_GONDOLA),
      'Format: Gondola API key, starts with gnd_'
    )
  })

  test('defaults the Base URL to the Gondola gateway', () => {
    assert.equal(
      getChannelTypeConfig(CHANNEL_TYPE_GONDOLA).defaultBaseUrl,
      'https://api.gondola-ai.com'
    )
  })

  test('does not require an explicit Base URL', () => {
    assert.equal(channelFormSchema.safeParse(gondolaForm('')).success, true)
    assert.equal(
      channelFormSchema.safeParse(gondolaForm('https://api.gondola-ai.com'))
        .success,
      true
    )
  })
})

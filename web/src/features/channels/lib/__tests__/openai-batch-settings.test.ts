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

import type { Channel } from '../../types'
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  channelFormSchema,
  transformChannelToFormDefaults,
  transformFormDataToCreatePayload,
  transformFormDataToUpdatePayload,
} from '../channel-form'

describe('OpenAI native Batch channel setting', () => {
  test('round-trips through create and edit payloads', () => {
    const parsed = channelFormSchema.parse({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'OpenAI Batch upstream',
      key: 'test-key',
      models: 'gpt-image-2',
      native_openai_batch: true,
    })

    assert.equal(parsed.native_openai_batch, true)
    const created = transformFormDataToCreatePayload(parsed)
    assert.equal(
      JSON.parse(String(created.channel.settings)).native_openai_batch,
      true
    )

    const existing = {
      ...created.channel,
      id: 101,
      type: 1,
      status: 1,
      settings: created.channel.settings,
      channel_info: {
        is_multi_key: false,
        multi_key_size: 0,
        multi_key_polling_index: 0,
        multi_key_mode: 'random',
      },
    } as Channel
    const editDefaults = transformChannelToFormDefaults(existing)
    assert.equal(editDefaults.native_openai_batch, true)

    const updated = transformFormDataToUpdatePayload(editDefaults, existing.id)
    assert.equal(JSON.parse(String(updated.settings)).native_openai_batch, true)
  })
})

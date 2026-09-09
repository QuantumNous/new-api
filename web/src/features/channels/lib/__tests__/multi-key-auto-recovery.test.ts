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
  CHANNEL_FORM_DEFAULT_VALUES,
  channelFormSchema,
  transformChannelToFormDefaults,
  transformFormDataToCreatePayload,
  transformFormDataToUpdatePayload,
} from '../channel-form'

describe('multi-key auto recovery payload', () => {
  test('sends the option only when creating a multi-key channel', () => {
    const multiKeyPayload = transformFormDataToCreatePayload({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      multi_key_mode: 'multi_to_single',
      multi_key_auto_recovery: true,
    })
    const singleKeyPayload = transformFormDataToCreatePayload({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      multi_key_mode: 'single',
      multi_key_auto_recovery: true,
    })

    expect(multiKeyPayload.multi_key_auto_recovery).toBe(true)
    expect(singleKeyPayload.multi_key_auto_recovery).toBeUndefined()
  })

  test('sends an explicit boolean when updating a multi-key channel', () => {
    const enabledPayload = transformFormDataToUpdatePayload(
      {
        ...CHANNEL_FORM_DEFAULT_VALUES,
        multi_key_mode: 'multi_to_single',
        multi_key_auto_recovery: true,
      },
      1,
      true
    )
    const disabledPayload = transformFormDataToUpdatePayload(
      {
        ...CHANNEL_FORM_DEFAULT_VALUES,
        multi_key_mode: 'multi_to_single',
        multi_key_auto_recovery: false,
      },
      1,
      true
    )
    const singleKeyPayload = transformFormDataToUpdatePayload(
      {
        ...CHANNEL_FORM_DEFAULT_VALUES,
        multi_key_auto_recovery: true,
      },
      1
    )

    expect(enabledPayload.multi_key_auto_recovery).toBe(true)
    expect(disabledPayload.multi_key_auto_recovery).toBe(false)
    expect(singleKeyPayload.multi_key_auto_recovery).toBeUndefined()
  })

  test.each([
    {
      type: 57,
      settings: '{}',
      other: '',
    },
    {
      type: 41,
      settings: '{"vertex_key_type":"api_key"}',
      other: '{}',
    },
  ])('keeps an existing multi-key type $type editable', (channelFields) => {
    const channel = {
      id: 1,
      name: 'Existing multi-key channel',
      models: 'test-model',
      group: 'default',
      status: 1,
      channel_info: {
        is_multi_key: true,
        multi_key_size: 2,
        multi_key_polling_index: 0,
        multi_key_mode: 'random',
        multi_key_auto_recovery: true,
      },
      ...channelFields,
    } as Channel

    const defaults = transformChannelToFormDefaults(channel)
    const unsupportedCreate = channelFormSchema.safeParse({
      ...defaults,
      multi_key_mode: 'multi_to_single',
    })

    expect(defaults.multi_key_mode).toBe('single')
    expect(channelFormSchema.safeParse(defaults).success).toBe(true)
    expect(unsupportedCreate.success).toBe(false)
    if (!unsupportedCreate.success) {
      expect(
        unsupportedCreate.error.issues.some(
          (issue) => issue.path[0] === 'multi_key_mode'
        )
      ).toBe(true)
    }
  })
})

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
  MAX_CHANNEL_ADMISSION_LIMIT,
  buildSettingJSON,
  channelFormSchema,
  transformChannelToFormDefaults,
} from '../channel-form'

function channelWithSetting(setting: string): Channel {
  return {
    id: 1,
    type: 1,
    key: '',
    status: 1,
    name: 'limited upstream',
    created_time: 1,
    test_time: 0,
    response_time: 0,
    other: '',
    balance: 0,
    balance_updated_time: 0,
    models: 'gpt-test',
    group: 'default',
    used_quota: 0,
    other_info: '',
    setting,
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
}

function validForm() {
  return {
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'limited upstream',
    models: 'gpt-test',
  }
}

describe('channel admission limit form', () => {
  test('loads and serializes positive channel limits', () => {
    const values = transformChannelToFormDefaults(
      channelWithSetting('{"max_concurrency":20,"rpm_limit":120}')
    )

    assert.equal(values.max_concurrency, 20)
    assert.equal(values.rpm_limit, 120)
    assert.deepEqual(JSON.parse(buildSettingJSON(values)), {
      force_format: false,
      thinking_to_content: false,
      proxy: '',
      pass_through_body_enabled: false,
      system_prompt: '',
      system_prompt_override: false,
      max_concurrency: 20,
      rpm_limit: 120,
    })
  })

  test('omits zero limits so existing channels remain unlimited', () => {
    const setting = JSON.parse(buildSettingJSON(validForm()))

    assert.equal('max_concurrency' in setting, false)
    assert.equal('rpm_limit' in setting, false)
  })

  test('rejects negative, fractional, and excessive limits', () => {
    const invalidValues = [-1, 1.5, MAX_CHANNEL_ADMISSION_LIMIT + 1]

    for (const value of invalidValues) {
      const concurrencyResult = channelFormSchema.safeParse({
        ...validForm(),
        max_concurrency: value,
      })
      const rpmResult = channelFormSchema.safeParse({
        ...validForm(),
        rpm_limit: value,
      })

      assert.equal(concurrencyResult.success, false)
      assert.equal(rpmResult.success, false)
    }
  })
})

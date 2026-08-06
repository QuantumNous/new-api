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

import { CHANNEL_TYPE_OPTIONS, MODEL_FETCHABLE_TYPES } from '../../constants'
import { getChannelTypeConfig } from '../channel-type-config'
import { getChannelTypeIcon, getKeyPromptForType } from '../channel-utils'

const planChannels = [
  {
    type: 61,
    label: 'VolcEngine Agent Plan',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/plan',
    keyPrompt: 'Format: PlanAPIKey|AccessKey|SecretKey',
  },
  {
    type: 62,
    label: 'VolcEngine Coding Plan',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/coding',
    keyPrompt: 'Format: PlanAPIKey|AccessKey|SecretKey',
  },
]

describe('VolcEngine Plan channels', () => {
  test('register fixed endpoints, icon, model, and key metadata', () => {
    for (const channel of planChannels) {
      assert.deepEqual(
        CHANNEL_TYPE_OPTIONS.find((item) => item.value === channel.type),
        { value: channel.type, label: channel.label }
      )
      assert.equal(getChannelTypeIcon(channel.type), 'Volcengine')
      assert.equal(getKeyPromptForType(channel.type), channel.keyPrompt)
      assert.equal(MODEL_FETCHABLE_TYPES.has(channel.type), true)

      const config = getChannelTypeConfig(channel.type)
      assert.equal(config.defaultBaseUrl, channel.baseUrl)
      assert.deepEqual(config.supportedModels, ['ark-code-latest'])
    }
  })

  test('places both plans immediately after the ordinary VolcEngine channel', () => {
    const volcEngineIndex = CHANNEL_TYPE_OPTIONS.findIndex(
      (item) => item.value === 45
    )

    assert.equal(CHANNEL_TYPE_OPTIONS[volcEngineIndex + 1]?.value, 61)
    assert.equal(CHANNEL_TYPE_OPTIONS[volcEngineIndex + 2]?.value, 62)
  })

  test('enables upstream model discovery for ordinary and Plan channels', () => {
    assert.equal(MODEL_FETCHABLE_TYPES.has(45), true)
    assert.equal(MODEL_FETCHABLE_TYPES.has(61), true)
    assert.equal(MODEL_FETCHABLE_TYPES.has(62), true)
  })
})

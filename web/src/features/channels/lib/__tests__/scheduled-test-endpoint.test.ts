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

import { channelSchema } from '../../types'
import { getChannelConfigurationState } from '../channel-configuration'
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  transformChannelToFormDefaults,
  transformFormDataToUpdatePayload,
} from '../channel-form'

function channelWithSettings(settings: string) {
  return channelSchema.parse({
    id: 7,
    name: 'Gateway',
    key: '',
    type: 1,
    status: 1,
    created_time: 0,
    test_time: 0,
    response_time: 0,
    balance_updated_time: 0,
    settings,
  })
}

describe('scheduled channel test endpoint', () => {
  test('omits the setting when auto detect is saved', () => {
    const payload = transformFormDataToUpdatePayload(
      CHANNEL_FORM_DEFAULT_VALUES,
      7
    )
    expect(JSON.parse(String(payload.settings))).not.toHaveProperty(
      'test_endpoint_type'
    )
  })

  test('round-trips a saved responses endpoint and drops an unknown value', () => {
    const saved = transformChannelToFormDefaults(
      channelWithSettings('{"test_endpoint_type":"openai-response"}')
    )
    expect(saved.test_endpoint_type).toBe('openai-response')
    const payload = transformFormDataToUpdatePayload(saved, 7)
    expect(JSON.parse(String(payload.settings)).test_endpoint_type).toBe(
      'openai-response'
    )

    const unknown = transformChannelToFormDefaults(
      channelWithSettings('{"test_endpoint_type":"openai-alpha-search"}')
    )
    expect(unknown.test_endpoint_type).toBe('auto')
    expect(
      JSON.parse(String(transformFormDataToUpdatePayload(unknown, 7).settings))
    ).not.toHaveProperty('test_endpoint_type')
  })

  test('a saved endpoint marks routing as configured', () => {
    const idle = getChannelConfigurationState(
      CHANNEL_FORM_DEFAULT_VALUES,
      {},
      false
    )
    expect(idle.blocks.routingStrategy).toBe('idle')

    const configured = getChannelConfigurationState(
      {
        ...CHANNEL_FORM_DEFAULT_VALUES,
        test_endpoint_type: 'anthropic',
      },
      {},
      true
    )
    expect(configured.blocks.routingStrategy).toBe('configured')
  })
})

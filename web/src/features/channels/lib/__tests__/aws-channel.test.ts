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
import { expect, test } from 'vitest'

import { channelSchema } from '../../types'
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  channelFormSchema,
  transformChannelToFormDefaults,
  transformFormDataToCreatePayload,
} from '../channel-form'

test.each(['invoke_model', 'mantle'] as const)(
  'AWS creation round-trips the %s interface without losing other settings',
  (apiType) => {
    const form = channelFormSchema.parse({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'AWS',
      type: 33,
      key: 'key|us-east-1',
      models: 'claude-opus-4-7',
      aws_api_type: apiType,
      aws_key_type: 'api_key',
      settings: '{"custom_option":true}',
    })
    const payload = transformFormDataToCreatePayload(form).channel
    expect(JSON.parse(payload.settings ?? '{}')).toMatchObject({
      aws_api_type: apiType,
      aws_key_type: 'api_key',
      custom_option: true,
    })
    const channel = channelSchema.parse({
      ...payload,
      other: '',
      remark: '',
      id: 7,
      status: 1,
      created_time: 1,
      test_time: 0,
      response_time: 0,
      balance_updated_time: 0,
    })
    expect(transformChannelToFormDefaults(channel).aws_api_type).toBe(apiType)
  }
)

test('changing an AWS channel to another provider removes the AWS interface setting', () => {
  const form = channelFormSchema.parse({
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Claude',
    type: 14,
    key: 'test-key',
    models: 'claude-opus-4-7',
    aws_api_type: 'mantle',
    settings: '{"aws_api_type":"mantle","aws_key_type":"api_key"}',
  })
  const settings = JSON.parse(
    transformFormDataToCreatePayload(form).channel.settings ?? '{}'
  )
  expect(settings).not.toHaveProperty('aws_api_type')
  expect(settings).not.toHaveProperty('aws_key_type')
})

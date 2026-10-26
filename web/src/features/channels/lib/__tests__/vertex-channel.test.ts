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
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  channelFormSchema,
  transformChannelToFormDefaults,
  transformFormDataToCreatePayload,
  type ChannelFormValues,
} from '../channel-form'

const CHANNEL_TYPE_VERTEX_AI = 41

function vertexAPIKeyForm(
  overrides: Partial<ChannelFormValues> = {}
): ChannelFormValues {
  return {
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Vertex AI',
    type: CHANNEL_TYPE_VERTEX_AI,
    key: 'test-key',
    models: 'gemini-4-argon',
    other: '{"default":"global"}',
    vertex_key_type: 'api_key',
    ...overrides,
  }
}

function savedSettings(form: ChannelFormValues): Record<string, unknown> {
  const payload = transformFormDataToCreatePayload(
    channelFormSchema.parse(form)
  )
  return JSON.parse(payload.channel.settings ?? '{}')
}

describe('Vertex AI API Key project ID', () => {
  test('saves the trimmed project ID in API Key mode', () => {
    const settings = savedSettings(
      vertexAPIKeyForm({ vertex_project_id: ' my-project ' })
    )

    expect(settings).toMatchObject({
      vertex_key_type: 'api_key',
      vertex_project_id: 'my-project',
    })
  })

  test('accepts API Key mode without a project ID and saves none', () => {
    const form = vertexAPIKeyForm({ vertex_project_id: '  ' })

    expect(channelFormSchema.safeParse(form).success).toBe(true)
    expect(savedSettings(form)).not.toHaveProperty('vertex_project_id')
  })

  test('drops a saved project ID after switching to JSON keys', () => {
    const settings = savedSettings(
      vertexAPIKeyForm({
        vertex_key_type: 'json',
        key: '{"project_id":"json-project"}',
        vertex_project_id: 'my-project',
        settings: JSON.stringify({
          vertex_key_type: 'api_key',
          vertex_project_id: 'my-project',
        }),
      })
    )

    expect(settings).toMatchObject({ vertex_key_type: 'json' })
    expect(settings).not.toHaveProperty('vertex_project_id')
  })

  test('loads the saved project ID when editing a channel', () => {
    const channel = channelSchema.parse({
      id: 7,
      name: 'Vertex AI',
      type: CHANNEL_TYPE_VERTEX_AI,
      key: '',
      status: 1,
      created_time: 1,
      test_time: 0,
      response_time: 0,
      balance_updated_time: 0,
      models: 'gemini-4-argon',
      group: 'default',
      other: '{"default":"global"}',
      settings: JSON.stringify({
        vertex_key_type: 'api_key',
        vertex_project_id: 'my-project',
      }),
    })

    expect(transformChannelToFormDefaults(channel).vertex_project_id).toBe(
      'my-project'
    )
  })
})

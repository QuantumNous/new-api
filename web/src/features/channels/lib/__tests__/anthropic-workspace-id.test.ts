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

import { channelSchema } from '../../types'
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  transformChannelToFormDefaults,
  transformFormDataToCreatePayload,
} from '../channel-form'

function formValues(type: number, workspaceID: string) {
  return {
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Claude upstream',
    type,
    key: 'test-key',
    models: 'claude-sonnet-4-6',
    anthropic_workspace_id: workspaceID,
  }
}

describe('Anthropic workspace ID channel setting', () => {
  test('trims and serializes the administrator value for Anthropic and AWS channels', () => {
    for (const [type, workspaceID] of [
      [14, '  wrkspc_admin  '],
      [33, '  proj_mantle  '],
    ] as const) {
      const payload = transformFormDataToCreatePayload(
        formValues(type, workspaceID)
      )
      const settings = JSON.parse(String(payload.channel.settings))

      assert.equal(
        settings.anthropic_workspace_id,
        workspaceID.trim(),
        `channel type ${type}`
      )
    }
  })

  test('loads a saved workspace ID when editing a channel', () => {
    const channel = channelSchema.parse({
      id: 1,
      type: 14,
      key: '',
      status: 1,
      name: 'Claude upstream',
      created_time: 0,
      test_time: 0,
      response_time: 0,
      balance_updated_time: 0,
      settings: JSON.stringify({
        anthropic_workspace_id: '  wrkspc_admin  ',
      }),
    })

    assert.equal(
      transformChannelToFormDefaults(channel).anthropic_workspace_id,
      'wrkspc_admin'
    )
  })

  test('removes a stale workspace ID when the channel type does not support it', () => {
    const payload = transformFormDataToCreatePayload({
      ...formValues(1, ''),
      settings: JSON.stringify({
        anthropic_workspace_id: 'wrkspc_stale',
        unrelated: true,
      }),
    })
    const settings = JSON.parse(String(payload.channel.settings))

    assert.equal('anthropic_workspace_id' in settings, false)
    assert.equal(settings.unrelated, true)
  })
})

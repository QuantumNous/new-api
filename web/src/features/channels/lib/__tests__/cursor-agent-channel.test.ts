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
  CHANNEL_TYPE_CURSOR_AGENT,
  CHANNEL_TYPE_OPTIONS,
  CLAUDE_FIELD_PASSTHROUGH_TYPES,
  MODEL_FETCHABLE_TYPES,
} from '../../constants'
import { getChannelTypeConfig } from '../channel-type-config'
import { getChannelTypeIcon, getKeyPromptForType } from '../channel-utils'

describe('Cursor Agent channel', () => {
  test('registers the official SDK channel and its Claude-compatible surface', () => {
    expect(
      CHANNEL_TYPE_OPTIONS.find(
        (item) => item.value === CHANNEL_TYPE_CURSOR_AGENT
      )
    ).toEqual({ value: CHANNEL_TYPE_CURSOR_AGENT, label: 'Cursor Agent' })
    expect(MODEL_FETCHABLE_TYPES.has(CHANNEL_TYPE_CURSOR_AGENT)).toBe(true)
    expect(CLAUDE_FIELD_PASSTHROUGH_TYPES.has(CHANNEL_TYPE_CURSOR_AGENT)).toBe(
      true
    )
    expect(getChannelTypeIcon(CHANNEL_TYPE_CURSOR_AGENT)).toBe('Claude')
    expect(getKeyPromptForType(CHANNEL_TYPE_CURSOR_AGENT)).toContain(
      'Cursor User API Key'
    )
    expect(getChannelTypeConfig(CHANNEL_TYPE_CURSOR_AGENT)).toMatchObject({
      icon: 'Claude',
      defaultBaseUrl: 'http://127.0.0.1:3927',
    })
  })
})

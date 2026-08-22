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
import test from 'node:test'

import { CHANNEL_TYPES } from '../../constants'
import { getChannelTypeConfig } from '../channel-type-config'
import { getChannelTypeIcon, getChannelTypeLabel } from '../channel-utils'

const SIFTQ_CHANNEL_TYPE = 61

test('registers the SiftQ channel defaults', () => {
  assert.equal(CHANNEL_TYPES[SIFTQ_CHANNEL_TYPE], 'SiftQ')
  assert.equal(getChannelTypeLabel(SIFTQ_CHANNEL_TYPE), 'SiftQ')
  assert.equal(getChannelTypeIcon(SIFTQ_CHANNEL_TYPE), 'SiftQ')
  assert.deepEqual(getChannelTypeConfig(SIFTQ_CHANNEL_TYPE), {
    id: SIFTQ_CHANNEL_TYPE,
    name: 'SiftQ',
    icon: 'SiftQ',
    defaultBaseUrl: 'https://siftq.com/api/minimax/',
    supportedModels: ['MiniMax-H3'],
    hints: {
      baseUrl: 'Default: https://siftq.com/api/minimax/',
      key: 'SiftQ API Key',
      models: 'MiniMax-H3',
    },
  })
})

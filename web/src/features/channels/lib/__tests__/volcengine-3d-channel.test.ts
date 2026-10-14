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
import { describe, expect, it } from 'vitest'

import {
  CHANNEL_TYPE_OPTIONS,
  CHANNEL_TYPE_VOLCENGINE_3D,
  MODEL_FETCHABLE_TYPES,
} from '../../constants'
import { getChannelTypeConfig } from '../channel-type-config'
import { getChannelTypeIcon } from '../channel-utils'

describe('VolcEngine 3D channel registration', () => {
  it('registers the channel type and Ark defaults', () => {
    expect(
      CHANNEL_TYPE_OPTIONS.some(
        (item) => item.value === CHANNEL_TYPE_VOLCENGINE_3D
      )
    ).toBe(true)
    expect(MODEL_FETCHABLE_TYPES.has(CHANNEL_TYPE_VOLCENGINE_3D)).toBe(true)
    expect(getChannelTypeIcon(CHANNEL_TYPE_VOLCENGINE_3D)).toBe('Doubao')
    expect(
      getChannelTypeConfig(CHANNEL_TYPE_VOLCENGINE_3D).defaultBaseUrl
    ).toBe('https://ark.cn-beijing.volces.com')
  })
})

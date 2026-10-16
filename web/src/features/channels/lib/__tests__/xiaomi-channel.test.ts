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
  CHANNEL_TYPE_OPTIONS,
  CHANNEL_TYPE_XIAOMI,
  MODEL_FETCHABLE_TYPES,
} from '../../constants'
import { getChannelTypeConfig } from '../channel-type-config'

describe('Xiaomi MiMo channel', () => {
  test('can be selected under its own label', () => {
    expect(CHANNEL_TYPE_OPTIONS).toContainEqual({
      value: CHANNEL_TYPE_XIAOMI,
      label: 'Xiaomi MiMo',
    })
  })

  // MiMo answers /v1/models, so leaving the type out of this set hides the
  // "fetch models from upstream" entry in the channel form.
  test('exposes the upstream model list entry point', () => {
    expect(MODEL_FETCHABLE_TYPES.has(CHANNEL_TYPE_XIAOMI)).toBe(true)
  })

  test('asks for a MiMo key and an address without /v1', () => {
    const config = getChannelTypeConfig(CHANNEL_TYPE_XIAOMI)

    expect(config.icon).toBe('openai')
    expect(config.hints?.baseUrl).toBe('Xiaomi MiMo API address, without /v1')
    expect(config.hints?.key).toBe('MiMo API key from the Xiaomi MiMo platform')
  })
})

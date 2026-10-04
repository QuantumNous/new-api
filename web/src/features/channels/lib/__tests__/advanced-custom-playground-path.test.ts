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

import { describe, test } from 'vitest'

import {
  ADVANCED_CUSTOM_INCOMING_PATH_OPTIONS,
  getAdvancedCustomConverterDefaults,
  getAdvancedCustomIncomingPathLabel,
  getDefaultAdvancedCustomIncomingPath,
} from '../advanced-custom'

describe('playground chat incoming path', () => {
  test('is offered as a selectable incoming path', () => {
    const values = ADVANCED_CUSTOM_INCOMING_PATH_OPTIONS.map(
      (option) => option.value
    )
    assert.ok(values.includes('/pg/chat/completions'))
  })

  test('does not become the default pass-through incoming path', () => {
    // The option order decides the default. OpenAI Chat has to stay first so a
    // fresh pass-through route keeps pointing at /v1/chat/completions instead
    // of the dashboard-only playground path.
    assert.equal(
      getDefaultAdvancedCustomIncomingPath('none'),
      '/v1/chat/completions'
    )
  })

  test('maps the playground prefix onto the upstream /v1 path', () => {
    const defaults = getAdvancedCustomConverterDefaults(
      'none',
      '/pg/chat/completions'
    )
    assert.equal(defaults.upstream_path, '/v1/chat/completions')
  })

  test('leaves a non-playground pass-through path untouched', () => {
    const defaults = getAdvancedCustomConverterDefaults(
      'none',
      '/v1/chat/completions'
    )
    assert.equal(defaults.upstream_path, '/v1/chat/completions')
  })

  test('is named in route summaries', () => {
    assert.equal(
      getAdvancedCustomIncomingPathLabel('/pg/chat/completions'),
      'Playground Chat'
    )
  })
})

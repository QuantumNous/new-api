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
import { getInitialEditorMode } from './tiered-pricing-editor-state'

describe('tiered pricing editor initialization state', () => {
  test('uses visual mode for an empty billing expression', () => {
    assert.equal(getInitialEditorMode('', null), 'visual')
  })

  test('uses raw mode for a non-empty expression without visual config', () => {
    assert.equal(
      getInitialEditorMode('param("service_tier") == "priority"', null),
      'raw'
    )
  })

  test('uses visual mode when a visual config was parsed', () => {
    assert.equal(
      getInitialEditorMode('tier("base", p * 2 + c * 4)', {}),
      'visual'
    )
  })
})

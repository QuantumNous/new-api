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

import { buildGroupOptions } from '../group-options'

describe('group option display', () => {
  test('keeps the identifier as the submitted value and uses the name as label', () => {
    const [option] = buildGroupOptions({
      codex1: {
        name: 'Codex Plus',
        desc: 'For Codex users',
        ratio: 1,
      },
    })

    assert.equal(option.value, 'codex1')
    assert.equal(option.label, 'Codex Plus')
    assert.equal(option.desc, 'codex1 - For Codex users')
  })

  test('falls back to the identifier for responses without a name', () => {
    const [option] = buildGroupOptions({
      legacy: { desc: 'Legacy users', ratio: 1 },
    })

    assert.equal(option.value, 'legacy')
    assert.equal(option.label, 'legacy')
    assert.equal(option.desc, 'Legacy users')
  })
})

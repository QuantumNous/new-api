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
import { describe, it } from 'node:test'

import { buildLogCursorScope, estimateCursorTotalCount } from './query-params'

describe('buildLogCursorScope', () => {
  it('keeps cursors when only the URL page changes', () => {
    const first = buildLogCursorScope(
      true,
      100,
      { page: 1, pageSize: 100, model: 'gpt-5' },
      [{ id: 'model_name', value: 'gpt-5' }]
    )
    const second = buildLogCursorScope(
      true,
      100,
      { page: 2, pageSize: 100, model: 'gpt-5' },
      [{ id: 'model_name', value: 'gpt-5' }]
    )

    assert.equal(second, first)
  })

  it('resets cursors when a query filter changes', () => {
    const first = buildLogCursorScope(false, 20, { requestId: 'a' }, [])
    const second = buildLogCursorScope(false, 20, { requestId: 'b' }, [])

    assert.notEqual(second, first)
  })
})

describe('estimateCursorTotalCount', () => {
  it('keeps an empty first page empty', () => {
    assert.equal(estimateCursorTotalCount(0, 100, 0, false), 0)
  })

  it('uses the real item count on a partial final page', () => {
    assert.equal(estimateCursorTotalCount(2, 100, 17, false), 217)
  })

  it('reserves one page when the backend reports more data', () => {
    assert.equal(estimateCursorTotalCount(1, 100, 100, true), 300)
  })
})

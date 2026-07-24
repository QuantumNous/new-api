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

import type { Channel } from '../../types'
import { getChannelTableRowId, type TagRow } from '../channel-utils'

function channel(id: number): Channel {
  return { id } as Channel
}

describe('channel table row identity', () => {
  test('keeps each channel identity when priority updates reorder the rows', () => {
    const first = channel(101)
    const updated = channel(202)
    const third = channel(303)

    const beforeUpdate = [first, updated, third].map(getChannelTableRowId)
    const afterUpdate = [updated, first, third].map(getChannelTableRowId)

    assert.deepEqual(beforeUpdate, [
      'channel:101',
      'channel:202',
      'channel:303',
    ])
    assert.deepEqual(afterUpdate, ['channel:202', 'channel:101', 'channel:303'])
  })

  test('uses separate namespaces for tag and channel rows', () => {
    const tagRow = {
      id: '202' as unknown as number,
      tag: '202',
      children: [channel(202)],
    } as TagRow

    assert.equal(getChannelTableRowId(tagRow), 'tag:202')
    assert.equal(getChannelTableRowId(channel(202)), 'channel:202')
  })
})

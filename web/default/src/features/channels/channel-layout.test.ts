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

import { CHANNEL_PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from './constants'

describe('channel card pagination', () => {
  it('fills the three-column desktop grid without a trailing empty slot', () => {
    assert.equal(DEFAULT_PAGE_SIZE % 3, 0)
    assert.ok(CHANNEL_PAGE_SIZE_OPTIONS.includes(DEFAULT_PAGE_SIZE))
    assert.ok(CHANNEL_PAGE_SIZE_OPTIONS.every((pageSize) => pageSize % 3 === 0))
  })
})

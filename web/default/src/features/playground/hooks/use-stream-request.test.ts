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
import { expect, test } from 'bun:test'
import { closeOwnedStreamSource } from './use-stream-request'

test('a stale stream can close itself without clearing the newer stream', () => {
  let firstClosed = false
  let secondClosed = false
  const first = { close: () => (firstClosed = true) }
  const second = { close: () => (secondClosed = true) }
  const current = { current: second }

  closeOwnedStreamSource(current, first)

  expect(firstClosed).toBe(true)
  expect(secondClosed).toBe(false)
  expect(current.current).toBe(second)

  closeOwnedStreamSource(current, second)

  expect(secondClosed).toBe(true)
  expect(current.current).toBeNull()
})

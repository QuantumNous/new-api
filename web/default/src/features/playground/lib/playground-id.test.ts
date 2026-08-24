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
import { describe, expect, test } from 'bun:test'
import { createPlaygroundId } from './playground-id'

const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('createPlaygroundId', () => {
  test('uses native randomUUID when it is available', () => {
    let filledBytes = false

    const id = createPlaygroundId({
      randomUUID: () => 'native-id',
      getRandomValues: (bytes) => {
        filledBytes = true
        return bytes
      },
    })

    expect(id).toBe('native-id')
    expect(filledBytes).toBe(false)
  })

  test('builds an RFC 4122 version 4 UUID from random bytes', () => {
    const id = createPlaygroundId({
      getRandomValues: (bytes) => {
        bytes.forEach((_, index) => {
          bytes[index] = index
        })
        return bytes
      },
    })

    expect(id).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
    expect(id).toMatch(uuidV4Pattern)
  })

  test('does not fail when the Web Crypto API is unavailable', () => {
    const first = createPlaygroundId({})
    const second = createPlaygroundId({})

    expect(first).toMatch(uuidV4Pattern)
    expect(second).toMatch(uuidV4Pattern)
    expect(second).not.toBe(first)
  })
})

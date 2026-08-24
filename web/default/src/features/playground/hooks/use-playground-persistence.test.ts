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
import { runUserScopedDrain } from './use-playground-persistence'

test('drains different users independently while deduplicating the same user', async () => {
  const inFlight = new Map<number, Promise<string>>()
  const calls: number[] = []
  let finishFirst: ((value: string) => void) | undefined

  const first = runUserScopedDrain(inFlight, 10, () => {
    calls.push(10)
    return new Promise<string>((resolve) => {
      finishFirst = resolve
    })
  })
  const duplicateFirst = runUserScopedDrain(inFlight, 10, async () => {
    calls.push(10)
    return 'duplicate'
  })
  const second = runUserScopedDrain(inFlight, 20, async () => {
    calls.push(20)
    return 'second'
  })

  expect(duplicateFirst).toBe(first)
  expect(await second).toBe('second')
  expect(calls).toEqual([10, 20])

  finishFirst?.('first')
  expect(await first).toBe('first')
  expect(inFlight.size).toBe(0)
})

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
import { runSingleChatRequest } from './use-chat-handler'

test('non-streaming requests stay busy until settled and reject reentry', async () => {
  const gate = { current: false }
  const busyStates: boolean[] = []
  let finishRequest: (() => void) | undefined
  let requestCalls = 0

  const first = runSingleChatRequest(
    gate,
    (busy) => busyStates.push(busy),
    () =>
      new Promise<void>((resolve) => {
        requestCalls += 1
        finishRequest = resolve
      })
  )
  const second = await runSingleChatRequest(
    gate,
    (busy) => busyStates.push(busy),
    async () => {
      requestCalls += 1
    }
  )

  expect(gate.current).toBe(true)
  expect(busyStates).toEqual([true])
  expect(second).toBe(false)
  expect(requestCalls).toBe(1)

  finishRequest?.()
  expect(await first).toBe(true)
  expect(gate.current).toBe(false)
  expect(busyStates).toEqual([true, false])
})

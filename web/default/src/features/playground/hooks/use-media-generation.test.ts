/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of
the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import { describe, expect, test } from 'bun:test'
import { waitForVideoPoll } from './use-media-generation'

interface FakeSignal {
  aborted: boolean
  listeners: Set<(event: Event) => void>
  addEventListener: (
    type: string,
    listener: (event: Event) => void,
    options?: AddEventListenerOptions
  ) => void
  removeEventListener: (type: string, listener: (event: Event) => void) => void
}

function createFakeSignal(): FakeSignal {
  const signal: FakeSignal = {
    aborted: false,
    listeners: new Set(),
    addEventListener(type, listener) {
      if (type === 'abort') signal.listeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'abort') signal.listeners.delete(listener)
    },
  }
  return signal
}

describe('waitForVideoPoll', () => {
  test('removes its abort listener after the poll timer resolves', async () => {
    const signal = createFakeSignal()
    let resolveTimer: (() => void) | undefined

    const wait = waitForVideoPoll(
      signal as unknown as AbortSignal,
      (callback) => {
        resolveTimer = callback
        return 1
      },
      () => undefined
    )

    expect(signal.listeners.size).toBe(1)
    resolveTimer?.()
    await wait
    expect(signal.listeners.size).toBe(0)
  })

  test('clears its poll timer and removes its listener when aborted', async () => {
    const signal = createFakeSignal()
    let clearCount = 0
    const wait = waitForVideoPoll(
      signal as unknown as AbortSignal,
      () => 1,
      () => {
        clearCount += 1
      }
    )

    const [listener] = [...signal.listeners]
    signal.aborted = true
    listener?.(new Event('abort'))
    await wait

    expect(clearCount).toBe(1)
    expect(signal.listeners.size).toBe(0)
  })
})

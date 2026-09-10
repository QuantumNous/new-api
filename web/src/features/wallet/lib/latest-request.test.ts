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
import { describe, expect, test } from 'vitest'

import { createLatestRequestGuard, runLatestRequest } from './latest-request'

function deferred<T>() {
  let resolve: ((value: T) => void) | undefined
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })
  return {
    promise,
    resolve(value: T) {
      resolve?.(value)
    },
  }
}

describe('wallet latest-request protection', () => {
  test('does not let an older request overwrite a newer result', async () => {
    const guard = createLatestRequestGuard()
    guard.activate()
    const older = deferred<string>()
    const newer = deferred<string>()
    let visible = 'initial'

    const olderRequest = runLatestRequest(
      guard,
      () => older.promise,
      (value) => {
        visible = value
      }
    )
    const newerRequest = runLatestRequest(
      guard,
      () => newer.promise,
      (value) => {
        visible = value
      }
    )

    newer.resolve('newer')
    expect(await newerRequest).toBe(true)
    expect(visible).toBe('newer')
    older.resolve('older')
    expect(await olderRequest).toBe(false)
    expect(visible).toBe('newer')
  })

  test('does not commit a response after the consumer unmounts', async () => {
    const guard = createLatestRequestGuard()
    guard.activate()
    const request = deferred<string>()
    let visible = 'initial'
    const pending = runLatestRequest(
      guard,
      () => request.promise,
      (value) => {
        visible = value
      }
    )

    guard.deactivate()
    request.resolve('late')
    expect(await pending).toBe(false)
    expect(visible).toBe('initial')
  })
})

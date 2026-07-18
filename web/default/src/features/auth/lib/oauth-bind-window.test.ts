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

import {
  startOAuthBindResponseDeadline,
  watchOAuthPopupClosed,
} from './oauth-bind-window'

function fakeTimerRuntime() {
  let callback: (() => void) | undefined
  let delay = 0
  const cancelled: unknown[] = []
  const handle = Symbol('timer')
  return {
    runtime: {
      schedule: (scheduled: () => void, scheduledDelay: number) => {
        callback = scheduled
        delay = scheduledDelay
        return handle
      },
      cancel: (cancelledHandle: unknown) => cancelled.push(cancelledHandle),
    },
    fire: () => callback?.(),
    get delay() {
      return delay
    },
    cancelled,
    handle,
  }
}

describe('OAuth bind popup lifecycle', () => {
  test('waits 30 seconds for the opener response and can be cancelled', () => {
    const timer = fakeTimerRuntime()
    let timedOut = false
    const cancel = startOAuthBindResponseDeadline(
      () => {
        timedOut = true
      },
      undefined,
      timer.runtime
    )

    assert.equal(timer.delay, 30_000)
    cancel()
    timer.fire()
    assert.equal(timedOut, false)
    assert.deepEqual(timer.cancelled, [timer.handle])
  })

  test('reports a closed popup once and clears its poller', () => {
    const timer = fakeTimerRuntime()
    const popup = { closed: false }
    let closedCount = 0
    watchOAuthPopupClosed(
      popup,
      () => {
        closedCount += 1
      },
      undefined,
      timer.runtime
    )

    assert.equal(timer.delay, 500)
    timer.fire()
    assert.equal(closedCount, 0)
    popup.closed = true
    timer.fire()
    timer.fire()
    assert.equal(closedCount, 1)
    assert.deepEqual(timer.cancelled, [timer.handle])
  })
})

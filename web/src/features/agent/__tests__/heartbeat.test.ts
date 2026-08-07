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
  AGENT_HEARTBEAT_INTERVAL_MS,
  AGENT_HEARTBEAT_RETRY_MS,
  AgentHeartbeatRequestError,
  createAgentHeartbeatController,
  getAgentHeartbeatStorageKey,
} from '../heartbeat'

describe('agent heartbeat coordination', () => {
  test('throttles across controllers for the same SID without persisting the raw SID', async () => {
    const timestamps = new Map<string, number>()
    const timers: number[] = []
    let now = 10_000
    let sends = 0
    const key = getAgentHeartbeatStorageKey(51, 'secret-session-id')
    assert.equal(key.includes('secret-session-id'), false)

    const runtime = {
      now: () => now,
      isVisible: () => true,
      readLastSentAt: (storageKey: string) => timestamps.get(storageKey) ?? 0,
      writeLastSentAt: (storageKey: string, value: number) => {
        timestamps.set(storageKey, value)
      },
      send: async () => {
        sends += 1
      },
      schedule: (_callback: () => void, delay: number) => {
        timers.push(delay)
        return timers.length
      },
      cancel: () => undefined,
    }

    const first = createAgentHeartbeatController(key, runtime)
    await first.start()
    assert.equal(sends, 1)

    now += 1_000
    const second = createAgentHeartbeatController(key, runtime)
    await second.start()
    assert.equal(sends, 1)
    assert.equal(timers.at(-1), AGENT_HEARTBEAT_INTERVAL_MS - 1_000)

    first.stop()
    second.stop()
  })

  test('pauses while hidden and resumes immediately when visible', async () => {
    let visible = false
    let sends = 0
    const runtime = {
      now: () => 20_000,
      isVisible: () => visible,
      readLastSentAt: () => 0,
      writeLastSentAt: () => undefined,
      send: async () => {
        sends += 1
      },
      schedule: () => 1,
      cancel: () => undefined,
    }
    const controller = createAgentHeartbeatController('identity', runtime)

    await controller.start()
    assert.equal(sends, 0)

    visible = true
    await controller.resume()
    assert.equal(sends, 1)
    controller.stop()
  })

  test('uses exponential retry, honors Retry-After, and backs off permanent failures', async () => {
    const cases = [
      {
        error: new AgentHeartbeatRequestError('unavailable', {
          retryable: true,
        }),
        expected: AGENT_HEARTBEAT_RETRY_MS,
      },
      {
        error: new AgentHeartbeatRequestError('rate limited', {
          retryable: true,
          retryAfterMs: 90_000,
        }),
        expected: 90_000,
      },
      {
        error: new AgentHeartbeatRequestError('forbidden', {
          retryable: false,
        }),
        expected: AGENT_HEARTBEAT_INTERVAL_MS,
      },
    ]

    for (const { error, expected } of cases) {
      const timers: number[] = []
      const controller = createAgentHeartbeatController('identity', {
        now: () => 10_000,
        isVisible: () => true,
        readLastSentAt: () => 0,
        writeLastSentAt: () => undefined,
        send: async () => {
          throw error
        },
        schedule: (_callback, delay) => {
          timers.push(delay)
          return timers.length
        },
        cancel: () => undefined,
        random: () => 0.5,
      })

      await controller.start()
      assert.equal(timers.at(-1), expected)
      controller.stop()
    }
  })
})

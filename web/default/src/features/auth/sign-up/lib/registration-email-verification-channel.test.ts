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
import {
  publishRegistrationEmailVerified,
  subscribeRegistrationEmailVerified,
} from './registration-email-verification-channel'

class FakeVerificationChannel {
  readonly messages: unknown[] = []
  closed = false
  private listener: ((event: MessageEvent<unknown>) => void) | null = null

  postMessage(message: unknown) {
    this.messages.push(message)
  }

  addEventListener(
    _type: 'message',
    listener: (event: MessageEvent<unknown>) => void
  ) {
    this.listener = listener
  }

  removeEventListener(
    _type: 'message',
    listener: (event: MessageEvent<unknown>) => void
  ) {
    if (this.listener === listener) this.listener = null
  }

  close() {
    this.closed = true
  }

  emit(data: unknown) {
    this.listener?.({ data } as MessageEvent<unknown>)
  }
}

describe('registration email verification completion channel', () => {
  test('publishes only the payload-free completion event', () => {
    const channel = new FakeVerificationChannel()

    publishRegistrationEmailVerified(() => channel)

    expect(channel.messages).toEqual([{ type: 'registration-email-verified' }])
    expect(channel.closed).toBe(true)
  })

  test('keeps notification failures best-effort and closes the channel', () => {
    const channel = new FakeVerificationChannel()
    channel.postMessage = () => {
      throw new Error('channel unavailable')
    }

    expect(() => publishRegistrationEmailVerified(() => channel)).not.toThrow()
    expect(channel.closed).toBe(true)
  })

  test('subscribes only to completion events and closes on cleanup', () => {
    const channel = new FakeVerificationChannel()
    let calls = 0
    const unsubscribe = subscribeRegistrationEmailVerified(
      () => {
        calls += 1
      },
      () => channel
    )

    channel.emit({ type: 'other-event', email: 'ignored@example.com' })
    channel.emit({ type: 'registration-email-verified' })
    expect(calls).toBe(1)

    unsubscribe()
    channel.emit({ type: 'registration-email-verified' })
    expect(calls).toBe(1)
    expect(channel.closed).toBe(true)
  })
})

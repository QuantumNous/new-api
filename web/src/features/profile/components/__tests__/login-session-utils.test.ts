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

import type { TFunction } from 'i18next'

import { loginMethodLabel, sessionDevice } from '../login-session-utils'

const translate = ((key: string) => key) as TFunction

describe('login session presentation', () => {
  test('labels built-in and provider OAuth login methods', () => {
    assert.equal(loginMethodLabel('password', translate), 'Password')
    assert.equal(
      loginMethodLabel('2fa', translate),
      'Two-factor Authentication'
    )
    assert.equal(loginMethodLabel('oauth:github', translate), 'OAuth · GitHub')
    assert.equal(
      loginMethodLabel('oauth:custom-provider', translate),
      'OAuth · custom-provider'
    )
  })

  test('labels iPad Safari as iOS when its user agent also mentions Mac OS X', () => {
    const userAgent =
      'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

    assert.equal(
      sessionDevice(userAgent, 'Unknown device', 'Browser'),
      'Safari · iOS'
    )
  })

  test('labels a touch-capable current iPad session as iOS when its desktop user agent says Macintosh', () => {
    const userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

    assert.equal(
      sessionDevice(userAgent, 'Unknown device', 'Browser', 5),
      'Safari · iOS'
    )
  })

  test('keeps touch-capable Windows Chrome sessions identifiable', () => {
    const userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

    assert.equal(
      sessionDevice(userAgent, 'Unknown device', 'Browser', 10),
      'Chrome · Windows'
    )
  })

  test('keeps Android Chrome sessions identifiable when their user agent mentions Linux', () => {
    const userAgent =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'

    assert.equal(
      sessionDevice(userAgent, 'Unknown device', 'Browser', 5),
      'Chrome · Android'
    )
  })

  test('keeps genuine macOS Safari sessions identifiable', () => {
    const userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

    assert.equal(
      sessionDevice(userAgent, 'Unknown device', 'Browser'),
      'Safari · macOS'
    )
  })

  test('falls back to the unknown-device label for an empty user agent', () => {
    assert.equal(
      sessionDevice('', 'Unknown device', 'Browser'),
      'Unknown device'
    )
  })
})

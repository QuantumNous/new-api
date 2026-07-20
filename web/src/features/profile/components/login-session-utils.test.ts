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

import { loginMethodLabel, sessionDevice } from './login-session-utils'

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

  test('derives a stable browser and operating-system label', () => {
    assert.equal(
      sessionDevice(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit Safari/605.1.15',
        'Unknown device',
        'Browser'
      ),
      'Safari · macOS'
    )
    assert.equal(
      sessionDevice('', 'Unknown device', 'Browser'),
      'Unknown device'
    )
  })
})

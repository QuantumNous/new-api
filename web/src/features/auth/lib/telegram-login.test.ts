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

import { pickTelegramAuthorization } from './telegram-login'

describe('Telegram login authorization', () => {
  test('keeps only fields signed by the Telegram login contract', () => {
    assert.deepEqual(
      pickTelegramAuthorization({
        id: 12345,
        first_name: 'Test',
        last_name: 'User',
        username: 'test_user',
        photo_url: 'https://t.me/i/userpic/320/test.jpg',
        auth_date: 1_900_000_000,
        hash: 'signed-hash',
        lang: 'en',
        admin: true,
        redirect: 'https://attacker.example',
      }),
      {
        id: 12345,
        first_name: 'Test',
        last_name: 'User',
        username: 'test_user',
        photo_url: 'https://t.me/i/userpic/320/test.jpg',
        auth_date: 1_900_000_000,
        hash: 'signed-hash',
        lang: 'en',
      }
    )
  })

  test('rejects incomplete or structurally invalid callbacks', () => {
    assert.equal(pickTelegramAuthorization(null), null)
    assert.equal(
      pickTelegramAuthorization({ auth_date: 1, hash: 'hash' }),
      null
    )
    assert.equal(
      pickTelegramAuthorization({ id: 1, auth_date: 1, hash: '' }),
      null
    )
    assert.equal(
      pickTelegramAuthorization({ id: {}, auth_date: 1, hash: 'hash' }),
      null
    )
  })
})

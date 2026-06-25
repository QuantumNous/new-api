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
import { formatQuota } from '@/lib/format'
import {
  buildUserContactsCsv,
  collectUserContactsForExport,
  createUserContactsFilename,
} from './user-contact-export'
import type { User } from '../types'

function makeUser(overrides: Partial<User>): User {
  return {
    id: 1,
    username: 'user',
    display_name: 'User',
    quota: 0,
    used_quota: 0,
    request_count: 0,
    group: 'default',
    status: 1,
    role: 1,
    ...overrides,
  }
}

describe('user contact export', () => {
  test('builds a BOM-prefixed CSV with escaped contact fields', () => {
    const csv = buildUserContactsCsv([
      makeUser({
        id: 7,
        username: 'alice, admin',
        display_name: 'Alice "A"',
        quota: 500000,
        email: 'alice@example.com',
        wechat_id: 'wx\nline',
        telegram_id: '@alice',
      }),
    ])

    assert.equal(
      csv,
      '\uFEFFID,Username,Display Name,Quota,Email,WeChat ID,Telegram ID\r\n' +
        `7,"alice, admin","Alice ""A""",${formatQuota(500000)},alice@example.com,"wx\nline",'@alice\r\n`
    )
  })

  test('keeps empty contact values as empty cells', () => {
    const csv = buildUserContactsCsv([
      makeUser({
        id: 8,
        username: 'bob',
        display_name: '',
      }),
    ])

    assert.equal(
      csv,
      `\uFEFFID,Username,Display Name,Quota,Email,WeChat ID,Telegram ID\r\n` +
        `8,bob,,${formatQuota(0)},,,\r\n`
    )
  })

  test('neutralizes spreadsheet formulas in exported contact fields', () => {
    const csv = buildUserContactsCsv([
      makeUser({
        id: 9,
        username: '=HYPERLINK("https://example.com","click")',
        display_name: '+SUM(1,1)',
        quota: 500000,
        email: '-10+20@example.com',
        wechat_id: '@wechat',
        telegram_id: '\t=cmd',
      }),
    ])

    assert.equal(
      csv,
      '\uFEFFID,Username,Display Name,Quota,Email,WeChat ID,Telegram ID\r\n' +
        `9,"'=HYPERLINK(""https://example.com"",""click"")","'+SUM(1,1)",${formatQuota(500000)},'-10+20@example.com,'@wechat,'\t=cmd\r\n`
    )
  })

  test('creates a stable dated filename', () => {
    const filename = createUserContactsFilename(
      new Date('2026-06-11T01:02:03.000Z')
    )

    assert.equal(filename, 'user-contacts-2026-06-11.csv')
  })

  test('collects all pages for the export', async () => {
    const calls: Array<{ page: number; pageSize: number }> = []

    const users = await collectUserContactsForExport(
      async ({ page, pageSize }) => {
        calls.push({ page, pageSize })

        return {
          items: [makeUser({ id: page, username: `user-${page}` })],
          total: 3,
        }
      },
      1
    )

    assert.deepEqual(
      users.map((user) => user.id),
      [1, 2, 3]
    )
    assert.deepEqual(calls, [
      { page: 1, pageSize: 1 },
      { page: 2, pageSize: 1 },
      { page: 3, pageSize: 1 },
    ])
  })

  test('collects every row even when the server clamps the page size', async () => {
    // Request 2 rows per page, but the server only ever returns 1.
    const serverPages = [
      [makeUser({ id: 3, username: 'user-3' })],
      [makeUser({ id: 2, username: 'user-2' })],
      [makeUser({ id: 1, username: 'user-1' })],
    ]

    const users = await collectUserContactsForExport(
      async ({ page }) => ({
        items: serverPages[page - 1] ?? [],
        total: 3,
      }),
      2
    )

    assert.deepEqual(
      users.map((user) => user.id),
      [3, 2, 1]
    )
  })

  test('deduplicates rows resent across pages by offset drift', async () => {
    const serverPages = [
      [makeUser({ id: 5 }), makeUser({ id: 4 })],
      [makeUser({ id: 4 }), makeUser({ id: 3 })],
    ]

    const users = await collectUserContactsForExport(
      async ({ page }) => ({
        items: serverPages[page - 1] ?? [],
        total: 4,
      }),
      2
    )

    assert.deepEqual(
      users.map((user) => user.id),
      [5, 4, 3]
    )
  })

  test('stops on an empty page when total overstates the row count', async () => {
    const calls: number[] = []

    const users = await collectUserContactsForExport(
      async ({ page }) => {
        calls.push(page)

        return {
          items: page === 1 ? [makeUser({ id: 1 })] : [],
          total: 10,
        }
      },
      1
    )

    assert.deepEqual(
      users.map((user) => user.id),
      [1]
    )
    assert.deepEqual(calls, [1, 2])
  })
})

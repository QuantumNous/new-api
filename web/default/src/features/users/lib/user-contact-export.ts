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
import type { User } from '../types'
import { formatUserQuotaDisplay } from './user-quota-display'

const UTF8_BOM = '\uFEFF'
const CSV_ROW_SEPARATOR = '\r\n'
const FORMULA_PREFIXES = new Set(['=', '+', '-', '@'])
const LEADING_CONTROL_PREFIXES = new Set(['\t', '\r', '\n'])

export const USER_CONTACT_EXPORT_PAGE_SIZE = 100

export type UserContactsCsvText = {
  id: string
  username: string
  displayName: string
  quota: string
  noQuota: string
  email: string
  wechatId: string
  telegramId: string
}

export type UserContactExportPageRequest = {
  page: number
  pageSize: number
}

export type UserContactExportPage = {
  items: User[]
  total: number
}

export type UserContactExportPageFetcher = (
  request: UserContactExportPageRequest
) => Promise<UserContactExportPage>

const DEFAULT_TEXT: UserContactsCsvText = {
  id: 'ID',
  username: 'Username',
  displayName: 'Display Name',
  quota: 'Quota',
  noQuota: 'No Quota',
  email: 'Email',
  wechatId: 'WeChat ID',
  telegramId: 'Telegram ID',
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const text = neutralizeSpreadsheetFormula(String(value ?? ''))
  if (!/[",\r\n]/.test(text)) {
    return text
  }
  return `"${text.replace(/"/g, '""')}"`
}

function neutralizeSpreadsheetFormula(text: string): string {
  const firstCharacter = text.charAt(0)
  const firstNonWhitespaceCharacter = text.trimStart().charAt(0)
  if (
    LEADING_CONTROL_PREFIXES.has(firstCharacter) ||
    FORMULA_PREFIXES.has(firstNonWhitespaceCharacter)
  ) {
    return `'${text}`
  }
  return text
}

export function buildUserContactsCsv(
  users: User[],
  text: UserContactsCsvText = DEFAULT_TEXT
): string {
  const rows: Array<Array<string | number | undefined>> = [
    [
      text.id,
      text.username,
      text.displayName,
      text.quota,
      text.email,
      text.wechatId,
      text.telegramId,
    ],
    ...users.map((user) => [
      user.id,
      user.username,
      user.display_name,
      formatUserQuotaDisplay(user, text.noQuota),
      user.email,
      user.wechat_id,
      user.telegram_id,
    ]),
  ]

  return (
    UTF8_BOM +
    rows.map((row) => row.map(escapeCsvCell).join(',')).join(CSV_ROW_SEPARATOR) +
    CSV_ROW_SEPARATOR
  )
}

export function createUserContactsFilename(date = new Date()): string {
  return `user-contacts-${date.toISOString().slice(0, 10)}.csv`
}

export async function collectUserContactsForExport(
  fetchPage: UserContactExportPageFetcher,
  pageSize = USER_CONTACT_EXPORT_PAGE_SIZE
): Promise<User[]> {
  const normalizedPageSize = Math.max(1, Math.floor(pageSize))
  // Keyed by user id: offset pagination can resend rows when users are
  // created or deleted mid-export, and the server may clamp the page size
  // below the requested one, so we page until the collection covers `total`
  // or the server runs out of rows instead of precomputing a page count.
  const usersById = new Map<User['id'], User>()

  for (let page = 1; ; page += 1) {
    const { items, total } = await fetchPage({
      page,
      pageSize: normalizedPageSize,
    })

    if (items.length === 0) {
      break
    }
    for (const user of items) {
      usersById.set(user.id, user)
    }
    if (usersById.size >= total) {
      break
    }
  }

  return [...usersById.values()]
}

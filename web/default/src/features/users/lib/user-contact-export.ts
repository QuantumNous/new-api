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

const UTF8_BOM = '\uFEFF'
const CSV_ROW_SEPARATOR = '\r\n'

export const USER_CONTACT_EXPORT_PAGE_SIZE = 100

export type UserContactsCsvHeaders = {
  id: string
  username: string
  displayName: string
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

const DEFAULT_HEADERS: UserContactsCsvHeaders = {
  id: 'ID',
  username: 'Username',
  displayName: 'Display Name',
  email: 'Email',
  wechatId: 'WeChat ID',
  telegramId: 'Telegram ID',
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const text = String(value ?? '')
  if (!/[",\r\n]/.test(text)) {
    return text
  }
  return `"${text.replace(/"/g, '""')}"`
}

export function buildUserContactsCsv(
  users: User[],
  headers: UserContactsCsvHeaders = DEFAULT_HEADERS
): string {
  const rows: Array<Array<string | number | undefined>> = [
    [
      headers.id,
      headers.username,
      headers.displayName,
      headers.email,
      headers.wechatId,
      headers.telegramId,
    ],
    ...users.map((user) => [
      user.id,
      user.username,
      user.display_name,
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
  const firstPage = await fetchPage({ page: 1, pageSize: normalizedPageSize })
  const users = [...firstPage.items]
  const pageCount = Math.ceil(firstPage.total / normalizedPageSize)

  for (let page = 2; page <= pageCount; page += 1) {
    const nextPage = await fetchPage({ page, pageSize: normalizedPageSize })
    users.push(...nextPage.items)
  }

  return users
}

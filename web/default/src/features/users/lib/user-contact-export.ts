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
import { formatQuota, formatTimestamp } from '@/lib/format'
import {
  USER_ROLES,
  USER_STATUS,
  USER_STATUSES,
  isUserDeleted,
} from '../constants'
import type { User } from '../types'
import { getUserAttributionDisplay } from './user-attribution'
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
  email: string
  status: string
  quota: string
  requestCount: string
  group: string
  role: string
  acquisitionSource: string
  sourceMedium: string
  campaignKeyword: string
  landingPage: string
  invited: string
  revenue: string
  inviter: string
  wechatId: string
  telegramId: string
  createdAt: string
  lastLogin: string
  noQuota: string
  translateLabel?: (key: string) => string
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
  email: 'Email',
  status: 'Status',
  quota: 'Quota',
  requestCount: 'Request Count',
  group: 'Group',
  role: 'Role',
  acquisitionSource: 'Acquisition Source',
  sourceMedium: 'Source / Medium',
  campaignKeyword: 'Campaign / Keyword',
  landingPage: 'Landing Page',
  invited: 'Invited',
  revenue: 'Revenue',
  inviter: 'Inviter',
  wechatId: 'WeChat ID',
  telegramId: 'Telegram ID',
  createdAt: 'Created At',
  lastLogin: 'Last Login',
  noQuota: 'No Quota',
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
  const translateLabel = text.translateLabel ?? ((key: string) => key)
  const rows: Array<Array<string | number | undefined>> = [
    [
      text.id,
      text.username,
      text.displayName,
      text.email,
      text.status,
      text.quota,
      text.requestCount,
      text.group,
      text.role,
      text.acquisitionSource,
      text.sourceMedium,
      text.campaignKeyword,
      text.landingPage,
      text.invited,
      text.revenue,
      text.inviter,
      text.wechatId,
      text.telegramId,
      text.createdAt,
      text.lastLogin,
    ],
    ...users.map((user) => {
      const attribution = getUserAttributionDisplay(user.ads_attribution)
      return [
        user.id,
        user.username,
        user.display_name,
        user.email,
        getUserStatusLabel(user, translateLabel),
        formatUserQuotaDisplay(user, text.noQuota),
        user.request_count,
        user.group,
        getUserRoleLabel(user, translateLabel),
        translateLabel(attribution.badgeLabel),
        attribution.sourceMedium,
        attribution.detail,
        attribution.landingPath,
        user.aff_count ?? 0,
        formatQuota(user.aff_history_quota ?? 0),
        user.inviter_id ? String(user.inviter_id) : '',
        user.wechat_id,
        user.telegram_id,
        user.created_at ? formatTimestamp(user.created_at) : '',
        user.last_login_at ? formatTimestamp(user.last_login_at) : '',
      ]
    }),
  ]

  return (
    UTF8_BOM +
    rows
      .map((row) => row.map(escapeCsvCell).join(','))
      .join(CSV_ROW_SEPARATOR) +
    CSV_ROW_SEPARATOR
  )
}

function getUserStatusLabel(
  user: User,
  translateLabel: (key: string) => string
): string {
  const statusConfig = isUserDeleted(user)
    ? USER_STATUSES[USER_STATUS.DELETED]
    : USER_STATUSES[user.status as keyof typeof USER_STATUSES]

  return statusConfig ? translateLabel(statusConfig.labelKey) : ''
}

function getUserRoleLabel(
  user: User,
  translateLabel: (key: string) => string
): string {
  const roleConfig = USER_ROLES[user.role as keyof typeof USER_ROLES]
  return roleConfig ? translateLabel(roleConfig.labelKey) : ''
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

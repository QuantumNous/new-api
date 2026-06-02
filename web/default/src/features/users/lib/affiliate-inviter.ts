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

type Translate = (key: string) => string

type InviterCandidateLabelInput = {
  id?: number
  username?: string
  display_name?: string
  email?: string
}

function normalizeInteger(value: unknown): number {
  const number = Number(String(value ?? '').trim())
  if (!Number.isFinite(number)) return 0
  const integer = Math.trunc(number)
  return integer > 0 ? integer : 0
}

function normalizeZeroableInteger(value: unknown): number {
  const number = Number(String(value ?? '').trim())
  if (!Number.isFinite(number)) return 0
  const integer = Math.trunc(number)
  return integer > 0 ? integer : 0
}

export function buildAffiliateInviterCandidatesQuery({
  keyword = '',
  page = 1,
  pageSize = 10,
}: {
  keyword?: string
  page?: number
  pageSize?: number
} = {}): string {
  const params = new URLSearchParams()
  const normalizedKeyword = String(keyword || '').trim()
  if (normalizedKeyword) params.set('keyword', normalizedKeyword)
  params.set('p', String(normalizeInteger(page) || 1))
  params.set('page_size', String(normalizeInteger(pageSize) || 10))
  return `/api/affiliate/admin/inviter-candidates?${params.toString()}`
}

export function buildAffiliateInviterPreviewQuery(
  targetUserId: unknown,
  newInviterUserId: unknown
): string {
  const target = normalizeInteger(targetUserId)
  const inviter = normalizeZeroableInteger(newInviterUserId)
  return `/api/affiliate/admin/users/${target}/inviter/preview?new_inviter_user_id=${inviter}`
}

export function buildAffiliateInviterUpdateUrl(targetUserId: unknown): string {
  const target = normalizeInteger(targetUserId)
  return `/api/affiliate/admin/users/${target}/inviter`
}

export function buildAffiliateInviterUpdatePayload({
  newInviterUserId,
  reason = '',
}: {
  newInviterUserId?: unknown
  reason?: string
} = {}): { new_inviter_user_id: number; reason: string } {
  return {
    new_inviter_user_id: normalizeZeroableInteger(newInviterUserId),
    reason: String(reason || '').trim(),
  }
}

export function validateAffiliateInviterChange(
  targetUserId: unknown,
  newInviterUserId: unknown,
  t: Translate
): string {
  const target = normalizeInteger(targetUserId)
  const inviter = normalizeZeroableInteger(newInviterUserId)
  if (!target) return t('User is missing')
  if (inviter > 0 && target === inviter) {
    return t('Inviter cannot be the target user')
  }
  return ''
}

export function formatAffiliateInviterPath(
  path: number[] | undefined,
  t: Translate
): string {
  if (!Array.isArray(path) || path.length === 0) return t('None')
  return path.map((id) => String(id)).join(' -> ')
}

export function formatAffiliateInviterCandidateLabel(
  user: InviterCandidateLabelInput = {}
): string {
  const parts = [`#${user.id || 0}`]
  if (user.username) parts.push(user.username)
  if (user.display_name && user.display_name !== user.username) {
    parts.push(`(${user.display_name})`)
  }
  if (user.email) parts.push(user.email)
  return parts.join(' ')
}

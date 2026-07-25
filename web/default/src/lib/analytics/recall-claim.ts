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

const RECALL_CLAIM_MAX_REDIRECT_DEPTH = 2
export const RECALL_CLAIM_POST_LOGIN_STORAGE_KEY = 'auth_post_login_redirect'
export const RECALL_CLAIM_OAUTH_NONCE_STORAGE_KEY = 'auth_oauth_redirect_nonce'
const RECALL_CLAIM_POST_LOGIN_TTL_MS = 30 * 60 * 1000

export type RecallClaimPostLoginRecord = {
  nonce: string
  rawTarget: string
  sanitizedTarget: string
  createdAt: number
}

type PostLoginStorage = Pick<Storage, 'getItem' | 'removeItem'>

export function isSafeInternalPath(
  path: string | null | undefined
): path is string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return false
  if (path.includes('\\')) return false
  // eslint-disable-next-line no-control-regex
  return !/[\u0000-\u001f\u007f\s]/.test(path)
}

export function clearRecallClaimPostLoginStorage(
  storage: Pick<Storage, 'removeItem'>
): void {
  storage.removeItem(RECALL_CLAIM_POST_LOGIN_STORAGE_KEY)
  storage.removeItem(RECALL_CLAIM_OAUTH_NONCE_STORAGE_KEY)
}

export function readRecallClaimPostLoginRecord(
  storage: PostLoginStorage,
  now = Date.now()
): RecallClaimPostLoginRecord | null {
  const rawRecord = storage.getItem(RECALL_CLAIM_POST_LOGIN_STORAGE_KEY)
  if (!rawRecord) return null

  let parsed: Partial<RecallClaimPostLoginRecord>
  try {
    parsed = JSON.parse(rawRecord) as Partial<RecallClaimPostLoginRecord>
  } catch {
    clearRecallClaimPostLoginStorage(storage)
    return null
  }

  const createdAt = parsed.createdAt
  const oauthNonce = storage.getItem(RECALL_CLAIM_OAUTH_NONCE_STORAGE_KEY)
  const isExpired =
    typeof createdAt !== 'number' ||
    createdAt <= 0 ||
    createdAt > now ||
    now - createdAt > RECALL_CLAIM_POST_LOGIN_TTL_MS
  const isInvalid =
    typeof parsed.nonce !== 'string' ||
    !parsed.nonce ||
    parsed.nonce.length > 128 ||
    !isSafeInternalPath(parsed.rawTarget) ||
    !isSafeInternalPath(parsed.sanitizedTarget) ||
    containsRecallClaimInURL(parsed.sanitizedTarget) ||
    Boolean(oauthNonce && oauthNonce !== parsed.nonce)

  if (isExpired || isInvalid) {
    clearRecallClaimPostLoginStorage(storage)
    return null
  }

  return parsed as RecallClaimPostLoginRecord
}

export function containsRecallClaimInURL(rawURL: string, depth = 0): boolean {
  if (!rawURL) return false
  if (depth > RECALL_CLAIM_MAX_REDIRECT_DEPTH) return true

  try {
    const url = new URL(rawURL, 'https://console.invalid')
    if (url.searchParams.has('recall_claim')) return true
    if (
      url.pathname.endsWith('/recall/claim') &&
      url.searchParams.has('claim')
    ) {
      return true
    }

    return url.searchParams
      .getAll('redirect')
      .some((redirectURL) => containsRecallClaimInURL(redirectURL, depth + 1))
  } catch {
    return false
  }
}

export function isRecallClaimAnalyticsBlocked(rawURL?: string): boolean {
  if (rawURL && containsRecallClaimInURL(rawURL)) return true
  if (typeof window === 'undefined') return false
  if (containsRecallClaimInURL(window.location?.href || '')) return true

  try {
    const storage = window.sessionStorage as Storage | undefined
    if (!storage) return false
    const record = readRecallClaimPostLoginRecord(storage)
    return record ? containsRecallClaimInURL(record.rawTarget) : false
  } catch {
    return true
  }
}

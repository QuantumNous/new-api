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
/** The subset of the auth user this check reads. */
type UsageCounters = {
  used_quota?: number
  request_count?: number
}

/**
 * True while the account has never been used: no quota consumed and no request
 * made. The welcome banner greets exactly these accounts.
 *
 * The counters come from `/api/user/self`, which the authenticated layout
 * refreshes once per session, so an account that starts calling mid-session
 * keeps the banner until the next load — acceptable for a one-time greeting.
 *
 * Non-numeric values (a corrupted localStorage payload rehydrated into the
 * auth store) are not treated as zero: guessing "new" there would replay the
 * banner on every visit.
 */
export function isNewAccount(user: UsageCounters | null | undefined): boolean {
  if (!user) return false

  const usedQuota = user.used_quota ?? 0
  const requestCount = user.request_count ?? 0
  if (typeof usedQuota !== 'number' || typeof requestCount !== 'number') {
    return false
  }
  if (!Number.isFinite(usedQuota) || !Number.isFinite(requestCount)) {
    return false
  }

  return usedQuota <= 0 && requestCount <= 0
}

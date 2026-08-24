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
/**
 * Per-user persistence for the overview welcome banner.
 *
 * The banner is a one-time greeting for a brand-new account, so it is shown
 * once and never again: the flag is written the first time it renders, not
 * when the user dismisses it. Someone who reads it and navigates away without
 * clicking "Dismiss" has still seen it.
 *
 * The key is namespaced by user id — the previous global key meant a shared
 * browser leaked one account's dismissal to the next.
 *
 * All access is guarded (`typeof window` + try/catch) to match the defensive
 * style of `playground/lib/first-run-persistence.ts`: private mode, disabled
 * storage and quota errors must never crash the overview.
 */

const SEEN_KEY_PREFIX = 'dashboard_overview_welcome_seen:'

const FLAG_VALUE = '1'

/** A user id the flag can be keyed on. Falsy ids skip persistence. */
type UserId = number | string | null | undefined

function isStorageAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

function normalizeUserId(userId: UserId): string | null {
  if (userId === null || userId === undefined || userId === '') return null
  return String(userId)
}

function seenKey(userId: string): string {
  return `${SEEN_KEY_PREFIX}${userId}`
}

/** True once this user has been shown the welcome banner. */
export function hasSeenWelcomeNotice(userId: UserId): boolean {
  const id = normalizeUserId(userId)
  if (!id || !isStorageAvailable()) return false
  try {
    return window.localStorage.getItem(seenKey(id)) === FLAG_VALUE
  } catch {
    // Storage is unreadable; treat the banner as unseen so a genuinely new
    // user still gets the greeting. It then lives for this session only.
    return false
  }
}

/** Record that the banner has been shown, so later visits skip it. */
export function markWelcomeNoticeSeen(userId: UserId): void {
  const id = normalizeUserId(userId)
  if (!id || !isStorageAvailable()) return
  try {
    window.localStorage.setItem(seenKey(id), FLAG_VALUE)
  } catch {
    // Storage is unavailable; the banner reappears next visit, which is a
    // better failure than crashing the overview.
  }
}

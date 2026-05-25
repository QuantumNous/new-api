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
import {
  SESSION_ACTIVITY_STORAGE_KEY,
  SESSION_IDLE_LOGOUT_STORAGE_KEY,
} from '../constants'

export function markSessionActivity(timestamp = Date.now()): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(timestamp))
  } catch {
    /* empty */
  }
}

export function readSessionActivityAt(): number {
  if (typeof window === 'undefined') return Date.now()
  try {
    const raw = window.localStorage.getItem(SESSION_ACTIVITY_STORAGE_KEY)
    const parsed = raw ? Number(raw) : NaN
    return Number.isFinite(parsed) ? parsed : Date.now()
  } catch {
    return Date.now()
  }
}

export function clearIdleLogoutSignal(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(SESSION_IDLE_LOGOUT_STORAGE_KEY)
  } catch {
    /* empty */
  }
}

export function broadcastIdleLogout(timestamp = Date.now()): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      SESSION_IDLE_LOGOUT_STORAGE_KEY,
      String(timestamp)
    )
  } catch {
    /* empty */
  }
}

export function resetSessionActivityTracking(): void {
  clearIdleLogoutSignal()
  markSessionActivity()
}

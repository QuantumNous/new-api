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
import { getSelf } from '@/lib/api'
import type { User } from '@/features/users/types'
import { saveUserId } from './storage'
import { resetSessionActivityTracking } from './idle-session'
import { markSessionVerified } from './session'

const BOOTSTRAP_RETRY_DELAYS_MS = [0, 250, 600] as const

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/**
 * Load the current user profile after login and mark the session verified.
 * Retries briefly to avoid racing the session cookie right after login.
 */
export async function bootstrapUserAfterLogin(
  setUser: (user: User) => void,
  loginPayload?: { id?: number } | null
): Promise<User | null> {
  if (loginPayload?.id) {
    saveUserId(loginPayload.id)
  }

  for (let attempt = 0; attempt < BOOTSTRAP_RETRY_DELAYS_MS.length; attempt++) {
    const waitMs = BOOTSTRAP_RETRY_DELAYS_MS[attempt]
    if (waitMs > 0) {
      await delay(waitMs)
    }

    try {
      const self = await getSelf()
      if (self?.success && self.data) {
        const user = self.data as User
        setUser(user)
        if (user.id) {
          saveUserId(user.id)
        }
        markSessionVerified()
        resetSessionActivityTracking()
        return user
      }
    } catch {
      /* retry */
    }
  }

  return null
}

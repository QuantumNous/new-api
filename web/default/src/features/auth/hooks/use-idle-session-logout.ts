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
import { useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { logout } from '../api'
import {
  SESSION_ACTIVITY_CHECK_INTERVAL_MS,
  SESSION_ACTIVITY_THROTTLE_MS,
  SESSION_IDLE_LOGOUT_STORAGE_KEY,
  SESSION_IDLE_TIMEOUT_MS,
} from '../constants'
import {
  broadcastIdleLogout,
  markSessionActivity,
  readSessionActivityAt,
} from '../lib/idle-session'

const ACTIVITY_EVENTS = [
  'click',
  'keydown',
  'mousemove',
  'pointerdown',
  'pointermove',
  'scroll',
  'touchstart',
] as const

/**
 * Frontend-only idle timeout for authenticated app shell.
 * Does not change backend session or permission logic.
 */
export function useIdleSessionLogout() {
  const user = useAuthStore((state) => state.auth.user)
  const auth = useAuthStore((state) => state.auth)
  const navigate = useNavigate()
  const { t } = useTranslation()
  const logoutInProgressRef = useRef(false)

  useEffect(() => {
    if (!user) return

    let lastRecordedAt = 0

    const recordActivity = () => {
      const now = Date.now()
      if (now - lastRecordedAt < SESSION_ACTIVITY_THROTTLE_MS) return
      lastRecordedAt = now
      markSessionActivity(now)
    }

    const performLogout = async (options: { notify: boolean; sync: boolean }) => {
      if (logoutInProgressRef.current) return
      logoutInProgressRef.current = true

      try {
        if (options.sync) {
          broadcastIdleLogout()
        }

        try {
          await logout()
        } catch {
          /* empty */
        }

        auth.reset()

        try {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('uid')
          }
        } catch {
          /* empty */
        }

        if (options.notify) {
          toast.info(
            t(
              'You have been signed out due to inactivity. Please sign in again.'
            )
          )
        }

        navigate({ to: '/sign-in' })
      } finally {
        logoutInProgressRef.current = false
      }
    }

    const evaluateIdleTimeout = () => {
      if (document.hidden) return
      const idleFor = Date.now() - readSessionActivityAt()
      if (idleFor >= SESSION_IDLE_TIMEOUT_MS) {
        void performLogout({ notify: true, sync: true })
      }
    }

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === SESSION_IDLE_LOGOUT_STORAGE_KEY &&
        event.newValue != null
      ) {
        void performLogout({ notify: false, sync: false })
      }
    }

    recordActivity()

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, { passive: true })
    })

    const onVisibilityChange = () => {
      if (!document.hidden) {
        recordActivity()
        evaluateIdleTimeout()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    const intervalId = window.setInterval(
      evaluateIdleTimeout,
      SESSION_ACTIVITY_CHECK_INTERVAL_MS
    )
    window.addEventListener('storage', onStorage)

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity)
      })
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('storage', onStorage)
      window.clearInterval(intervalId)
    }
  }, [auth, navigate, t, user])
}

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
import { isRegistrationEmailVerified } from '../../lib/registration-email-verification'
import {
  type EmailVerificationState,
  markEmailSent,
  markEmailUnverified,
  markEmailVerified,
} from './email-verification-state'

type EmailVerificationStatusFetcher = (email: string) => Promise<unknown>

type EmailVerificationStatusRefresherOptions = {
  cooldownMs: number
  now: () => number
  refresh: () => Promise<void>
}

type EmailVerificationStatusSyncOptions =
  EmailVerificationStatusRefresherOptions & {
    subscribe: (listener: () => void) => () => void
    addFocusListener: (listener: () => void) => void
    removeFocusListener: (listener: () => void) => void
    addVisibilityListener: (listener: () => void) => void
    removeVisibilityListener: (listener: () => void) => void
    isVisible: () => boolean
    focusRegistrationWindow: () => void
  }

export async function refreshRegistrationEmailVerificationState(
  state: EmailVerificationState,
  email: string,
  getStatus: EmailVerificationStatusFetcher
): Promise<EmailVerificationState> {
  const normalizedEmail = email.trim()
  if (!normalizedEmail) return markEmailUnverified(state, email)

  const response = await getStatus(normalizedEmail)
  if (!isRegistrationEmailVerified(response)) {
    return markEmailUnverified(state, normalizedEmail)
  }

  return markEmailVerified(
    markEmailSent(state, normalizedEmail),
    normalizedEmail
  )
}

export function createEmailVerificationStatusRefresher(
  options: EmailVerificationStatusRefresherOptions
) {
  let stopped = false
  let inFlight: Promise<void> | null = null
  let lastStartedAt = Number.NEGATIVE_INFINITY

  return {
    refresh(): Promise<void> {
      if (stopped) return Promise.resolve()
      if (inFlight) return inFlight

      const now = options.now()
      if (now - lastStartedAt < options.cooldownMs) {
        return Promise.resolve()
      }

      lastStartedAt = now
      const request = options.refresh()
      const trackedRequest = request.finally(() => {
        if (inFlight === trackedRequest) inFlight = null
      })
      inFlight = trackedRequest
      return trackedRequest
    },
    stop() {
      stopped = true
    },
  }
}

export function startEmailVerificationStatusSync(
  options: EmailVerificationStatusSyncOptions
): () => void {
  const statusRefresher = createEmailVerificationStatusRefresher(options)
  const handleFocus = () => {
    void statusRefresher.refresh()
  }
  const handleVisibilityChange = () => {
    if (options.isVisible()) void statusRefresher.refresh()
  }
  const unsubscribe = options.subscribe(() => {
    try {
      options.focusRegistrationWindow()
    } catch (_error) {
      // Browser focus policies are best-effort; verification still continues.
    }
    void options.refresh()
  })

  options.addFocusListener(handleFocus)
  options.addVisibilityListener(handleVisibilityChange)
  void statusRefresher.refresh()

  return () => {
    statusRefresher.stop()
    unsubscribe()
    options.removeFocusListener(handleFocus)
    options.removeVisibilityListener(handleVisibilityChange)
  }
}

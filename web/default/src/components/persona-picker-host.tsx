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
import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useShouldPromptPersona } from '@/hooks/use-persona'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Universal onboarding-routing host. Mounted once inside
 * AuthenticatedLayout. When the authenticated user's setting JSON
 * contains the 'unset' persona sentinel (placed by backend Register
 * OR seeded for new OAuth signups), redirect them to /welcome — the
 * full-page 3-step wizard handles persona/brand/client capture.
 *
 * Why a redirect instead of a modal:
 *   - Single funnel: email/password Register, OAuth callbacks, and
 *     legacy users who haven't picked persona all land at /welcome
 *   - More space than a modal — wizard cards + welcome banner fit
 *   - Easier to test, link to, A/B
 *   - PersonaPickerDialog modal still exists (used by /welcome and
 *     /profile preset switcher) — just not as a blocking layout-level
 *     modal anymore
 *
 * Loop prevention:
 *   - skip the redirect when already on /welcome
 *   - skip ONE redirect right after the wizard's Finish — the wizard
 *     sets sessionStorage['dr_welcome_just_finished'] before navigating
 *     to the persona's default route. Without this guard there's a
 *     race where setUser hasn't propagated to all useAuthStore
 *     subscribers by the time PersonaPickerHost's effect re-runs on
 *     the destination route, so `shouldPrompt` is still true and the
 *     host bounces the user back to /welcome (defaulting to step 1).
 *     This guard is one-shot: consume the flag and never block again.
 */
const WELCOME_JUST_FINISHED_KEY = 'dr_welcome_just_finished'

export function PersonaPickerHost() {
  const shouldPrompt = useShouldPromptPersona()
  const user = useAuthStore((s) => s.auth.user)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user || !shouldPrompt) return
    const path =
      typeof window !== 'undefined' ? window.location.pathname : ''
    if (path === '/welcome') return
    if (typeof window !== 'undefined') {
      try {
        if (
          window.sessionStorage.getItem(WELCOME_JUST_FINISHED_KEY) === '1'
        ) {
          // One-shot: consume the flag and skip this redirect. By the
          // next render the store-update is guaranteed to have settled.
          window.sessionStorage.removeItem(WELCOME_JUST_FINISHED_KEY)
          return
        }
      } catch {
        /* private mode / disabled storage — fall through to the normal
         * redirect path. The only cost is the bounce the user reported. */
      }
    }
    navigate({ to: '/welcome', replace: true })
  }, [user, shouldPrompt, navigate])

  return null
}

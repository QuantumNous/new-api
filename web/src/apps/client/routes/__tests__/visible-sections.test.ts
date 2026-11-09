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
import { isRedirect, type AnyRedirect } from '@tanstack/react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { ROLE } from '@/shared/lib/roles'
import { useAuthStore, type AuthBundle } from '@/shared/stores/auth-store'

import { requireVisibleClientSection } from '../guards'

function seedUser(visibleSections?: string[]): void {
  const bundle: AuthBundle = {
    access_token: 'section-guard-token',
    token_type: 'Bearer',
    access_expires_at: 9999999999,
    user: {
      id: 21,
      username: 'section-guard-user',
      role: ROLE.USER,
      visible_sections: visibleSections,
    },
    session: {
      sid: 'section-guard-session',
      current: true,
      login_method: 'password',
      ip: '',
      user_agent: '',
      created_at: 1,
      last_active_at: 1,
      expires_at: 9999999999,
    },
  }
  useAuthStore.getState().auth.setBundle(bundle)
}

function captureRedirect(locationHref: string): AnyRedirect | null {
  try {
    requireVisibleClientSection(locationHref)
    return null
  } catch (error) {
    if (isRedirect(error)) return error
    throw error
  }
}

afterEach(() => {
  useAuthStore.getState().auth.reset('idle')
})

describe('client route section guard', () => {
  it('allows every client route when the account is unrestricted', () => {
    seedUser(undefined)
    expect(captureRedirect('/app/wallet')).toBeNull()

    useAuthStore.getState().auth.reset('idle')
    seedUser([])
    expect(captureRedirect('/app/workspace/overview')).toBeNull()
  })

  it('allows a granted section and its own deep links', () => {
    seedUser(['wallet', 'chat'])

    expect(captureRedirect('/app/wallet')).toBeNull()
    expect(captureRedirect('/app/chat/42')).toBeNull()
  })

  it('redirects a blocked deep link to the first permitted section', () => {
    seedUser(['wallet'])

    const redirect = captureRedirect('/app/workspace/overview')

    expect(redirect?.options.href).toBe('/app/wallet')
  })

  it('sends the visitor to /403 when no client section is granted', () => {
    seedUser(['users', 'channels'])

    const redirect = captureRedirect('/app/wallet')

    expect(redirect?.options.to).toBe('/403')
  })

  it('keeps unmapped client paths reachable', () => {
    seedUser(['wallet'])

    expect(captureRedirect('/app')).toBeNull()
  })
})

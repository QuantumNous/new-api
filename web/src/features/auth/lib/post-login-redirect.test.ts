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
import { describe, expect, test } from 'vitest'

import { ROLE } from '@/lib/roles'

import { resolvePostLoginTarget } from './post-login-redirect'

describe('post-login redirect policy', () => {
  test('preserves only targets allowed for the new account', async () => {
    expect(
      await resolvePostLoginTarget(
        '/agent-admin',
        { role: ROLE.ADMIN },
        async () => false
      )
    ).toBe('/agent-admin')
    expect(
      await resolvePostLoginTarget(
        '/agent-admin',
        { role: ROLE.USER },
        async () => false
      )
    ).toBe('/dashboard')
    expect(
      await resolvePostLoginTarget(
        '/agents',
        { role: ROLE.USER },
        async () => true
      )
    ).toBe('/agents')
    expect(
      await resolvePostLoginTarget(
        '/agents',
        { role: ROLE.USER },
        async () => false
      )
    ).toBe('/dashboard')
    expect(
      await resolvePostLoginTarget(
        '/wallet?tab=topup',
        { role: ROLE.USER },
        async () => false
      )
    ).toBe('/wallet?tab=topup')
  })

  test('requires Root for system routes and preserves query fragments', async () => {
    expect(
      await resolvePostLoginTarget(
        '/system-settings/site?tab=branding#logo',
        { role: ROLE.SUPER_ADMIN },
        async () => false
      )
    ).toBe('/system-settings/site?tab=branding#logo')
    expect(
      await resolvePostLoginTarget(
        '/system-settings/site',
        { role: ROLE.ADMIN },
        async () => false
      )
    ).toBe('/dashboard')
  })

  test('rejects external, malformed, and auth/error targets', async () => {
    for (const target of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/agent\\admin',
      '/403',
      '/sign-in',
      '/otp',
    ]) {
      expect(
        await resolvePostLoginTarget(
          target,
          { role: ROLE.USER },
          async () => false
        )
      ).toBe('/dashboard')
    }
  })

  test('uses path boundaries for protected routes', async () => {
    expect(
      await resolvePostLoginTarget(
        '/users-example',
        { role: ROLE.USER },
        async () => false
      )
    ).toBe('/users-example')
  })

  test('probes agent access only for an agent target', async () => {
    let calls = 0
    const probe = async () => {
      calls += 1
      return true
    }

    await resolvePostLoginTarget('/wallet', { role: ROLE.USER }, probe)
    await resolvePostLoginTarget('/agent-admin', { role: ROLE.ADMIN }, probe)
    expect(calls).toBe(0)

    await resolvePostLoginTarget('/agents', { role: ROLE.USER }, probe)
    expect(calls).toBe(1)
  })

  test('falls back when the agent access probe fails', async () => {
    expect(
      await resolvePostLoginTarget('/agents', { role: ROLE.USER }, async () => {
        throw new Error('temporary failure')
      })
    ).toBe('/dashboard')
  })
})

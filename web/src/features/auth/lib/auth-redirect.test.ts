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
import { describe, expect, test, vi } from 'vitest'

import type { AuthUser } from '@/stores/auth-store'

import {
  getSavedLanguage,
  navigateAfterAuthentication,
  sanitizeAuthRedirect,
} from './auth-redirect'

const origin = 'https://dashboard.example.com'

describe('authentication redirect validation', () => {
  test('preserves safe internal paths, search parameters, and fragments', () => {
    expect(sanitizeAuthRedirect('/console?tab=usage#recent', origin)).toBe(
      '/console?tab=usage#recent'
    )
    expect(
      sanitizeAuthRedirect(
        'https://dashboard.example.com/dashboard?tab=quota#daily',
        origin
      )
    ).toBe('/dashboard?tab=quota#daily')
  })

  test('rejects external and ambiguously parsed redirect targets', () => {
    const unsafeTargets: unknown[] = [
      undefined,
      '',
      'dashboard',
      '//attacker.example/path',
      'https://attacker.example/path',
      'javascript:alert(1)',
      '/\\attacker.example/path',
      'https:\\attacker.example/path',
    ]

    for (const target of unsafeTargets) {
      expect(sanitizeAuthRedirect(target, origin)).toBe(null)
    }
  })

  test('rejects invalid or non-HTTP application origins', () => {
    expect(sanitizeAuthRedirect('/dashboard', 'not-an-origin')).toBe(null)
    expect(sanitizeAuthRedirect('/dashboard', 'file:///tmp/app')).toBe(null)
  })
})

describe('authentication redirect navigation', () => {
  test('replaces the document for the Canvas SSO endpoint', async () => {
    const navigate = vi.fn()
    const replaceDocument = vi.fn()

    await navigateAfterAuthentication(
      '/_canvas_sso',
      origin,
      navigate,
      replaceDocument
    )

    expect(replaceDocument).toHaveBeenCalledWith('/_canvas_sso')
    expect(navigate).not.toHaveBeenCalled()
  })

  test('uses client navigation for safe application routes', async () => {
    const navigate = vi.fn()
    const replaceDocument = vi.fn()

    await navigateAfterAuthentication(
      '/dashboard?tab=usage#recent',
      origin,
      navigate,
      replaceDocument
    )

    expect(navigate).toHaveBeenCalledWith({
      href: '/dashboard?tab=usage#recent',
      replace: true,
    })
    expect(replaceDocument).not.toHaveBeenCalled()
  })

  test('rejects unsafe external targets and navigates to the dashboard', async () => {
    const navigate = vi.fn()
    const replaceDocument = vi.fn()

    await navigateAfterAuthentication(
      'https://attacker.example/path',
      origin,
      navigate,
      replaceDocument
    )

    expect(navigate).toHaveBeenCalledWith({
      href: '/dashboard',
      replace: true,
    })
    expect(replaceDocument).not.toHaveBeenCalled()
  })
})

describe('saved authentication language', () => {
  const user: AuthUser = { id: 1, username: 'user', role: 1 }

  test('prefers the explicit user language', () => {
    expect(
      getSavedLanguage({
        ...user,
        language: 'ja',
        setting: { language: 'fr' },
      })
    ).toBe('ja')
  })

  test('reads object and JSON string settings', () => {
    expect(getSavedLanguage({ ...user, setting: { language: 'fr' } })).toBe(
      'fr'
    )
    expect(getSavedLanguage({ ...user, setting: '{"language":"ru"}' })).toBe(
      'ru'
    )
  })

  test('ignores malformed and non-string setting languages', () => {
    expect(getSavedLanguage({ ...user, setting: '{' })).toBe(undefined)
    expect(getSavedLanguage({ ...user, setting: { language: 123 } })).toBe(
      undefined
    )
  })
})

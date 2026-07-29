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
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  normalizeReturnTarget,
  rewritePathlessBrowserPath,
} from './normalize-return-target'

afterEach(() => vi.unstubAllGlobals())

describe('normalizeReturnTarget', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    [
      '/desktop/authorize?request=abc#decision',
      '/desktop/authorize?request=abc#decision',
    ],
    ['/_authenticated/profile/', '/profile/'],
    ['/_authenticated/profile', '/profile'],
    ['/(auth)/sign-in', '/sign-in'],
    ['/(errors)/404', '/404'],
  ])('keeps an internal path', (target, expected) => {
    expect(normalizeReturnTarget(target)).toBe(expected)
  })

  it.each([
    undefined,
    '',
    '//evil.example/path',
    '/\\evil.example/path',
    '/path\nnext',
    'javascript:alert(1)',
    'data:text/html,hello',
    'https://evil.example/path',
  ])('falls back for unsafe target %s', (target) => {
    expect(normalizeReturnTarget(target)).toBe('/dashboard')
  })

  it('converts a same-origin absolute URL in the browser', () => {
    vi.stubGlobal('window', { location: { origin: 'https://box.example' } })
    expect(
      normalizeReturnTarget(
        'https://box.example/desktop/authorize?request=abc#ok'
      )
    ).toBe('/desktop/authorize?request=abc#ok')
  })
})

describe('rewritePathlessBrowserPath', () => {
  it.each([
    ['/_authenticated/profile/', '/profile/'],
    ['/_authenticated/profile', '/profile'],
    ['/(errors)/500', '/500'],
    ['/profile', null],
    ['/dashboard/models', null],
  ] as const)('rewrites %s → %s', (input, expected) => {
    expect(rewritePathlessBrowserPath(input)).toBe(expected)
  })
})

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
import { describe, expect, test } from 'bun:test'
import {
  buildLanguagePreferenceCookie,
  LANGUAGE_PREFERENCE_COOKIE,
} from './language-preference-cookie'

describe('language preference cookie', () => {
  test('builds the shared-domain language cookie used by website and console', () => {
    expect(buildLanguagePreferenceCookie('ja', '.flatkey.ai')).toBe(
      `${LANGUAGE_PREFERENCE_COOKIE}=ja; Path=/; Domain=.flatkey.ai; Max-Age=31536000; SameSite=Lax`
    )
  })

  test('normalizes regional language codes before writing', () => {
    expect(buildLanguagePreferenceCookie('ja-JP', '.flatkey.ai')).toContain(
      `${LANGUAGE_PREFERENCE_COOKIE}=ja;`
    )
  })

  test('rejects unsupported languages instead of coercing them to English', () => {
    expect(buildLanguagePreferenceCookie('de', '.flatkey.ai')).toBeNull()
  })
})

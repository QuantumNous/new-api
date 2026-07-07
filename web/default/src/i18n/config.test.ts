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
  LANGUAGE_DETECTION_OPTIONS,
  LANGUAGE_PREFERENCE_COOKIE,
} from './config'

describe('i18n language detection', () => {
  test('reads the shared website language cookie before console localStorage', () => {
    expect(LANGUAGE_PREFERENCE_COOKIE).toBe('fk_locale')
    expect(LANGUAGE_DETECTION_OPTIONS.lookupCookie).toBe(
      LANGUAGE_PREFERENCE_COOKIE
    )
    expect(LANGUAGE_DETECTION_OPTIONS.order).toEqual([
      'querystring',
      'cookie',
      'localStorage',
      'navigator',
    ])
    expect(LANGUAGE_DETECTION_OPTIONS.caches).toEqual(['localStorage'])
  })
})

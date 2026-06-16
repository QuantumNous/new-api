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
import { officialWebsiteUrl } from './origins'

describe('officialWebsiteUrl', () => {
  test('builds paths from OFFICIAL_WEBSITE_ORIGIN without duplicate slashes', () => {
    expect(officialWebsiteUrl('/pricing', 'https://flatkey.ai/')).toBe(
      'https://flatkey.ai/pricing'
    )
  })

  test('falls back to an app-relative path when the origin is not configured', () => {
    expect(officialWebsiteUrl('/pricing', '')).toBe('/pricing')
  })
})

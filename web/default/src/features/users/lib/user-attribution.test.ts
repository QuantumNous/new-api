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
import { getUserAttributionDisplay } from './user-attribution'

describe('getUserAttributionDisplay', () => {
  test('shows paid source with campaign and keyword', () => {
    const display = getUserAttributionDisplay(
      JSON.stringify({
        source_type: 'paid',
        source: 'google',
        medium: 'cpc',
        campaign: 'signup',
        keyword: 'flatkey api',
        landing_path: '/pricing',
      })
    )

    expect(display.sourceType).toBe('paid')
    expect(display.badgeLabel).toBe('Paid Ads')
    expect(display.sourceMedium).toBe('google / cpc')
    expect(display.detail).toBe('signup / flatkey api')
    expect(display.landingPath).toBe('/pricing')
    expect(display.hasAttribution).toBe(true)
  })

  test('falls back to raw utm fields for legacy rows', () => {
    const display = getUserAttributionDisplay(
      JSON.stringify({
        utm_source: 'newsletter',
        utm_medium: 'email',
        utm_campaign: 'june',
      })
    )

    expect(display.sourceType).toBe('utm')
    expect(display.badgeLabel).toBe('UTM')
    expect(display.sourceMedium).toBe('newsletter / email')
    expect(display.detail).toBe('june')
  })

  test('shows no source when attribution is empty or invalid', () => {
    const display = getUserAttributionDisplay('not-json')

    expect(display.hasAttribution).toBe(false)
    expect(display.badgeLabel).toBe('No source')
    expect(display.sourceMedium).toBe('')
  })
})

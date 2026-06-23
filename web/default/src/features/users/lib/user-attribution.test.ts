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
  getSafeAttributionTooltipRaw,
  getUserAttributionDisplay,
} from './user-attribution'

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

  test('shows affiliate-only attribution as affiliate traffic', () => {
    const display = getUserAttributionDisplay(
      JSON.stringify({
        aff: 'partner-42',
        landing_path: '/sign-up',
      })
    )

    expect(display.sourceType).toBe('affiliate')
    expect(display.badgeLabel).toBe('Affiliate')
    expect(display.sourceMedium).toBe('partner-42 / affiliate')
    expect(display.landingPath).toBe('/sign-up')
    expect(display.hasAttribution).toBe(true)
  })

  test('ignores unknown raw source type when valid attribution signals exist', () => {
    const display = getUserAttributionDisplay(
      JSON.stringify({
        source_type: 'google_ads',
        gclid: 'paid-click',
        utm_source: 'google',
      })
    )

    expect(display.sourceType).toBe('paid')
    expect(display.badgeLabel).toBe('Paid Ads')
    expect(display.hasAttribution).toBe(true)
  })

  test('shows no source for payload without attribution signals', () => {
    const display = getUserAttributionDisplay(
      JSON.stringify({
        foo: 'bar',
        captured_at: '2026-06-16T00:00:00.000Z',
      })
    )

    expect(display.hasAttribution).toBe(false)
    expect(display.badgeLabel).toBe('No source')
    expect(display.sourceMedium).toBe('')
  })

  test('tooltip raw only exposes whitelisted attribution fields', () => {
    const safeRaw = getSafeAttributionTooltipRaw({
      source_type: 'paid',
      source: 'google',
      aff: 'partner-42',
      referrer: 'https://example.com/?token=secret',
      landing_path: '/sign-up?email=user@example.com',
      gclid: 'click-id',
      foo: 'bar',
    })

    expect(safeRaw).toEqual({
      source_type: 'paid',
      source: 'google',
      aff: 'partner-42',
      gclid: 'click-id',
    })
  })

  test('shows no source when attribution is empty or invalid', () => {
    const display = getUserAttributionDisplay('not-json')

    expect(display.hasAttribution).toBe(false)
    expect(display.badgeLabel).toBe('No source')
    expect(display.sourceMedium).toBe('')
  })
})

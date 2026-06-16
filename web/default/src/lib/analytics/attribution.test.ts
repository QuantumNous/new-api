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
  getAttributionPayload,
  mergeAttributionValues,
  normalizeAttribution,
  parseAttributionPayload,
} from './attribution'

describe('attribution normalization', () => {
  test('classifies click ids as paid ads with highest priority', () => {
    const normalized = normalizeAttribution({
      gclid: 'google-click-id',
      utm_source: 'google',
      utm_medium: 'organic',
      utm_campaign: 'brand',
      referrer: 'https://www.google.com/search?q=flatkey',
    })

    expect(normalized.source_type).toBe('paid')
    expect(normalized.is_paid).toBe('true')
    expect(normalized.source).toBe('google')
    expect(normalized.medium).toBe('cpc')
    expect(normalized.campaign).toBe('brand')
  })

  test('does not classify ordinary non-paid utm traffic as paid ads', () => {
    const normalized = normalizeAttribution({
      utm_source: 'newsletter',
      utm_medium: 'email',
      utm_campaign: 'launch',
    })

    expect(normalized.source_type).toBe('utm')
    expect(normalized.is_paid).toBe('false')
    expect(normalized.source).toBe('newsletter')
    expect(normalized.medium).toBe('email')
    expect(normalized.campaign).toBe('launch')
  })

  test('classifies search referrers as organic and extracts available query keywords', () => {
    const normalized = normalizeAttribution({
      referrer: 'https://www.bing.com/search?q=ai+gateway',
    })

    expect(normalized.source_type).toBe('organic')
    expect(normalized.source).toBe('bing')
    expect(normalized.medium).toBe('organic')
    expect(normalized.keyword).toBe('ai gateway')
  })

  test('keeps existing paid attribution when later navigation only has organic signals', () => {
    const merged = mergeAttributionValues(
      {
        gclid: 'first-paid-click',
        utm_source: 'google',
        utm_medium: 'cpc',
        landing_path: '/pricing',
      },
      {
        referrer: 'https://www.google.com/search?q=flatkey',
        landing_path: '/models',
      }
    )

    expect(merged.gclid).toBe('first-paid-click')
    expect(merged.landing_path).toBe('/pricing')
    expect(merged.source_type).toBe('paid')
  })

  test('keeps first landing page when later navigation has no new campaign signal', () => {
    const merged = mergeAttributionValues(
      {
        utm_source: 'newsletter',
        utm_medium: 'email',
        utm_campaign: 'signup',
        landing_path: '/pricing',
        captured_at: '2026-06-16T00:00:00.000Z',
      },
      {
        landing_path: '/models',
        captured_at: '2026-06-16T00:01:00.000Z',
      }
    )

    expect(merged.landing_path).toBe('/pricing')
    expect(merged.captured_at).toBe('2026-06-16T00:00:00.000Z')
    expect(merged.source_type).toBe('utm')
  })

  test('keeps direct first landing page across route changes', () => {
    const merged = mergeAttributionValues(
      {
        landing_path: '/pricing',
        captured_at: '2026-06-16T00:00:00.000Z',
        source_type: 'direct',
        source: 'direct',
        medium: 'none',
      },
      {
        landing_path: '/sign-up',
        captured_at: '2026-06-16T00:02:00.000Z',
      }
    )

    expect(merged.landing_path).toBe('/pricing')
    expect(merged.captured_at).toBe('2026-06-16T00:00:00.000Z')
    expect(merged.source_type).toBe('direct')
  })

  test('payload includes raw and normalized values for user list display', () => {
    const payload = getAttributionPayload({
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'signup',
      utm_term: 'flatkey api',
      landing_path: '/sign-up',
    })
    const parsed = parseAttributionPayload(payload)

    expect(parsed.utm_source).toBe('google')
    expect(parsed.source_type).toBe('paid')
    expect(parsed.source).toBe('google')
    expect(parsed.medium).toBe('cpc')
    expect(parsed.campaign).toBe('signup')
    expect(parsed.keyword).toBe('flatkey api')
  })
})

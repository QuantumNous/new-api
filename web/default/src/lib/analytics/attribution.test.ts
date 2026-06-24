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
  captureAdsAttribution,
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

  test('classifies affiliate-only traffic before direct traffic', () => {
    const normalized = normalizeAttribution({
      aff: 'partner-42',
    })

    expect(normalized.source_type).toBe('affiliate')
    expect(normalized.source).toBe('partner-42')
    expect(normalized.medium).toBe('affiliate')
    expect(normalized.is_paid).toBe('false')
  })

  test('does not classify lookalike search domains as organic', () => {
    const normalized = normalizeAttribution({
      referrer: 'https://evilgoogle.com/search?q=flatkey',
    })

    expect(normalized.source_type).toBe('referral')
    expect(normalized.source).toBe('https://evilgoogle.com/search?q=flatkey')
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

  test('stores external referrer keyword without raw query or hash', () => {
    const storage = new Map<string, string>()
    const originalWindow = globalThis.window
    const originalDocument = globalThis.document

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          origin: 'https://console.flatkey.ai',
          pathname: '/sign-up',
          search: '',
        },
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        referrer:
          'https://www.google.com/search?q=flatkey+api&token=email@example.com#private-token',
      },
    })

    try {
      const captured = JSON.stringify(captureAdsAttribution())

      expect(captured).toContain('flatkey api')
      expect(captured).not.toContain('token=')
      expect(captured).not.toContain('email@example.com')
      expect(captured).not.toContain('private-token')
      expect(captured).toContain('https://www.google.com/search')
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      })
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: originalDocument,
      })
    }
  })

  test('capture path classifies organic referrers and safely stores search keywords', () => {
    const storage = new Map<string, string>()
    const originalWindow = globalThis.window
    const originalDocument = globalThis.document

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          origin: 'https://console.flatkey.ai',
          pathname: '/sign-up',
          search: '',
        },
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        referrer:
          'https://www.google.com/search?q=flatkey+api&token=email@example.com#private-token',
      },
    })

    try {
      const captured = captureAdsAttribution()

      expect(captured.source_type).toBe('organic')
      expect(captured.source).toBe('google')
      expect(captured.medium).toBe('organic')
      expect(captured.keyword).toBe('flatkey api')
      expect(captured.referrer).toBe('https://www.google.com/search')
      expect(JSON.stringify(captured)).not.toContain('token=')
      expect(JSON.stringify(captured)).not.toContain('email@example.com')
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      })
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: originalDocument,
      })
    }
  })

  test('capture path preserves affiliate-only attribution', () => {
    const storage = new Map<string, string>()
    const originalWindow = globalThis.window
    const originalDocument = globalThis.document

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          origin: 'https://console.flatkey.ai',
          pathname: '/sign-up',
          search: '?aff=partner-42',
        },
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        referrer: '',
      },
    })

    try {
      const captured = captureAdsAttribution()

      expect(captured.aff).toBe('partner-42')
      expect(captured.source_type).toBe('affiliate')
      expect(captured.source).toBe('partner-42')
      expect(captured.medium).toBe('affiliate')
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      })
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: originalDocument,
      })
    }
  })

  test('capture path imports attribution from the shared flatkey cookie', () => {
    const storage = new Map<string, string>()
    const originalWindow = globalThis.window
    const originalDocument = globalThis.document
    const sharedAttribution = encodeURIComponent(
      JSON.stringify({
        utm_source: 'newsletter',
        utm_medium: 'email',
        utm_campaign: 'june',
        landing_path: '/',
        captured_at: '2026-06-24T00:00:00.000Z',
      })
    )

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          origin: 'https://console.flatkey.ai',
          pathname: '/sign-up',
          search: '',
        },
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        cookie: `flatkey_ads_attribution=${sharedAttribution}; other=value`,
        referrer: '',
      },
    })

    try {
      const captured = captureAdsAttribution()

      expect(captured.utm_source).toBe('newsletter')
      expect(captured.utm_medium).toBe('email')
      expect(captured.utm_campaign).toBe('june')
      expect(captured.landing_path).toBe('/')
      expect(captured.source_type).toBe('utm')
      expect(captured.source).toBe('newsletter')
      expect(captured.medium).toBe('email')
      expect(captured.campaign).toBe('june')
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      })
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: originalDocument,
      })
    }
  })
})

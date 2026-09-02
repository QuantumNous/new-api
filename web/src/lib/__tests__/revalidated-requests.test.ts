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
import type { AxiosAdapter } from 'axios'
import { describe, expect, test } from 'vitest'

import { getAboutContent } from '@/features/about/api'
import { getHomePageContent } from '@/features/home/api'
import { getPrivacyPolicy, getUserAgreement } from '@/features/legal/api'
import { api, getNotice } from '@/lib/api'

/**
 * Capture the headers axios would actually put on the wire.
 *
 * These two endpoints rely on the browser holding an ETag and revalidating
 * with `If-None-Match`. A `Cache-Control: no-store` request header forbids the
 * browser from storing the response at all (RFC 9111 5.2.1.5), so the client
 * would never have a validator to send and the server could never answer 304.
 * The axios instance sets `no-store` globally, so these call sites must drop
 * it -- and axios only omits a header when its value is null, which is an
 * implementation detail worth pinning across axios upgrades.
 */
function captureRequestHeaders(): {
  restore: () => void
  headersFor: (url: string) => Record<string, unknown>
} {
  const seen = new Map<string, Record<string, unknown>>()
  const originalAdapter = api.defaults.adapter

  const adapter: AxiosAdapter = async (config) => {
    // toJSON() is the stage the real xhr adapter serializes through, and where
    // null-valued headers are dropped. Reading config.headers directly would
    // still show the null entry and prove nothing about the wire.
    seen.set(config.url ?? '', config.headers.toJSON() as Record<
      string,
      unknown
    >)
    return {
      data: { success: true, message: '', data: '' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
  api.defaults.adapter = adapter

  return {
    restore: () => {
      api.defaults.adapter = originalAdapter
    },
    headersFor: (url: string) => seen.get(url) ?? {},
  }
}

describe('cache revalidation for public endpoints', () => {
  test('the axios instance sends no-store by default', async () => {
    const captured = captureRequestHeaders()
    try {
      await api.get('/api/user/self')
      expect(captured.headersFor('/api/user/self')['Cache-Control']).toBe(
        'no-store'
      )
    } finally {
      captured.restore()
    }
  })

  test('public option-backed endpoints omit Cache-Control so the browser can revalidate', async () => {
    const captured = captureRequestHeaders()
    try {
      await getNotice()
      await getHomePageContent()
      await getAboutContent()
      await getUserAgreement()
      await getPrivacyPolicy()

      for (const url of [
        '/api/notice',
        '/api/home_page_content',
        '/api/about',
        '/api/user-agreement',
        '/api/privacy-policy',
      ]) {
        const headers = captured.headersFor(url)
        expect(Object.keys(headers)).not.toContain('Cache-Control')
        expect(headers['Cache-Control']).toBeUndefined()
      }
    } finally {
      captured.restore()
    }
  })
})

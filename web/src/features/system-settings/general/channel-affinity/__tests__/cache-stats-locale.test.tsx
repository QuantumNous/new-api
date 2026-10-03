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
import { cleanup, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getAffinityUsageCache } from '../api'
import { CacheStatsDialog } from '../cache-stats-dialog'

vi.mock('../api', () => ({ getAffinityUsageCache: vi.fn() }))

function renderDialog(): void {
  vi.mocked(getAffinityUsageCache).mockResolvedValue({
    success: true,
    data: {
      hit: 3,
      total: 4,
      window_seconds: 300,
      prompt_tokens: 1200,
      cached_tokens: 600,
      completion_tokens: 80,
      total_tokens: 1280,
    },
  } as Awaited<ReturnType<typeof getAffinityUsageCache>>)
  render(
    <CacheStatsDialog
      open
      onOpenChange={() => undefined}
      target={{
        rule_name: 'rule',
        using_group: 'default',
        key_hint: 'sk-…abcd',
        key_fp: 'fp',
      }}
    />
  )
}

function rowValue(label: string): string | null {
  return screen.getByText(label).nextElementSibling?.textContent ?? null
}

afterEach(async () => {
  cleanup()
  vi.clearAllMocks()
  await i18next.changeLanguage('en')
})

describe('channel affinity cache stats', () => {
  it.each([
    {
      language: 'English',
      lng: 'en',
      ttl: '300',
      hitRate: '3/4 (75.00%)',
      tokens: ['1200', '600', '80', '1280'],
    },
    {
      language: 'Persian',
      lng: 'fa',
      ttl: '۳۰۰',
      hitRate: '۳/۴ (۷۵٫۰۰٪)',
      tokens: ['۱۲۰۰', '۶۰۰', '۸۰', '۱۲۸۰'],
    },
  ])(
    'in $language, writes the TTL, the hit rate and the token counts in the interface digits',
    async ({ lng, ttl, hitRate, tokens }) => {
      await i18next.changeLanguage(lng)
      renderDialog()
      await screen.findByText('Hit Rate')
      expect(rowValue('TTL (seconds)')).toBe(ttl)
      expect(rowValue('Hit Rate')).toBe(hitRate)
      expect(
        [
          'Prompt tokens',
          'Cached tokens',
          'Completion tokens',
          'Total tokens',
        ].map(rowValue)
      ).toEqual(tokens)
    }
  )
})

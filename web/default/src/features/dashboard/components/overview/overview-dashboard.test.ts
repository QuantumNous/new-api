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
import { existsSync, readFileSync } from 'node:fs'

const legacyBannerKeys = [
  'Only {{balance}} left — keep using Claude / GPT?',
  'Top up $10 → the <z>full $10 lands, zero fee</z>. On OpenRouter, $10 only loads $9.45.',
  'Top up $10 → the <z>full $10 lands, zero fee</z> + bonus. On OpenRouter, $10 only loads $9.45.',
  'Top up — zero fee →',
]

describe('subscription dashboard messaging', () => {
  test('does not expose the legacy low-balance top-up campaign', () => {
    const dashboardSource = readFileSync(
      new URL('./overview-dashboard.tsx', import.meta.url),
      'utf8'
    )
    const legacyBannerUrl = new URL('./topup-bonus-banner.tsx', import.meta.url)

    expect(dashboardSource).not.toContain('TopupBonusBanner')
    expect(existsSync(legacyBannerUrl)).toBe(false)

    for (const locale of ['en', 'es', 'fr', 'ja', 'pt', 'ru', 'vi', 'zh']) {
      const localeFile = JSON.parse(
        readFileSync(
          new URL(`../../../../i18n/locales/${locale}.json`, import.meta.url),
          'utf8'
        )
      ) as { translation: Record<string, string> }

      for (const key of legacyBannerKeys) {
        expect(
          Object.prototype.hasOwnProperty.call(localeFile.translation, key),
          `${locale} should not retain legacy low-balance top-up copy: ${key}`
        ).toBe(false)
      }
    }
  })
})

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
import { existsSync, readdirSync, readFileSync } from 'node:fs'

const LOCALES = ['en', 'es', 'fr', 'ja', 'pt', 'ru', 'vi', 'zh'] as const

// Product names stay identical in every language by design; they are also
// registered in scripts/sync-i18n.mjs BRAND_AND_LITERAL_KEYS.
const BRAND_KEYS = new Set(['Flatkey CLI', 'Codex & Claude Code'])

function readLocale(locale: string): Record<string, string> {
  const file = JSON.parse(
    readFileSync(
      new URL(`../../../../i18n/locales/${locale}.json`, import.meta.url),
      'utf8'
    )
  ) as { translation: Record<string, string> }
  return file.translation
}

/** Every t('...') / t("...") literal used by the overview components. */
function collectOverviewKeys(): string[] {
  const dir = new URL('./', import.meta.url)
  const keys = new Set<string>()

  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.tsx')) continue
    const source = readFileSync(new URL(name, dir), 'utf8')
    for (const match of source.matchAll(
      /\bt\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g
    )) {
      keys.add(match[2].replace(/\\'/g, "'").replace(/\\"/g, '"'))
    }
  }

  return [...keys]
}

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

    for (const locale of LOCALES) {
      const translation = readLocale(locale)

      for (const key of legacyBannerKeys) {
        expect(
          Object.prototype.hasOwnProperty.call(translation, key),
          `${locale} should not retain legacy low-balance top-up copy: ${key}`
        ).toBe(false)
      }
    }
  })
})

describe('overview integration copy', () => {
  const overviewKeys = collectOverviewKeys()

  test('finds the overview copy it is meant to guard', () => {
    expect(overviewKeys.length).toBeGreaterThan(20)
    expect(overviewKeys).toContain('Your AI gateway')
    expect(overviewKeys).toContain('Step 1 · Choose an API key')
  })

  for (const locale of LOCALES) {
    test(`${locale} defines every overview key`, () => {
      const translation = readLocale(locale)

      for (const key of overviewKeys) {
        expect(
          Object.prototype.hasOwnProperty.call(translation, key),
          `${locale} is missing overview copy: ${key}`
        ).toBe(true)
      }
    })
  }

  // Guards the failure mode this repo hits repeatedly: a key is added to every
  // file but non-English values are left as the English source string.
  for (const locale of LOCALES.filter((l) => l !== 'en')) {
    test(`${locale} actually translates overview copy`, () => {
      const english = readLocale('en')
      const translation = readLocale(locale)

      for (const key of overviewKeys) {
        if (BRAND_KEYS.has(key)) continue
        expect(
          translation[key] !== english[key],
          `${locale} left overview copy untranslated: ${key}`
        ).toBe(true)
      }
    })
  }
})

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
import '@testing-library/jest-dom/vitest'
import i18next, { type i18n as I18nInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'
import ja from '@/i18n/locales/ja.json'
import pt from '@/i18n/locales/pt.json'
import ru from '@/i18n/locales/ru.json'
import vi from '@/i18n/locales/vi.json'
import zh from '@/i18n/locales/zh.json'

// Stub matchMedia for jsdom (some libs call it unconditionally).
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

/**
 * Build a fresh i18next instance from the real locale JSON files.
 * Returns a promise that resolves to the initialized instance.
 * Each test should call this for isolation; do not share the singleton.
 *
 * Resources are passed in their raw JSON shape (with the `translation`
 * namespace wrapper). i18next v26+ expects this and applies the
 * `translation` namespace automatically on lookup.
 *
 * Order of `resources` keys and `supportedLngs` MUST match
 * src/i18n/config.ts exactly. i18next's fallback chain (and any code
 * that asserts on the order) requires consistency.
 */
export async function loadI18n(lng: string = 'en'): Promise<I18nInstance> {
  const instance = i18next.createInstance()
  await instance.use(initReactI18next).init({
    resources: {
      en: en as never,
      zh: zh as never,
      fr: fr as never,
      ru: ru as never,
      ja: ja as never,
      pt: pt as never,
      vi: vi as never,
    } as never,
    lng,
    fallbackLng: 'en',
    // supportedLngs must match src/i18n/config.ts exactly. i18next's
    // built-in fallback (nonExplicitSupportedLngs) maps region-less
    // codes to the canonical entry — 'pt' (without region) resolves
    // to the 'pt' resources entry automatically.
    supportedLngs: ['en', 'zh', 'fr', 'ru', 'ja', 'pt', 'vi'] as never,
    nsSeparator: false,
    interpolation: { escapeValue: false },
  } as never)
  return instance
}

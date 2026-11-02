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
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import {
  convertDetectedLanguage,
  normalizeInterfaceLanguage,
  type InterfaceLanguageCode,
} from './languages'

// Each locale JSON is its own async chunk (Rspack splits dynamic imports), so
// the entry bundle ships zero translation data. Only the detected language
// and the English fallback are fetched before first render.
type LocaleModule = { default: { translation: Record<string, unknown> } }

const localeImporters: Record<
  InterfaceLanguageCode,
  () => Promise<LocaleModule>
> = {
  en: () => import('./locales/en.json'),
  zhCN: () => import('./locales/zh.json'),
  zhTW: () => import('./locales/zh-TW.json'),
  fr: () => import('./locales/fr.json'),
  ru: () => import('./locales/ru.json'),
  ja: () => import('./locales/ja.json'),
  vi: () => import('./locales/vi.json'),
}

const loadedLangs = new Set<InterfaceLanguageCode>()
const pendingLangs = new Map<InterfaceLanguageCode, Promise<void>>()

function importLocale(lang: InterfaceLanguageCode): Promise<void> {
  const pending = pendingLangs.get(lang)
  if (pending) {
    return pending
  }

  const load = localeImporters[lang]()
    .then((module) => {
      i18n.addResourceBundle(
        lang,
        'translation',
        module.default.translation,
        true,
        true
      )
      loadedLangs.add(lang)
    })
    .catch((error: unknown) => {
      // Do not cache failures: a later switch or retry can try again.
      pendingLangs.delete(lang)
      throw error
    })

  pendingLangs.set(lang, load)
  return load
}

function ensureLocale(lang: string): Promise<void> {
  const normalized = normalizeInterfaceLanguage(lang)
  if (loadedLangs.has(normalized)) {
    return Promise.resolve()
  }
  return importLocale(normalized)
}

let initPromise: Promise<void> | null = null

export function initI18n(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await i18n
        .use(LanguageDetector)
        .use(initReactI18next)
        .init({
          fallbackLng: 'en',
          supportedLngs: [
            'en',
            'zhCN',
            'fr',
            'ru',
            'ja',
            'vi',
            'zhTW',
          ],
          load: 'currentOnly',
          nsSeparator: false, // Allow literal colons in keys (e.g., URLs, labels)
          interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
          },
          detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
            // Browsers report `zh-CN`/`zh-TW`/`zh`; map them onto our `zhCN`/`zhTW`
            // codes (non-Chinese codes pass through for normal supportedLngs matching).
            convertDetectedLanguage,
          },
        })

      // First paint needs the detected language plus the English fallback
      // (missing keys resolve against it). A failed fetch must never block
      // rendering: i18next then surfaces raw keys, same as any missing bundle.
      const initialLangs =
        i18n.language === 'en' ? ['en'] : [i18n.language, 'en']
      await Promise.allSettled(
        initialLangs.map((lang) =>
          ensureLocale(lang).catch((error: unknown) => {
            // eslint-disable-next-line no-console
            console.error(`[i18n] failed to load locale "${lang}"`, error)
          })
        )
      )
    })()
  }
  return initPromise
}

// Single loader for runtime language switches: fetch the chunk first, then
// swap, so a failed download never leaves a half-loaded locale active.
export async function changeInterfaceLanguage(lang: string): Promise<void> {
  const normalized = normalizeInterfaceLanguage(lang)
  try {
    await ensureLocale(normalized)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[i18n] failed to load locale "${normalized}"`, error)
  }
  await i18n.changeLanguage(normalized)
}

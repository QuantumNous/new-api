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
import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import id from './locales/id.json'
import it from './locales/it.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import pl from './locales/pl.json'
import pt from './locales/pt.json'
import ru from './locales/ru.json'
import tr from './locales/tr.json'
import vi from './locales/vi.json'
import zh from './locales/zh.json'
import zhTW from './locales/zh-TW.json'

export const resources = {
  en,
  zh,
  'zh-TW': zhTW,
  de,
  fr,
  id,
  it,
  ja,
  ko,
  pl,
  pt,
  ru,
  tr,
  vi,
  es,
} as const

const APIMASTER_STORAGE_KEY = 'apimaster-locale'
const PANEL_LOCALE_MANUAL_KEY = 'panel-locale-manual-at'
const PANEL_LOCALE_MANUAL_MS = 3000

// APIMaster locale -> i18next supported lang
const APIMASTER_LOCALE_MAP: Record<string, string> = {
  zh: 'zh',
  'zh-TW': 'zh-TW',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  es: 'es',
  fr: 'fr',
  de: 'de',
  ru: 'ru',
  id: 'id',
  vi: 'vi',
  pt: 'pt',
  it: 'it',
  pl: 'pl',
  tr: 'tr',
}

// i18next lang -> apimaster-locale storage value
const PANEL_TO_APIMASTER_LOCALE: Record<string, string> = Object.fromEntries(
  Object.entries(APIMASTER_LOCALE_MAP).map(([apimaster, panel]) => [panel, apimaster])
)

function resolveInitialLng(): string | undefined {
  try {
    const stored = localStorage.getItem(APIMASTER_STORAGE_KEY)
    if (stored && APIMASTER_LOCALE_MAP[stored]) return APIMASTER_LOCALE_MAP[stored]
  } catch {
    // localStorage not available (SSR / sandboxed)
  }
  return undefined
}

const apimasterLng = resolveInitialLng()

function syncApimasterLocale() {
  const lng = resolveInitialLng()
  if (lng && i18n.resolvedLanguage !== lng && i18n.language !== lng) {
    void i18n.changeLanguage(lng)
  }
}

function applyApimasterLocale(locale: unknown) {
  if (typeof locale !== 'string') return

  try {
    const manualAt = Number(sessionStorage.getItem(PANEL_LOCALE_MANUAL_KEY) || '0')
    if (manualAt > 0 && Date.now() - manualAt < PANEL_LOCALE_MANUAL_MS) {
      return
    }
  } catch {
    // sessionStorage not available
  }

  const lng = APIMASTER_LOCALE_MAP[locale]
  if (!lng) return

  try {
    localStorage.setItem(APIMASTER_STORAGE_KEY, locale)
  } catch {
    // localStorage not available (SSR / sandboxed)
  }

  if (i18n.resolvedLanguage !== lng && i18n.language !== lng) {
    void i18n.changeLanguage(lng)
  }
}

/** User-initiated language change inside the panel — keep apimaster-locale in sync. */
export async function setPanelLanguage(code: string) {
  const lng = code.trim()
  if (!lng) return

  const apimasterLocale = PANEL_TO_APIMASTER_LOCALE[lng] ?? lng
  try {
    sessionStorage.setItem(PANEL_LOCALE_MANUAL_KEY, String(Date.now()))
    localStorage.setItem(APIMASTER_STORAGE_KEY, apimasterLocale)
  } catch {
    // localStorage not available
  }

  await i18n.changeLanguage(lng)
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // If APIMaster has a locale stored, use it directly (avoids flash on load)
    ...(apimasterLng ? { lng: apimasterLng } : {}),
    fallbackLng: 'en',
    supportedLngs: ['zh', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'id', 'vi', 'pt', 'it', 'pl', 'tr'],
    load: 'languageOnly', // Convert zh-CN -> zh
    nsSeparator: false, // Allow literal colons in keys (e.g., URLs, labels)
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === APIMASTER_STORAGE_KEY) {
      syncApimasterLocale()
    }
  })
  window.addEventListener('message', (event) => {
    const data = event.data
    if (
      data &&
      typeof data === 'object' &&
      'type' in data &&
      data.type === 'apimaster-locale'
    ) {
      applyApimasterLocale('locale' in data ? data.locale : undefined)
    }
  })
}

export default i18n

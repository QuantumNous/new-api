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
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import id from './locales/id.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import ru from './locales/ru.json'
import vi from './locales/vi.json'
import zh from './locales/zh.json'

export const resources = {
  en,
  zh,
  id,
  ko,
  es,
  fr,
  ru,
  ja,
  vi,
} as const

const APIMASTER_STORAGE_KEY = 'apimaster-locale'

// APIMaster locale -> i18next supported lang
const APIMASTER_LOCALE_MAP: Record<string, string> = {
  zh: 'zh',
  en: 'en',
  id: 'id',
  ko: 'ko',
  es: 'es',
  ru: 'ru',
  vi: 'vi',
}

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

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // If APIMaster has a locale stored, use it directly (avoids flash on load)
    ...(apimasterLng ? { lng: apimasterLng } : {}),
    fallbackLng: 'en',
    supportedLngs: ['zh', 'en', 'id', 'ko', 'es', 'ru', 'vi', 'fr', 'ja'],
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
  const handleLocaleSync = () => syncApimasterLocale()

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
  window.addEventListener('focus', handleLocaleSync)
  window.addEventListener('pageshow', handleLocaleSync)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncApimasterLocale()
  })
  window.setInterval(() => {
    if (!document.hidden) syncApimasterLocale()
  }, 1000)
}

export default i18n

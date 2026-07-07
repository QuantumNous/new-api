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
import { getPublicPathLanguage, isPublicWebsitePath } from '@/lib/public-locale'
import { LANGUAGE_PREFERENCE_COOKIE } from './language-preference-cookie'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import ja from './locales/ja.json'
import pt from './locales/pt.json'
import ru from './locales/ru.json'
import vi from './locales/vi.json'
import zh from './locales/zh.json'

export const resources = {
  en,
  es,
  zh,
  fr,
  pt,
  ru,
  ja,
  vi,
} as const

export { LANGUAGE_PREFERENCE_COOKIE }

export const LANGUAGE_DETECTION_OPTIONS = {
  // 'querystring' first so ?lng=ja / ?lng=pt from Google Ads landing URLs
  // force the locale regardless of browser language. The shared fk_locale cookie
  // comes next so flatkey.ai -> console.flatkey.ai preserves the website choice
  // even when console localStorage still has an older language.
  order: ['querystring', 'cookie', 'localStorage', 'navigator'],
  lookupQuerystring: 'lng',
  lookupCookie: LANGUAGE_PREFERENCE_COOKIE,
  caches: ['localStorage'],
}

function getInitialLanguage() {
  if (typeof window === 'undefined') return undefined
  return isPublicWebsitePath(window.location.pathname)
    ? getPublicPathLanguage(window.location.pathname)
    : undefined
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh', 'es', 'fr', 'pt', 'ru', 'ja', 'vi'],
    load: 'languageOnly', // Convert zh-CN -> zh
    nsSeparator: false, // Allow literal colons in keys (e.g., URLs, labels)
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    detection: LANGUAGE_DETECTION_OPTIONS,
  })

export default i18n

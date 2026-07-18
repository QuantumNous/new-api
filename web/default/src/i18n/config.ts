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
import i18n, { type BackendModule, type ResourceLanguage } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import { convertDetectedLanguage } from './languages'

const localeLoaders = {
  en: () => import('./locales/en.json').then((module) => module.default),
  zhCN: () => import('./locales/zh.json').then((module) => module.default),
  fr: () => import('./locales/fr.json').then((module) => module.default),
  ru: () => import('./locales/ru.json').then((module) => module.default),
  ja: () => import('./locales/ja.json').then((module) => module.default),
  vi: () => import('./locales/vi.json').then((module) => module.default),
  zhTW: () => import('./locales/zh-TW.json').then((module) => module.default),
} satisfies Record<string, () => Promise<ResourceLanguage>>

type SupportedLanguage = keyof typeof localeLoaders

const localeBackend: BackendModule = {
  type: 'backend',
  init() {},
  read(language, _namespace, callback) {
    const loader = localeLoaders[language as SupportedLanguage]
    if (!loader) {
      callback(new Error(`Unsupported locale: ${language}`), false)
      return
    }
    /* oxlint-disable promise/no-callback-in-promise -- i18next backends expose a callback API. */
    loader()
      .then((resource) => callback(null, resource))
      .catch((error: unknown) =>
        callback(error instanceof Error ? error : String(error), false)
      )
    /* oxlint-enable promise/no-callback-in-promise */
  },
}

export const i18nReady = i18n
  .use(localeBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // 本地与国内部署默认中文；已缓存的 i18nextLng 仍优先于 fallback。
    fallbackLng: 'zhCN',
    supportedLngs: ['en', 'zhCN', 'fr', 'ru', 'ja', 'vi', 'zhTW'],
    load: 'currentOnly',
    nsSeparator: false, // Allow literal colons in keys (e.g., URLs, labels)
    debug: import.meta.env.DEV,
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

export default i18n

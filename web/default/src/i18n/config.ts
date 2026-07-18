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
      .then((resource) => {
        // locale JSON 形如 { translation: {...keys}, 以及少数顶层键 }。
        // backend 返回的是 defaultNS=translation 的资源表，必须展开 translation 嵌套，
        // 否则 t('Home') 找不到键，界面会一直显示英文 key（英文环境看起来“正常”）。
        if (
          resource &&
          typeof resource === 'object' &&
          !Array.isArray(resource) &&
          'translation' in resource &&
          typeof (resource as { translation?: unknown }).translation ===
            'object' &&
          (resource as { translation: object }).translation !== null
        ) {
          const { translation, ...rest } = resource as {
            translation: ResourceLanguage
          } & Record<string, unknown>
          callback(null, { ...translation, ...rest } as ResourceLanguage)
          return
        }
        callback(null, resource)
      })
      .catch((error: unknown) =>
        callback(error instanceof Error ? error : String(error), false)
      )
    /* oxlint-enable promise/no-callback-in-promise */
  },
}

// 国内部署默认简体中文：
// - 不再使用 navigator（浏览器英文会绕过 fallbackLng）
// - 一次性把历史 en 缓存迁到 zhCN；之后用户手动选英文会保留
const I18N_STORAGE_KEY = 'i18nextLng'
const I18N_DEFAULT_ZH_MIGRATION_KEY = 'i18nDefaultZhCN.v1'
try {
  if (typeof localStorage !== 'undefined') {
    if (!localStorage.getItem(I18N_DEFAULT_ZH_MIGRATION_KEY)) {
      const cached = localStorage.getItem(I18N_STORAGE_KEY)
      if (
        !cached ||
        cached === 'en' ||
        cached.toLowerCase().startsWith('en-')
      ) {
        localStorage.setItem(I18N_STORAGE_KEY, 'zhCN')
      }
      localStorage.setItem(I18N_DEFAULT_ZH_MIGRATION_KEY, '1')
    }
  }
} catch {
  // private mode / blocked storage
}

export const i18nReady = i18n
  .use(localeBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'zhCN',
    supportedLngs: ['en', 'zhCN', 'fr', 'ru', 'ja', 'vi', 'zhTW'],
    load: 'currentOnly',
    nsSeparator: false, // Allow literal colons in keys (e.g., URLs, labels)
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: I18N_STORAGE_KEY,
      convertDetectedLanguage,
    },
  })

export default i18n

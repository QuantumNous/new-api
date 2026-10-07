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
import i18n, { type BackendModule, type ResourceKey } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import { convertDetectedLanguage } from './languages'
import en from './locales/en.json'

// en 静态打包作为兜底语言（fallbackLng），保证首帧始终有文案、不闪现原始 key。
// 其余语言按需加载：每个语言独立成一个 async chunk，
// 只有用户实际使用的语言才会下载（此前 7 种语言全部打进入口 chunk）。
const localeLoaders: Record<string, () => Promise<unknown>> = {
  zhCN: () => import('./locales/zh.json'),
  fr: () => import('./locales/fr.json'),
  ru: () => import('./locales/ru.json'),
  ja: () => import('./locales/ja.json'),
  vi: () => import('./locales/vi.json'),
  zhTW: () => import('./locales/zh-TW.json'),
}

const backend: BackendModule = {
  type: 'backend',
  init: () => {},
  read: async (language, namespace, callback) => {
    const loader = localeLoaders[language]
    if (!loader) {
      callback(null, null)
      return
    }
    try {
      // i18next 按 (语言, 命名空间) 调 read，需返回对应命名空间的内容
      const mod = (await loader()) as unknown
      // 兼容打包器对 JSON 动态导入的两种形状：
      // A. { default: JSON 对象 }；B. JSON 顶层键直接铺到模块命名空间
      const m = mod as Record<string, unknown>
      const direct = m[namespace]
      let nsData: unknown = null
      if (direct && typeof direct === 'object') {
        nsData = direct
      } else {
        const wrapped = (m.default as Record<string, unknown> | undefined)?.[
          namespace
        ]
        if (wrapped && typeof wrapped === 'object') nsData = wrapped
      }
      callback(null, nsData as ResourceKey)
    } catch (err) {
      callback(err as Error, null)
    }
  },
}

i18n
  .use(backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en },
    // 只打包了 en，其余语言允许从 backend 按需加载
    partialBundledLanguages: true,
    fallbackLng: 'en',
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

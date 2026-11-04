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

import { withHwText } from './hw'
import { convertDetectedLanguage, toIntlLocale } from './languages'
import en from './locales/en.json'
import tr from './locales/tr.json'
import { loadTextOverrides } from './text-overrides'

// Only the two languages every visitor can fall back to ship in the main
// bundle; the other six files are about 4 MB together and load when chosen.
export const resources = {
  tr,
  en: withHwText('en', en),
} as const

const LAZY_LOCALES: Record<
  string,
  () => Promise<{ default: { translation: Record<string, string> } }>
> = {
  zhCN: () => import('./locales/zh.json'),
  fr: () => import('./locales/fr.json'),
  ru: () => import('./locales/ru.json'),
  ja: () => import('./locales/ja.json'),
  vi: () => import('./locales/vi.json'),
  zhTW: () => import('./locales/zh-TW.json'),
}

/** i18next backend that fetches the non-bundled language files on demand. */
export const lazyLocaleBackend = {
  type: 'backend' as const,
  init: () => undefined,
  async read(language: string, namespace: string) {
    const load = LAZY_LOCALES[language]
    if (!load) return {}
    const module = await load()
    const bundle = module.default[namespace as 'translation']
    return withHwText(language, { translation: bundle }).translation
  },
}

/**
 * Init options of the interface languages, exported so a test can exercise them
 * on its own i18next instance (the application singleton is shared with the
 * whole app and is initialized elsewhere in tests).
 */
export const INTERFACE_I18N_OPTIONS = {
  resources,
  partialBundledLanguages: true,
  // Turkish is the product language for everyone who has not chosen
  // otherwise, so the browser locale is not consulted (a Turkish visitor
  // with an English browser still gets Turkish). The second entry keeps
  // untranslated keys readable: they resolve to the English source text.
  fallbackLng: ['tr', 'en'],
  supportedLngs: ['tr', 'en', 'zhCN', 'fr', 'ru', 'ja', 'vi', 'zhTW'],
  load: 'currentOnly' as const,
  nsSeparator: false as const, // Allow literal colons in keys (e.g., URLs, labels)
  interpolation: {
    escapeValue: false, // not needed for react as it escapes by default
  },
  detection: {
    // Only an explicit choice is remembered; without one the fallback
    // language (Turkish) applies.
    order: ['localStorage'],
    caches: ['localStorage'],
    // Browsers report `zh-CN`/`zh-TW`/`zh`; map them onto our `zhCN`/`zhTW`
    // codes (non-Chinese codes pass through for normal supportedLngs matching).
    convertDetectedLanguage,
  },
}

/**
 * Settles once the stored interface language is loaded; the app renders after
 * it so a visitor on a lazily loaded language never sees the English keys first.
 */
export const i18nReady = i18n
  .use(LanguageDetector)
  .use(lazyLocaleBackend)
  .use(initReactI18next)
  .init({ ...INTERFACE_I18N_OPTIONS, debug: import.meta.env.DEV })

/** Keep `<html lang>` in step with the interface language (a11y, hyphenation). */
export function applyDocumentLanguage(language?: string | null): void {
  if (typeof document === 'undefined') return
  const locale = toIntlLocale(language)
  if (locale) document.documentElement.lang = locale
}

i18n.on('languageChanged', applyDocumentLanguage)

// Admin-applied text replacements load once per language; loading them
// re-emits languageChanged, which the guard turns into a no-op.
let overridesLoadedFor = ''
function refreshTextOverrides(language?: string | null): void {
  if (!language || language === overridesLoadedFor) return
  if (typeof fetch === 'undefined') return
  overridesLoadedFor = language
  void loadTextOverrides(i18n)
}
i18n.on('languageChanged', refreshTextOverrides)
refreshTextOverrides(i18n.language)
applyDocumentLanguage(i18n.resolvedLanguage ?? i18n.language)

export default i18n

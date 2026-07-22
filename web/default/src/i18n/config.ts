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
import zh from './locales/zh.json'

const resources = {
  en,
  zh,
} as const

type LocaleModule = {
  default: {
    translation: Record<string, string>
    [key: string]: unknown
  }
}

const localeLoaders: Record<string, () => Promise<LocaleModule>> = {
  'zh-TW': () => import('./locales/zh-TW.json'),
  de: () => import('./locales/de.json'),
  es: () => import('./locales/es.json'),
  fr: () => import('./locales/fr.json'),
  id: () => import('./locales/id.json'),
  it: () => import('./locales/it.json'),
  ja: () => import('./locales/ja.json'),
  ko: () => import('./locales/ko.json'),
  pl: () => import('./locales/pl.json'),
  pt: () => import('./locales/pt.json'),
  ru: () => import('./locales/ru.json'),
  tr: () => import('./locales/tr.json'),
  vi: () => import('./locales/vi.json'),
}

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

function normalizeLanguage(code: string): string {
  if (code === 'zh-TW' || code.startsWith('zh-Hant')) return 'zh-TW'
  if (code.startsWith('zh')) return 'zh'
  return code.split('-')[0]
}

async function ensureLanguageLoaded(code: string): Promise<string> {
  const lng = normalizeLanguage(code)
  if (i18n.hasResourceBundle(lng, 'translation')) return lng

  const loader = localeLoaders[lng]
  if (!loader) return 'en'

  const locale = await loader()
  i18n.addResourceBundle(
    lng,
    'translation',
    locale.default.translation,
    true,
    true
  )
  return lng
}

async function changeToLanguage(code: string): Promise<void> {
  const loadedLng = await ensureLanguageLoaded(code)
  await i18n.changeLanguage(loadedLng)
}

function syncApimasterLocale() {
  const lng = resolveInitialLng()
  if (lng && i18n.resolvedLanguage !== lng && i18n.language !== lng) {
    void changeToLanguage(lng).catch(() => undefined)
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
    void changeToLanguage(lng).catch(() => undefined)
  }
}

/** User-initiated language change inside the panel — keep apimaster-locale in sync. */
export async function setPanelLanguage(code: string) {
  const lng = normalizeLanguage(code.trim())
  if (!lng) return

  const apimasterLocale = PANEL_TO_APIMASTER_LOCALE[lng] ?? lng
  try {
    sessionStorage.setItem(PANEL_LOCALE_MANUAL_KEY, String(Date.now()))
    localStorage.setItem(APIMASTER_STORAGE_KEY, apimasterLocale)
  } catch {
    // localStorage not available
  }

  await changeToLanguage(lng)
}

void i18n
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
  .then(async () => {
    const preferredLng = normalizeLanguage(
      apimasterLng || i18n.resolvedLanguage || i18n.language || 'en'
    )
    await changeToLanguage(preferredLng)
  })
  .catch(() => {
    if (i18n.resolvedLanguage !== 'en') {
      void i18n.changeLanguage('en')
    }
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

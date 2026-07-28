import { createI18n } from 'vue-i18n'

import enCommon from './locales/en/common'
import enHome from './locales/en/home'
import zhCNCommon from './locales/zh-CN/common'
import zhCNHome from './locales/zh-CN/home'

export type LocaleCode = 'zh-CN' | 'en'

export const LOCALE_STORAGE_KEY = 'ren2hub_locale'
export const LEGACY_LOCALE_STORAGE_KEY = 'renren_locale'
const DEFAULT_LOCALE: LocaleCode = 'zh-CN'
export type MessageDomain = 'auth' | 'console' | 'lab'

export const availableLocales = [
  { code: 'zh-CN', name: '简体中文', flag: '中' },
  { code: 'en', name: 'English', flag: 'EN' },
] as const

function isLocaleCode(value: unknown): value is LocaleCode {
  return value === 'zh-CN' || value === 'en'
}

export function resolveInitialLocale(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  browserLanguage: string
): LocaleCode {
  try {
    const saved = storage.getItem(LOCALE_STORAGE_KEY)
    if (isLocaleCode(saved)) return saved

    const legacy = storage.getItem(LEGACY_LOCALE_STORAGE_KEY)
    if (isLocaleCode(legacy)) {
      storage.setItem(LOCALE_STORAGE_KEY, legacy)
      storage.removeItem(LEGACY_LOCALE_STORAGE_KEY)
      return legacy
    }
  } catch {
    // A restricted storage context may still use the browser locale.
  }

  return browserLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

export function resolveInitialLocaleFromStorage(
  getStorage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  browserLanguage: string
): LocaleCode {
  try {
    return resolveInitialLocale(getStorage(), browserLanguage)
  } catch {
    return browserLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
  }
}

const initialLocale = resolveInitialLocaleFromStorage(
  () => window.localStorage,
  window.navigator.language
)

const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: {
    en: { ...enHome, ...enCommon },
    'zh-CN': { ...zhCNHome, ...zhCNCommon },
  },
})

const domainLoads = new Set<MessageDomain>()
const loadedPairs = new Set<string>()
const inflightPairs = new Map<string, Promise<void>>()

type DomainModule = Promise<{ default: Record<string, unknown> }>

// Per-locale loaders so a zh-CN session only downloads zh-CN chunks. The other
// language's messages load on demand when the user actually switches.
const domainLoaders: Record<
  MessageDomain,
  Record<LocaleCode, () => DomainModule>
> = {
  auth: {
    en: () => import('./locales/en/auth'),
    'zh-CN': () => import('./locales/zh-CN/auth'),
  },
  console: {
    en: () => import('./locales/en/console'),
    'zh-CN': () => import('./locales/zh-CN/console'),
  },
  lab: {
    en: () => import('./locales/en/lab'),
    'zh-CN': () => import('./locales/zh-CN/lab'),
  },
}

function loadDomainForLocale(
  domain: MessageDomain,
  locale: LocaleCode
): Promise<void> {
  const key = `${locale}:${domain}`
  if (loadedPairs.has(key)) return Promise.resolve()
  const existing = inflightPairs.get(key)
  if (existing) return existing

  const request = domainLoaders[domain][locale]()
    .then((mod) => {
      i18n.global.mergeLocaleMessage(locale, mod.default)
      loadedPairs.add(key)
      inflightPairs.delete(key)
    })
    .catch((error: unknown) => {
      inflightPairs.delete(key)
      throw error
    })
  inflightPairs.set(key, request)
  return request
}

export function loadMessageDomain(domain: MessageDomain): Promise<void> {
  domainLoads.add(domain)
  return loadDomainForLocale(domain, getLocale())
}

export function setLocale(locale: string): Promise<void> {
  if (!isLocaleCode(locale)) return Promise.resolve()
  // Backfill every already-requested domain in the target language first, so
  // the flip never renders raw keys. On a load failure the flip still happens
  // (better a fallback string than a switch that silently does nothing).
  return Promise.allSettled(
    [...domainLoads].map((domain) => loadDomainForLocale(domain, locale))
  ).then(() => {
    i18n.global.locale.value = locale
    document.documentElement.lang = locale
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    } catch {
      // Browser storage is optional.
    }
  })
}

export function getLocale(): LocaleCode {
  const locale = i18n.global.locale.value
  return isLocaleCode(locale) ? locale : DEFAULT_LOCALE
}

document.documentElement.lang = initialLocale

export default i18n

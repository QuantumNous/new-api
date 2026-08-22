import {
  buildDocumentTitle,
  defaultSeoDescription,
  defaultSeoKeywords,
} from './defaults'
import {
  removeJsonLd,
  upsertJsonLd,
  upsertLinkRel,
  upsertMetaByName,
  upsertMetaByProperty,
} from './dom'
import type { SeoInput, StatusSeoFields } from './types'

function resolveSiteUrl(siteUrl?: string): string {
  const raw = (siteUrl || '').trim().replace(/\/$/, '')
  if (raw) return raw
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

function absolutize(url: string, siteUrl: string): string {
  const u = (url || '').trim()
  if (!u) return ''
  if (/^https?:\/\//i.test(u) || u.startsWith('data:')) return u
  if (u.startsWith('/') && siteUrl) return siteUrl + u
  return u
}

export function applyDocumentSeo(input: SeoInput): void {
  if (typeof document === 'undefined') return

  const lang =
    input.lang ||
    document.documentElement.lang ||
    (typeof navigator !== 'undefined' ? navigator.language : 'zh-CN')

  const pathForTitle =
    input.path ||
    (typeof window !== 'undefined' ? window.location.pathname : '/') ||
    '/'
  const isHome =
    pathForTitle === '/' || pathForTitle === '' || pathForTitle === '/index.html'
  const title = buildDocumentTitle({
    fullTitle: isHome ? input.fullTitle : undefined,
    title: input.title,
    titleSuffix: isHome ? input.titleSuffix : undefined,
    lang,
    allowDefaultSuffix: isHome,
  })
  const description =
    (input.description || '').trim() || defaultSeoDescription(lang)
  const keywords = (input.keywords || '').trim() || defaultSeoKeywords(lang)
  const siteUrl = resolveSiteUrl(input.siteUrl)
  const path =
    input.path ||
    (typeof window !== 'undefined' ? window.location.pathname : '/') ||
    '/'
  const pageUrl = siteUrl
    ? siteUrl + (path.startsWith('/') ? path : `/${path}`)
    : ''
  const ogImage = absolutize(input.ogImage || '/logo.png', siteUrl)
  const robotsIndex = input.robotsIndex !== false

  if (title) {
    document.title = title
    upsertMetaByName('title', title)
  }

  if (lang) {
    document.documentElement.lang = lang.startsWith('zh')
      ? lang.toLowerCase().includes('tw') || lang.toLowerCase().includes('hk')
        ? 'zh-TW'
        : 'zh-CN'
      : lang
  }

  upsertMetaByName('description', description)
  upsertMetaByName('keywords', keywords)
  upsertMetaByName('robots', robotsIndex ? 'index,follow' : 'noindex,nofollow')

  const ogTitle = title || document.title || 'New API'
  upsertMetaByProperty('og:type', 'website')
  upsertMetaByProperty('og:title', ogTitle)
  upsertMetaByProperty('og:description', description)
  if (pageUrl) upsertMetaByProperty('og:url', pageUrl)
  if (ogImage) upsertMetaByProperty('og:image', ogImage)
  const siteName = (input.title || '').trim() || 'New API'
  upsertMetaByProperty('og:site_name', siteName)

  upsertMetaByName('twitter:card', ogImage ? 'summary_large_image' : 'summary')
  upsertMetaByName('twitter:title', ogTitle)
  upsertMetaByName('twitter:description', description)
  if (ogImage) upsertMetaByName('twitter:image', ogImage)

  if (pageUrl) upsertLinkRel('canonical', pageUrl)

  if (input.jsonLd) {
    upsertJsonLd('seo-jsonld', input.jsonLd)
  }
}

function normalizePath(path: string): string {
  return (path || '/').split('?')[0] || '/'
}

function isHomePath(path: string): boolean {
  const p = normalizePath(path)
  return p === '/' || p === '' || p === '/index.html'
}

function isPublicMarketingPath(path: string): boolean {
  const p = normalizePath(path)
  if (isHomePath(p)) return true
  return (
    p === '/pricing' ||
    p.startsWith('/pricing/') ||
    p === '/about' ||
    p === '/rankings' ||
    p.startsWith('/rankings/')
  )
}

/** Map /api/status payload into SeoInput and apply. */
export function applySeoFromStatus(
  status: StatusSeoFields | Record<string, unknown> | null | undefined,
  extra?: Partial<SeoInput>
): void {
  if (!status && !extra) return
  const s = (status || {}) as StatusSeoFields
  const path =
    (extra && extra.path) ||
    (typeof window !== 'undefined' ? window.location.pathname || '/' : '/')
  const home = isHomePath(path)
  const publicPath = isPublicMarketingPath(path)
  const baseRobots = s.seo_robots_index !== false

  const input: SeoInput = {
    title: s.system_name || 'New API',
    description: s.seo_description,
    keywords: s.seo_keywords,
    siteUrl: s.seo_site_url || s.server_address,
    ogImage: s.seo_og_image || s.logo || '/logo.png',
    fullTitle: home ? s.seo_title : undefined,
    titleSuffix: home ? s.seo_title_suffix : undefined,
    robotsIndex: publicPath ? baseRobots : false,
    path: publicPath ? path : '/',
    ...extra,
  }
  const finalPath = normalizePath(input.path || path)
  const finalHome = isHomePath(finalPath)
  if (!finalHome) {
    input.fullTitle = undefined
    input.titleSuffix = undefined
  }
  if (!isPublicMarketingPath(finalPath) && extra?.robotsIndex === undefined) {
    input.robotsIndex = false
  }
  applyDocumentSeo(input)
}

export function clearSeoJsonLd(): void {
  removeJsonLd('seo-jsonld')
}

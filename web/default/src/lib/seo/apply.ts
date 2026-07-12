import { defaultSeoDescription, defaultSeoKeywords } from './defaults'
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

  const title = (input.title || '').trim()
  const description =
    (input.description || '').trim() || defaultSeoDescription(lang)
  const keywords = (input.keywords || '').trim() || defaultSeoKeywords(lang)
  const siteUrl = resolveSiteUrl(input.siteUrl)
  const path = input.path || (typeof window !== 'undefined' ? window.location.pathname : '/') || '/'
  const pageUrl = siteUrl ? siteUrl + (path.startsWith('/') ? path : `/${path}`) : ''
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
  if (title) upsertMetaByProperty('og:site_name', title)

  upsertMetaByName('twitter:card', ogImage ? 'summary_large_image' : 'summary')
  upsertMetaByName('twitter:title', ogTitle)
  upsertMetaByName('twitter:description', description)
  if (ogImage) upsertMetaByName('twitter:image', ogImage)

  if (pageUrl) upsertLinkRel('canonical', pageUrl)

  if (input.jsonLd) {
    upsertJsonLd('seo-jsonld', input.jsonLd)
  }
}

/** Map /api/status payload into SeoInput and apply. */
export function applySeoFromStatus(
  status: StatusSeoFields | null | undefined,
  extra?: Partial<SeoInput>
): void {
  if (!status && !extra) return
  applyDocumentSeo({
    title: status?.system_name,
    description: status?.seo_description,
    keywords: status?.seo_keywords,
    siteUrl: status?.seo_site_url || status?.server_address,
    ogImage: status?.seo_og_image || status?.logo || '/logo.png',
    robotsIndex: status?.seo_robots_index !== false,
    path:
      typeof window !== 'undefined' ? window.location.pathname || '/' : '/',
    ...extra,
  })
}

export function clearSeoJsonLd(): void {
  removeJsonLd('seo-jsonld')
}

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
export type SeoInput = {
  /** Full document title, or page segment when siteName is also provided. */
  title: string
  description?: string
  /** Pathname only, e.g. /pricing — defaults to current location. */
  path?: string
  image?: string
  noindex?: boolean
  /** When set with a bare page title, builds "Page | SiteName". */
  siteName?: string
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}

const JSON_LD_ID = 'app-jsonld'
const SEO_PRERENDER_ID = 'seo-prerender'

/** Last client-applied SEO snapshot so branding updates can re-apply siteName. */
let lastSeo: SeoInput | null = null

/** Path-keyed overrides from page components; merged by usePageSeo. */
const seoOverrides = new Map<string, SeoInput>()

export function getLastSeo(): SeoInput | null {
  return lastSeo
}

function normalizeSeoPath(path: string): string {
  const raw = path.split(/[?#]/)[0] || '/'
  if (raw.length > 1 && raw.endsWith('/')) return raw.slice(0, -1)
  return raw || '/'
}

/** Register a page-level SEO override (won by usePageSeo when path matches). */
export function setSeoOverride(path: string, input: SeoInput) {
  const key = normalizeSeoPath(path)
  seoOverrides.set(key, { ...input, path: key })
}

export function clearSeoOverride(path: string) {
  seoOverrides.delete(normalizeSeoPath(path))
}

export function getSeoOverride(path: string): SeoInput | undefined {
  return seoOverrides.get(normalizeSeoPath(path))
}

export const DEFAULT_BRAND_NAME = 'BoxAI'
export const HOME_SEO_TITLE_LEAD = 'Unified AI API Gateway'

export function formatSeoTitle(pageTitle: string, siteName?: string): string {
  const page = pageTitle.trim()
  const site = (siteName ?? '').trim() || DEFAULT_BRAND_NAME
  if (!page || page.toLowerCase() === site.toLowerCase()) return site
  if (page.includes('|') || page.endsWith(site)) return page
  return `${page} | ${site}`
}

/** Homepage: "BoxAI · Unified AI API Gateway | you-box.com" */
export function formatSeoDocumentTitle(
  path: string | undefined,
  pageTitle: string,
  siteName?: string,
  origin?: string
): string {
  const site = (siteName ?? '').trim() || DEFAULT_BRAND_NAME
  const page = pageTitle.trim()
  const normalized = normalizeSeoPath(path || '/')
  if (
    normalized === '/' &&
    (!page || page.toLowerCase() === site.toLowerCase())
  ) {
    let host = ''
    try {
      const o =
        origin ||
        (typeof window !== 'undefined' ? window.location.origin : '')
      if (o) host = new URL(o).host
    } catch {
      /* empty */
    }
    if (!host) host = 'you-box.com'
    return `${site} · ${HOME_SEO_TITLE_LEAD} | ${host}`
  }
  return formatSeoTitle(page, site)
}

function ensureMeta(
  attrKey: 'name' | 'property',
  attrValue: string,
  content: string
) {
  if (typeof document === 'undefined') return
  const selector = `meta[${attrKey}="${CSS.escape(attrValue)}"]`
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attrKey, attrValue)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function ensureLink(rel: string, href: string) {
  if (typeof document === 'undefined') return
  let el = document.head.querySelector<HTMLLinkElement>(
    `link[rel="${CSS.escape(rel)}"]`
  )
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href
}

function setJsonLd(data: Record<string, unknown> | Record<string, unknown>[]) {
  if (typeof document === 'undefined') return
  let el = document.querySelector<HTMLScriptElement>(`#${JSON_LD_ID}`)
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = JSON_LD_ID
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

function removeSeoPrerender() {
  if (typeof document === 'undefined') return
  document.querySelector(`#${SEO_PRERENDER_ID}`)?.remove()
}

/**
 * Apply document head SEO for the current client route.
 * Safe to call repeatedly on navigation.
 */
export function applySeo(input: SeoInput) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  lastSeo = { ...input }

  const siteName = input.siteName?.trim() || DEFAULT_BRAND_NAME
  const path = input.path ?? window.location.pathname
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const origin = window.location.origin
  const title = formatSeoDocumentTitle(
    normalizedPath,
    input.title,
    siteName,
    origin
  )
  const description = (input.description ?? '').trim()
  // Prefer trailing-slash-free canonical except home
  const canonical =
    normalizedPath === '/'
      ? `${origin}/`
      : `${origin}${normalizedPath.replace(/\/+$/, '')}`

  document.title = title
  ensureMeta('name', 'title', title)
  if (description) {
    ensureMeta('name', 'description', description)
  }
  ensureMeta(
    'name',
    'robots',
    input.noindex ? 'noindex,nofollow' : 'index,follow'
  )
  ensureLink('canonical', canonical)

  const ogSite = siteName || title
  ensureMeta('property', 'og:type', 'website')
  ensureMeta('property', 'og:site_name', ogSite)
  ensureMeta('property', 'og:url', canonical)
  ensureMeta('property', 'og:title', title)
  if (description) {
    ensureMeta('property', 'og:description', description)
  }
  ensureMeta('name', 'twitter:card', 'summary_large_image')
  ensureMeta('name', 'twitter:title', title)
  if (description) {
    ensureMeta('name', 'twitter:description', description)
  }

  const image = input.image?.trim()
  if (image) {
    const absoluteImage = image.startsWith('http')
      ? image
      : new URL(image, origin).href
    ensureMeta('property', 'og:image', absoluteImage)
    ensureMeta('name', 'twitter:image', absoluteImage)
  }

  if (input.jsonLd) {
    setJsonLd(input.jsonLd)
  }

  // Client-rendered app owns the view; drop server prerender to avoid duplicate H1s for a11y.
  removeSeoPrerender()
}

function resolveAbsoluteAssetUrl(
  asset: string | undefined,
  origin: string,
  fallbackPath: string
): string {
  if (!asset) {
    if (!origin) return fallbackPath
    return `${origin}${fallbackPath}`
  }
  if (asset.startsWith('http')) return asset
  if (!origin) return asset
  const path = asset.startsWith('/') ? asset : `/${asset}`
  return `${origin}${path}`
}

export function buildDefaultJsonLd(options: {
  siteName: string
  description: string
  origin?: string
  logo?: string
}): Record<string, unknown> {
  const origin =
    options.origin ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  const home = origin ? `${origin}/` : '/'
  const logo = resolveAbsoluteAssetUrl(options.logo, origin, '/logo.png')
  const siteName = options.siteName?.trim() || DEFAULT_BRAND_NAME
  let host = 'you-box.com'
  try {
    if (origin) host = new URL(origin).host || host
  } catch {
    /* empty */
  }
  const alternateName = ['Box AI', 'boxai', 'you-box', host].filter(
    (v, i, arr) => v && arr.indexOf(v) === i
  )

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: siteName,
        alternateName,
        url: home,
        logo,
      },
      {
        '@type': 'WebSite',
        name: siteName,
        alternateName,
        url: home,
        description: options.description,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${origin}/pricing?search={query}`,
          'query-input': 'required name=query',
        },
      },
      {
        '@type': 'SoftwareApplication',
        name: siteName,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web',
        url: home,
        description: options.description,
      },
    ],
  }
}

/** Path prefixes that must not be indexed. */
const PRIVATE_PREFIXES = [
  '/console',
  '/api',
  '/v1',
  '/oauth',
  '/setup',
  '/sign-in',
  '/sign-up',
  '/register',
  '/forgot-password',
  '/otp',
  '/share',
  '/playground',
  '/inspiration',
  '/agents',
  '/dashboard',
  '/mj',
  '/pg',
  '/_authenticated',
] as const

export function isPrivateSeoPath(pathname: string): boolean {
  const path = pathname.split(/[?#]/)[0] || '/'
  const normalized =
    path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  for (const prefix of PRIVATE_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return true
    }
  }
  if (
    normalized === '/401' ||
    normalized === '/404' ||
    normalized === '/500' ||
    normalized === '/503'
  ) {
    return true
  }
  return false
}

export const DEFAULT_SEO_DESCRIPTION =
  'BoxAI (you-box.com) is a unified AI API gateway aggregating OpenAI, Claude, Gemini and 40+ providers. One endpoint for models, billing, rate limits, and admin.'

/**
 * Resolve default SEO for a pathname when a page does not set its own.
 */
export function resolveRouteSeo(
  pathname: string,
  siteName: string
): SeoInput {
  const path = pathname.split(/[?#]/)[0] || '/'
  const normalized =
    path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path || '/'

  if (isPrivateSeoPath(normalized)) {
    return {
      title: siteName,
      description: DEFAULT_SEO_DESCRIPTION,
      path: normalized,
      noindex: true,
      siteName,
    }
  }

  const brand = siteName?.trim() || DEFAULT_BRAND_NAME
  const catalog: Record<
    string,
    { title: string; description: string }
  > = {
    '/': {
      title: brand,
      description: DEFAULT_SEO_DESCRIPTION,
    },
    '/pricing': {
      title: 'Model Pricing',
      description:
        'BoxAI model pricing on you-box.com — compare token prices, capabilities, and billing modes across providers on the unified AI API gateway.',
    },
    '/about': {
      title: 'About BoxAI',
      description:
        'About BoxAI (you-box.com) — the unified AI API gateway for multi-model access, billing, and admin.',
    },
    '/privacy-policy': {
      title: 'Privacy Policy',
      description:
        'Privacy policy for BoxAI (you-box.com) — how we collect, use, and protect personal data.',
    },
    '/user-agreement': {
      title: 'User Agreement',
      description:
        'User agreement for BoxAI (you-box.com), including acceptable use and account responsibilities.',
    },
    '/docs/what-is-boxai': {
      title: 'What is BoxAI',
      description:
        'What is BoxAI? BoxAI (you-box.com) is a unified AI API gateway for multi-provider models, billing, and developer access.',
    },
    '/docs/getting-started': {
      title: 'Getting Started',
      description:
        'Get started with BoxAI on you-box.com — create an API key, pick a model, and send your first OpenAI-compatible request.',
    },
    '/docs/streaming': {
      title: 'Streaming',
      description:
        'Stream BoxAI model responses with server-sent events and cancel interrupted generations safely.',
    },
    '/docs/errors': {
      title: 'Errors, Retries, and Rate Limits',
      description:
        'Classify BoxAI gateway errors, retry transient failures safely, and respect rate limits on you-box.com.',
    },
    '/rankings': {
      title: 'Rankings',
      description: 'BoxAI public model and usage rankings on you-box.com.',
    },
  }

  const hit = catalog[normalized]
  if (hit) {
    return {
      title: hit.title,
      description: hit.description,
      path: normalized === '/' ? '/' : normalized,
      siteName,
      noindex: false,
    }
  }

  if (normalized.startsWith('/docs/')) {
    const slug = normalized.slice('/docs/'.length)
    const title = slug
      .split(/[-_]/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    return {
      title: title || 'Documentation',
      description: `${title || 'Documentation'} — API documentation for the unified AI gateway.`,
      path: normalized,
      siteName,
    }
  }

  if (normalized.startsWith('/pricing/')) {
    const modelId = decodeURIComponent(normalized.slice('/pricing/'.length))
    return {
      title: `${modelId} Pricing`,
      description: `Pricing and capabilities for model ${modelId} on BoxAI (you-box.com), the unified AI API gateway.`,
      path: normalized,
      siteName,
    }
  }

  return {
    title: siteName,
    description: DEFAULT_SEO_DESCRIPTION,
    path: normalized,
    siteName,
  }
}

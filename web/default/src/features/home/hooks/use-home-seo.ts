import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { applyDocumentSeo } from '@/lib/seo'
import { useSystemConfig } from '@/hooks/use-system-config'

/**
 * Homepage-only SEO: refresh meta + JSON-LD when branding/language changes.
 */
export function useHomeSeo() {
  const { i18n } = useTranslation()
  const { systemName, logo } = useSystemConfig()

  useEffect(() => {
    let seoDescription = ''
    let seoKeywords = ''
    let seoSiteUrl = ''
    let seoOgImage = ''
    let seoRobotsIndex = true
    try {
      const raw = localStorage.getItem('status')
      if (raw) {
        const s = JSON.parse(raw) as Record<string, unknown>
        seoDescription = String(s.seo_description || '')
        seoKeywords = String(s.seo_keywords || '')
        seoSiteUrl = String(s.seo_site_url || s.server_address || '')
        seoOgImage = String(s.seo_og_image || s.logo || logo || '/logo.png')
        seoRobotsIndex = s.seo_robots_index !== false
      }
    } catch {
      /* empty */
    }

    const name = systemName || 'New API'
    const origin =
      seoSiteUrl?.replace(/\/$/, '') ||
      (typeof window !== 'undefined' ? window.location.origin : '')

    applyDocumentSeo({
      title: name,
      description: seoDescription,
      keywords: seoKeywords,
      siteUrl: origin,
      path: '/',
      ogImage: seoOgImage || logo || '/logo.png',
      robotsIndex: seoRobotsIndex,
      lang: i18n.language,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name,
          url: origin ? `${origin}/` : undefined,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name,
          logo: logo || undefined,
          url: origin || undefined,
        },
      ],
    })
  }, [systemName, logo, i18n.language])
}

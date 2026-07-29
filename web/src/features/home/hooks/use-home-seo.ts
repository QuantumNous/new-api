import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useSystemConfig } from '@/hooks/use-system-config'
import { applySeoFromStatus, clearSeoJsonLd, readCachedStatus } from '@/lib/seo'

/**
 * Homepage-only SEO: long-tail title + JSON-LD while mounted.
 * Reads status from localStorage (already populated by main.tsx on boot).
 * On unmount, strips long-tail back to short brand title.
 */
export function useHomeSeo() {
  const { i18n } = useTranslation()
  const { systemName, logo } = useSystemConfig()

  useEffect(() => {
    const status = readCachedStatus()

    const name = systemName || String(status?.system_name || '') || 'DaoXE'
    const siteUrl = String(
      status?.seo_site_url || status?.server_address || ''
    ).replace(/\/$/, '')
    const origin =
      siteUrl || (typeof window !== 'undefined' ? window.location.origin : '')

    applySeoFromStatus(status || undefined, {
      title: name,
      fullTitle: String(status?.seo_title || ''),
      titleSuffix: String(status?.seo_title_suffix || ''),
      path: '/',
      lang: i18n.language,
      siteUrl: origin,
      ogImage: String(
        status?.seo_og_image || status?.logo || logo || '/logo.png'
      ),
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
          logo: logo || String(status?.logo || '') || undefined,
          url: origin || undefined,
        },
      ],
    })

    return () => {
      clearSeoJsonLd()
      try {
        const cached = readCachedStatus()
        applySeoFromStatus(cached || undefined, {
          title: name,
          path:
            typeof window !== 'undefined'
              ? window.location.pathname || '/'
              : '/',
          lang: i18n.language,
        })
      } catch {
        document.title = systemName || 'DaoXE'
      }
    }
  }, [systemName, logo, i18n.language])
}

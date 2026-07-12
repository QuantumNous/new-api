import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useSystemConfig } from '@/hooks/use-system-config'
import { getStatus } from '@/lib/api'
import { applyDocumentSeo, applySeoFromStatus } from '@/lib/seo'

/**
 * Homepage-only SEO: refresh meta + JSON-LD when branding/language changes.
 */
export function useHomeSeo() {
  const { i18n } = useTranslation()
  const { systemName, logo } = useSystemConfig()

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      let status: Record<string, unknown> | null = null
      try {
        const raw = localStorage.getItem('status')
        if (raw) status = JSON.parse(raw) as Record<string, unknown>
      } catch {
        /* empty */
      }
      try {
        const remote = await getStatus()
        if (remote && typeof remote === 'object') {
          status = remote
          try {
            localStorage.setItem('status', JSON.stringify(remote))
          } catch {
            /* empty */
          }
        }
      } catch {
        /* empty */
      }
      if (cancelled) return

      const name =
        systemName ||
        String(status?.system_name || '') ||
        'New API'
      const siteUrl = String(
        status?.seo_site_url || status?.server_address || ''
      ).replace(/\/$/, '')
      const origin =
        siteUrl ||
        (typeof window !== 'undefined' ? window.location.origin : '')

      applySeoFromStatus(status || undefined, {
        title: name,
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
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [systemName, logo, i18n.language])
}

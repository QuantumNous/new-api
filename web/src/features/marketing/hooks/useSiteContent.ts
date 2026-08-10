import { useTranslation } from 'react-i18next'

import type { TopNavLink } from '@/components/layout/types'

import { siteContent } from '../data/content'
import type { Locale, SiteContent } from '../types'

export function useSiteContent(): SiteContent {
  const { i18n } = useTranslation()
  const locale: Locale = i18n.language?.toLowerCase().startsWith('zh')
    ? 'zh'
    : 'en'
  return siteContent[locale]
}

// PublicLayout 的 navLinks 需要 TopNavLink（含 title 字段），这里把营销导航映射过去
export function useMarketingNavLinks(): TopNavLink[] {
  const c = useSiteContent()
  return c.nav.map((n) => ({ title: n.label, href: n.href }))
}

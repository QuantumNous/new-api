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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { RichContent } from '@/components/rich-content'
import { useTheme } from '@/context/theme-provider'
import { CashbackActivityPage } from '@/features/cashback-activity'
import { usePricingData } from '@/features/pricing/hooks'
import { isLikelyHtml } from '@/lib/content-format'
import { useAuthStore } from '@/stores/auth-store'

import { CiLandingPage } from './components/ci-landing-page'
import { useHomePageContent } from './hooks'
import { buildModelCatalog } from './lib/catalog'
import { getMaximumSavingsPercent } from './lib/pricing-savings'

// 2026-10-08 00:00 Beijing time. This only controls the default home display.
const CAMPAIGN_HOME_END = Date.parse('2026-10-07T16:00:00Z')

function DefaultHome(props: { isAuthenticated: boolean }) {
  const { models, priceRate } = usePricingData(true, { publicPreview: true })
  const savingsCatalog = useMemo(
    () => buildModelCatalog(models, priceRate),
    [models, priceRate]
  )
  const maxSavingsPercent = useMemo(
    () => getMaximumSavingsPercent(savingsCatalog),
    [savingsCatalog]
  )

  return (
    <CiLandingPage
      isAuthenticated={props.isAuthenticated}
      models={savingsCatalog}
      maxSavingsPercent={savingsCatalog.length > 0 ? maxSavingsPercent : 0}
    />
  )
}

export function Home() {
  const { i18n, t } = useTranslation()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { resolvedTheme } = useTheme()
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user
  const { content, isLoaded, isUrl } = useHomePageContent()
  const [showCampaign, setShowCampaign] = useState(
    () => Date.now() < CAMPAIGN_HOME_END
  )

  useEffect(() => {
    if (!isLoaded || content || !showCampaign) return

    let timer: number
    const checkDeadline = () => {
      const remaining = CAMPAIGN_HOME_END - Date.now()
      if (remaining <= 0) {
        setShowCampaign(false)
        return
      }
      window.clearTimeout(timer)
      timer = window.setTimeout(
        checkDeadline,
        Math.min(remaining, 2_147_483_647)
      )
    }
    const checkWhenVisible = () => {
      if (!document.hidden) checkDeadline()
    }
    checkDeadline()
    window.addEventListener('focus', checkDeadline)
    document.addEventListener('visibilitychange', checkWhenVisible)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', checkDeadline)
      document.removeEventListener('visibilitychange', checkWhenVisible)
    }
  }, [content, isLoaded, showCampaign])

  const syncIframePreferences = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { themeMode: resolvedTheme },
        '*'
      )
      iframeRef.current?.contentWindow?.postMessage(
        { lang: i18n.language },
        '*'
      )
    } catch {
      // Cross-origin frames may reject access while navigating.
    }
  }, [i18n.language, resolvedTheme])

  useEffect(() => {
    if (isUrl) {
      syncIframePreferences()
    }
  }, [isUrl, syncIframePreferences])

  if (!isLoaded) {
    return (
      <PublicLayout showMainContainer={false}>
        <main className='flex min-h-screen items-center justify-center'>
          <div className='text-muted-foreground'>{t('Loading...')}</div>
        </main>
      </PublicLayout>
    )
  }

  if (content) {
    if (isUrl) {
      return (
        <PublicLayout showMainContainer={false}>
          {/*
            allow-top-navigation-by-user-activation: the custom home page URL is
            admin-configured (trusted); this lets its target="_top" nav/menu links
            navigate the top-level window on user click. The default sandbox blocks
            this on desktop, while some mobile browsers allow it via allow-popups,
            causing inconsistent behavior. This token only permits user-activated
            top-level navigation and does NOT grant same-origin access.
          */}
          <iframe
            ref={iframeRef}
            src={content}
            className='h-[calc(100vh-var(--reward-banner-height,0px))] w-full border-none'
            title={t('Custom Home Page')}
            sandbox='allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts allow-top-navigation-by-user-activation'
            onLoad={syncIframePreferences}
          />
        </PublicLayout>
      )
    }

    const contentIsHtml = isLikelyHtml(content)

    if (contentIsHtml) {
      return (
        <PublicLayout showMainContainer={false}>
          <RichContent
            mode='html'
            htmlVariant='isolated'
            content={content}
            className='custom-home-content'
          />
        </PublicLayout>
      )
    }

    return (
      <PublicLayout>
        <div className='mx-auto max-w-6xl px-4 py-8'>
          <RichContent
            mode='markdown'
            content={content}
            className='custom-home-content'
          />
        </div>
      </PublicLayout>
    )
  }

  if (showCampaign && Date.now() < CAMPAIGN_HOME_END) {
    return <CashbackActivityPage />
  }

  return <DefaultHome isAuthenticated={isAuthenticated} />
}

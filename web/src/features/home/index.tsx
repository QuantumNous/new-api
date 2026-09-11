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
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { RichContent } from '@/components/rich-content'
import { Skeleton } from '@/components/ui/skeleton'
import { useTheme } from '@/context/theme-provider'
import { isLikelyHtml } from '@/lib/content-format'
import { useLandingTone } from '@/lib/landing-theme'
import { useAuthStore } from '@/stores/auth-store'

import {
  Exclusive3D,
  FreeToExplore,
  Hero,
  ModelCoverage,
  ServiceRoutes,
  Support,
} from './components'
import { LandingToneSwitch } from './components/landing-tone-switch'
import { useHomePageContent } from './hooks'

export function Home() {
  const { i18n, t } = useTranslation()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { resolvedTheme } = useTheme()
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user
  const { tone } = useLandingTone()
  const { content, isLoaded, isUrl } = useHomePageContent()

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
        <div className='mx-auto max-w-7xl px-6 pt-20 pb-20 sm:px-10 sm:pt-24 sm:pb-24 lg:px-14 lg:pt-24 lg:pb-28'>
          <div className='grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12'>
            <div className='space-y-6'>
              <Skeleton className='h-16 w-11/12 sm:h-24 sm:w-10/12' />
              <Skeleton className='h-16 w-7/12 sm:h-24 sm:w-8/12' />
              <Skeleton className='mt-8 h-5 w-10/12' />
              <Skeleton className='h-5 w-7/12' />
              <div className='mt-10 flex gap-3'>
                <Skeleton className='h-12 w-32 rounded-full' />
                <Skeleton className='h-12 w-28 rounded-full' />
              </div>
            </div>
            <Skeleton className='aspect-square w-full max-w-[24rem] rounded-[2rem] sm:max-w-[28rem] lg:mx-0 lg:max-w-[30rem]' />
          </div>
        </div>
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
            className='h-screen w-full border-none'
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

  return (
    <div
      data-landing-tone={tone}
      className='bg-background text-foreground min-h-svh'
    >
      {/* Mechanical noise grain — low-opacity film over the whole landing to
          add physical texture and fill dead space without touching the
          editorial layout. SVG feTurbulence keeps it dependency-free. */}
      <div
        aria-hidden='true'
        className='pointer-events-none fixed inset-0 z-10 opacity-[0.05] mix-blend-multiply dark:mix-blend-screen'
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <PublicLayout
        showMainContainer={false}
        showThemeSwitch={false}
        headerProps={{ rightContent: <LandingToneSwitch /> }}
      >
        <Hero isAuthenticated={isAuthenticated} />
        <ServiceRoutes />
        <ModelCoverage />
        <Exclusive3D />
        <FreeToExplore />
        <Support />
        <Footer />
      </PublicLayout>
    </div>
  )
}

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
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { useTheme } from '@/context/theme-provider'
import { Markdown } from '@/components/ui/markdown'
import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { CTA, Features, Hero, HowItWorks, Stats } from './components'
import { useHomePageContent } from './hooks'

export function Home() {
  const { t, i18n } = useTranslation()
  const { auth } = useAuthStore()
  const { resolvedTheme } = useTheme()
  const isAuthenticated = !!auth.user
  const { content, isLoaded, isUrl } = useHomePageContent()

  let iframeNavHeight: string | null = null
  if (isUrl && content) {
    try {
      const url = new URL(content)
      iframeNavHeight = url.searchParams.get('navHeight')
    } catch {
      // ignore
    }
  }

  const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const iframe = e.currentTarget
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ themeMode: resolvedTheme }, '*')
      iframe.contentWindow.postMessage({ lang: i18n.language }, '*')
    }
  }

  // Handle theme or language changes for the already loaded iframe
  useEffect(() => {
    if (isUrl && content) {
      const iframe = document.querySelector('iframe')
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ themeMode: resolvedTheme }, '*')
        iframe.contentWindow.postMessage({ lang: i18n.language }, '*')
      }
    }
  }, [resolvedTheme, i18n.language, isUrl, content])

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
    return (
      <PublicLayout showMainContainer={false} navHeight={iframeNavHeight}>
        <main className='relative overflow-x-hidden'>
          {isUrl ? (
            <div className='h-screen w-full'>
              <iframe
                src={content}
                className='block h-full w-full border-none'
                title={t('Custom Home Page')}
                onLoad={handleIframeLoad}
              />
            </div>
          ) : (
            <div className='container mx-auto py-8 pt-24'>
              <Markdown className='custom-home-content'>{content}</Markdown>
            </div>
          )}
        </main>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <Hero isAuthenticated={isAuthenticated} />
      <Stats />
      <Features />
      <HowItWorks />
      <CTA isAuthenticated={isAuthenticated} />
      <Footer />
    </PublicLayout>
  )
}

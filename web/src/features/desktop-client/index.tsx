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
import { ArrowRight, Apple, Download, MonitorDown } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MarketingHeader } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { useTheme } from '@/context/theme-provider'
import { CiMark } from '@/features/home/components/ci-mark'
import { GlassCursor } from '@/features/home/components/glass-cursor'
import { PRODUCT_NAME } from '@/lib/product-brand'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import {
  getDownloadUrl,
  resolveDownload,
  type DownloadEnvironment,
} from './lib/downloads'

import '@/styles/client-landing.css'

export type DesktopClientRuntime = {
  hostname: string
  environment: DownloadEnvironment
}

export type DesktopClientPageProps = {
  runtime?: DesktopClientRuntime
}

function getBrowserRuntime(): DesktopClientRuntime {
  if (typeof window === 'undefined') {
    return {
      hostname: '',
      environment: { userAgent: '', platform: '', maxTouchPoints: 0 },
    }
  }

  return {
    hostname: window.location.hostname,
    environment: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
    },
  }
}

export function DesktopClientPage(props: DesktopClientPageProps = {}) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const isAuthenticated = useAuthStore((state) => !!state.auth.user)
  const manualHeadingRef = useRef<HTMLHeadingElement>(null)
  const [platformMessage, setPlatformMessage] = useState('')
  const runtime = props.runtime ?? getBrowserRuntime()
  const automaticDownload = resolveDownload(
    runtime.environment,
    runtime.hostname
  )
  const isDark = resolvedTheme === 'dark'

  let automaticLabel = t('Download desktop client')
  if (automaticDownload?.platform === 'windows') {
    automaticLabel = t('Download for Windows')
  } else if (automaticDownload?.platform === 'macos') {
    automaticLabel = t('Download for macOS')
  }

  const handleAutomaticDownload = (
    event: React.MouseEvent<HTMLAnchorElement>
  ) => {
    const currentRuntime = props.runtime ?? getBrowserRuntime()
    const currentDownload = resolveDownload(
      currentRuntime.environment,
      currentRuntime.hostname
    )

    if (currentDownload) {
      event.currentTarget.href = currentDownload.url
      return
    }

    event.preventDefault()
    setPlatformMessage(
      t(
        'We could not detect a supported desktop system. Choose Windows or macOS below.'
      )
    )

    const manualHeading = manualHeadingRef.current
    if (!manualHeading) return
    manualHeading.focus({ preventScroll: true })
    if (typeof manualHeading.scrollIntoView === 'function') {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)')
        .matches
        ? 'auto'
        : 'smooth'
      manualHeading.scrollIntoView({ behavior, block: 'center' })
    }
  }

  return (
    <div
      className='ci-landing ci-theme client-landing'
      data-theme={isDark ? 'dark' : 'light'}
    >
      <GlassCursor scopeSelector='.client-landing' />
      <div className='ci-handoffRoot'>
        <MarketingHeader
          isAuthenticated={isAuthenticated}
          currentPage='client'
        />
        <main>
          <section className='client-hero' aria-labelledby='client-hero-title'>
            <span className='client-ambient' aria-hidden='true' />
            <div className='client-hero__copy'>
              <div className='client-hero__brand'>
                <CiMark size={52} />
                <span>{PRODUCT_NAME}</span>
                <span>{t('Client')}</span>
              </div>
              <p className='client-kicker'>{t('Desktop client')}</p>
              <h1 id='client-hero-title'>
                {t('AI workspace, now on your desktop')}
              </h1>
              <p className='client-hero__description'>
                {t(
                  'Use one client to connect apps, choose models, and understand every price.'
                )}
              </p>
              <div className='client-hero__actions'>
                <a
                  className='ci-button ci-button--default client-downloadButton'
                  href={automaticDownload?.url ?? '#manual-downloads'}
                  onClick={handleAutomaticDownload}
                >
                  <Download size={17} aria-hidden='true' />
                  {automaticLabel}
                  <ArrowRight size={17} aria-hidden='true' />
                </a>
                <a className='client-secondaryLink' href='#manual-downloads'>
                  {t('Choose another version')}
                  <ArrowRight size={15} aria-hidden='true' />
                </a>
              </div>
            </div>
            <div className='client-product-plane'>
              <figure
                className='client-laptop'
                aria-label={t('Yecai Client application overview')}
              >
                <div className='client-laptop__screen'>
                  <span className='client-laptop__camera' aria-hidden='true' />
                  <img
                    src='/client/yecai-client-apps.png'
                    alt={t('Yecai Client application overview')}
                    width={2220}
                    height={1564}
                    fetchPriority='high'
                    decoding='async'
                  />
                </div>
                <div className='client-laptop__base' aria-hidden='true' />
              </figure>
            </div>
          </section>

          <section
            className='client-story client-story--access'
            aria-labelledby='client-access-title'
          >
            <div className='client-story__copy'>
              <p className='client-kicker'>01 / {t('Client')}</p>
              <h2 id='client-access-title'>
                {t('Your apps, ready to connect')}
              </h2>
              <p>
                {t(
                  'Find supported desktop apps and finish setup without copying settings by hand.'
                )}
              </p>
            </div>
            <div className='client-story__image'>
              <img
                src='/client/yecai-client-application-access.png'
                alt={t('Yecai Client application access setup')}
                width={2230}
                height={1568}
                loading='lazy'
                decoding='async'
              />
            </div>
          </section>

          <section
            className='client-story client-story--pricing'
            aria-labelledby='client-pricing-title'
          >
            <div className='client-story__copy'>
              <p className='client-kicker'>02 / {t('Client')}</p>
              <h2 id='client-pricing-title'>
                {t('Choose with the full picture')}
              </h2>
              <p>
                {t(
                  'Compare complete model IDs, routes, and billing groups before connecting.'
                )}
              </p>
            </div>
            <div className='client-pricing-gallery'>
              <figure>
                <img
                  src='/client/yecai-client-models-light.png'
                  alt={t('Yecai Client model pricing in light theme')}
                  width={2180}
                  height={1574}
                  loading='lazy'
                  decoding='async'
                />
              </figure>
              <figure className='client-pricing-gallery__dark'>
                <img
                  src='/client/yecai-client-models-dark.png'
                  alt={t('Yecai Client model pricing in dark theme')}
                  width={2196}
                  height={1546}
                  loading='lazy'
                  decoding='async'
                />
              </figure>
            </div>
          </section>

          <section
            id='manual-downloads'
            className='client-downloads'
            aria-labelledby='manual-download-title'
          >
            <div className='client-downloads__intro'>
              <p className='client-kicker'>03 / {t('Client')}</p>
              <h2
                id='manual-download-title'
                ref={manualHeadingRef}
                tabIndex={-1}
              >
                {t('Choose your download')}
              </h2>
              <p role='status' aria-live='polite'>
                {platformMessage}
              </p>
            </div>
            <div className='client-download-grid'>
              <a
                className={cn(
                  'client-downloadOption',
                  isDark && 'client-downloadOption--dark'
                )}
                href={getDownloadUrl('windows', runtime.hostname)}
                aria-label={t('Windows installer')}
              >
                <span className='client-downloadOption__icon'>
                  <MonitorDown size={24} aria-hidden='true' />
                </span>
                <span className='client-downloadOption__body'>
                  <strong>{t('Windows installer')}</strong>
                  <span>{t('Windows 10 or later')} · x86_64</span>
                </span>
                <ArrowRight size={18} aria-hidden='true' />
              </a>
              <a
                className={cn(
                  'client-downloadOption',
                  isDark && 'client-downloadOption--dark'
                )}
                href={getDownloadUrl('macos', runtime.hostname)}
                aria-label={t('Universal macOS DMG')}
              >
                <span className='client-downloadOption__icon'>
                  <Apple size={24} aria-hidden='true' />
                </span>
                <span className='client-downloadOption__body'>
                  <strong>{t('Universal macOS DMG')}</strong>
                  <span>{t('Intel and Apple silicon')}</span>
                </span>
                <ArrowRight size={18} aria-hidden='true' />
              </a>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </div>
  )
}

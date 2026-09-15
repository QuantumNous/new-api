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

const LIGHT_OVERVIEW = {
  src: '/client/yecai-client-apps-light-showcase.webp',
  width: 1820,
  height: 880,
} as const

const DARK_OVERVIEW = {
  src: '/client/yecai-client-apps-dark-showcase.webp',
  width: 1826,
  height: 873,
} as const

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
  const heroOverview = isDark ? DARK_OVERVIEW : LIGHT_OVERVIEW
  const alternateOverview = isDark ? LIGHT_OVERVIEW : DARK_OVERVIEW
  const heroOverviewAlt = isDark
    ? t('Yecai Client application overview in dark theme')
    : t('Yecai Client application overview in light theme')
  const alternateOverviewAlt = isDark
    ? t('Yecai Client application overview in light theme')
    : t('Yecai Client application overview in dark theme')

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
                <CiMark size={46} />
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
                  className='ci-button ci-button--lime client-downloadButton'
                  href={automaticDownload?.url ?? '#manual-downloads'}
                  onClick={handleAutomaticDownload}
                >
                  <Download size={17} aria-hidden='true' />
                  {automaticLabel}
                  <ArrowRight size={17} aria-hidden='true' />
                </a>
                <a
                  className='ci-button ci-button--outline client-manualButton'
                  href='#manual-downloads'
                >
                  {t('Choose another version')}
                  <ArrowRight size={16} aria-hidden='true' />
                </a>
              </div>
            </div>

            <div className='client-productStage'>
              <figure className='client-appWindow'>
                <figcaption className='client-appWindow__bar'>
                  <span className='client-appWindow__dots' aria-hidden='true'>
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>
                    {PRODUCT_NAME} {t('Client')}
                  </span>
                </figcaption>
                <img
                  src={heroOverview.src}
                  alt={heroOverviewAlt}
                  width={heroOverview.width}
                  height={heroOverview.height}
                  fetchPriority='high'
                  decoding='async'
                />
              </figure>
            </div>
          </section>

          <section
            className='client-feature client-feature--access'
            aria-labelledby='client-access-title'
          >
            <div className='client-feature__copy'>
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
            <figure className='client-screenshotFrame'>
              <figcaption>{t('Your apps, ready to connect')}</figcaption>
              <img
                src='/client/yecai-client-app-connection-showcase.webp'
                alt={t('Yecai Client application access setup')}
                width={1825}
                height={982}
                loading='lazy'
                decoding='async'
              />
            </figure>
          </section>

          <section
            className='client-feature client-feature--pricing'
            aria-labelledby='client-pricing-title'
          >
            <div className='client-feature__copy'>
              <p className='client-kicker'>02 / {t('Client')}</p>
              <h2 id='client-pricing-title'>
                {t('Choose with the full picture')}
              </h2>
              <p>
                {t(
                  'Compare complete model IDs, routes, and billing groups before connecting.'
                )}
              </p>
              <small>
                {t(
                  'Pricing shown in the product preview is illustrative and may change.'
                )}
              </small>
            </div>
            <figure className='client-screenshotFrame'>
              <figcaption>{t('Choose with the full picture')}</figcaption>
              <img
                src='/client/yecai-client-model-pricing-showcase.webp'
                alt={t('Yecai Client model and pricing choices')}
                width={1820}
                height={1344}
                loading='lazy'
                decoding='async'
              />
            </figure>
          </section>

          <section
            className='client-feature client-feature--theme'
            aria-labelledby='client-theme-title'
          >
            <div className='client-feature__copy'>
              <p className='client-kicker'>03 / {t('Theme')}</p>
              <h2 id='client-theme-title'>
                {t('Comfortable in light or dark')}
              </h2>
              <p>
                {t(
                  'Follow your system theme while keeping the same clear application workspace.'
                )}
              </p>
            </div>
            <figure className='client-screenshotFrame'>
              <figcaption>
                {isDark ? t('Light') : t('Dark')} · {t('Theme')}
              </figcaption>
              <img
                src={alternateOverview.src}
                alt={alternateOverviewAlt}
                width={alternateOverview.width}
                height={alternateOverview.height}
                loading='lazy'
                decoding='async'
              />
            </figure>
          </section>

          <section
            id='manual-downloads'
            className='client-downloads'
            aria-labelledby='manual-download-title'
          >
            <div className='client-downloads__intro'>
              <p className='client-kicker'>04 / {t('Client')}</p>
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
                className='client-downloadOption'
                href={getDownloadUrl('windows', runtime.hostname)}
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
                className='client-downloadOption'
                href={getDownloadUrl('macos', runtime.hostname)}
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

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
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'

import { HomeLink } from '../home-link'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

const PROOF_ITEMS = [
  {
    value: '40+',
    labelKey: 'upstream AI providers',
  },
  {
    value: '2',
    labelKey: 'private deployment and online service modes',
  },
  {
    value: '6',
    labelKey: 'frontend languages covered',
  },
  {
    value: '3',
    labelKey: 'compatible database engines',
  },
] as const

const PROVIDER_TAGS = ['OpenAI', 'Claude', 'Gemini', 'Azure'] as const
const HOME_BRAND_NAME = 'Lighting'
const HOME_LOGO = '/lighting-logo.png'

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const docsUrl =
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'
  let configuredServerAddress = ''
  if (typeof status?.server_address === 'string') {
    configuredServerAddress = status.server_address
  } else if (typeof status?.data?.server_address === 'string') {
    configuredServerAddress = status.data.server_address
  }
  const gatewayAddress = (
    configuredServerAddress ||
    (typeof window !== 'undefined' ? window.location.origin : '') ||
    'https://yourdomain.com'
  ).replace(/\/+$/, '')

  return (
    <section className='home-hero'>
      <div className='home-shell home-hero-layout'>
        <div>
          <div className='home-eyebrow'>
            <span className='home-eyebrow-mark' />
            {t(
              'Enterprise AI unified access, delivery, and operations service'
            )}
          </div>
          <h1 className='home-hero-title'>
            {t(
              'Make mainstream AI models globally available as a sustainable enterprise capability'
            )}
          </h1>
          <p className='home-hero-lede'>
            {t(
              '{{systemName}} is not just token resale. It combines 40+ upstream models, OpenAI-compatible APIs, channel redundancy, billing settlement, organization reports, and ongoing service into one enterprise AI access point.',
              { systemName: HOME_BRAND_NAME }
            )}
          </p>

          <div className='home-hero-actions' aria-label={t('Primary actions')}>
            <HomeLink
              href={props.isAuthenticated ? '/dashboard' : '#scenarios'}
              className='home-button home-button-primary home-button-large'
            >
              {props.isAuthenticated
                ? t('Go to Dashboard')
                : t('Choose integration mode')}
              <ArrowRight className='size-4' aria-hidden='true' />
            </HomeLink>
            {!props.isAuthenticated && (
              <HomeLink
                href='#contact'
                className='home-button home-button-teal home-button-large'
              >
                {t('Contact advisor')}
              </HomeLink>
            )}
            <HomeLink
              href={docsUrl}
              className='home-button home-button-secondary home-button-large'
            >
              {t('View docs')}
            </HomeLink>
          </div>

          <div className='home-proof-grid' aria-label={t('Platform facts')}>
            {PROOF_ITEMS.map((item) => (
              <div className='home-proof-item' key={item.labelKey}>
                <span className='home-proof-value'>{item.value}</span>
                <span className='home-proof-label'>{t(item.labelKey)}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          className='home-hero-visual'
          aria-label={t('{{systemName}} unified gateway diagram', {
            systemName: HOME_BRAND_NAME,
          })}
        >
          <div className='home-gateway-shell'>
            <div className='home-gateway-topbar'>
              <div className='home-topbar-title'>
                <span className='home-topbar-logo' aria-hidden='true'>
                  <img src={HOME_LOGO} alt='' width={28} height={28} />
                </span>
                <span className='home-topbar-copy'>
                  <span className='home-topbar-kicker'>
                    {t('{{systemName}} Control Plane', {
                      systemName: HOME_BRAND_NAME,
                    })}
                  </span>
                  <strong>{t('Unified AI Gateway')}</strong>
                </span>
              </div>
              <span className='home-topbar-status'>
                {t('OpenAI compatible')}
              </span>
            </div>

            <div className='home-gateway-body'>
              <div
                className='home-call-graph'
                aria-label={t('Simple call graph')}
              >
                <div className='home-call-node'>
                  <span className='home-call-kicker'>{t('Client')}</span>
                  <strong>{t('App / SDK')}</strong>
                  <p className='home-call-summary'>{t('OpenAI compatible')}</p>
                </div>

                <div className='home-call-arrow'>
                  <span>{t('API Key')}</span>
                </div>

                <div className='home-call-node home-call-node-gateway'>
                  <span className='home-call-logo' aria-hidden='true'>
                    <img
                      src={HOME_LOGO}
                      alt=''
                      width={64}
                      height={64}
                      loading='lazy'
                    />
                  </span>
                  <span className='home-call-kicker'>{HOME_BRAND_NAME}</span>
                  <strong>{t('Unified AI Gateway')}</strong>
                  <div
                    className='home-gateway-capabilities'
                    aria-label={t('Gateway')}
                  >
                    <span>{t('Route')}</span>
                    <span>{t('Billing')}</span>
                    <span>{t('Logs')}</span>
                    <span>{t('Retry')}</span>
                  </div>
                </div>

                <div className='home-call-arrow'>
                  <span>{t('Route')}</span>
                </div>

                <div className='home-call-node'>
                  <span className='home-call-kicker'>{t('Providers')}</span>
                  <strong className='home-call-metric'>40+</strong>
                  <p className='home-call-summary'>{t('Models')}</p>
                  <div className='home-provider-tags'>
                    {PROVIDER_TAGS.map((provider) => (
                      <span key={provider}>{provider}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className='home-endpoint-card'>
                <div className='home-endpoint-copy'>
                  <span>{t('Default access address')}</span>
                  <strong>{gatewayAddress}</strong>
                </div>
                <span className='home-endpoint-badge'>
                  {configuredServerAddress
                    ? t('Configured in system settings')
                    : t('Current browser domain')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

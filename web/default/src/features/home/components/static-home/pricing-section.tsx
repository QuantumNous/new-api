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
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { DOCS_URL, metrics, pricingCards } from './content'
import type { StaticHomeText } from './types'

export function PricingSection({ t }: { t: StaticHomeText }) {
  return (
    <section className='static-home__section static-home__pricing' id='pricing'>
      <div className='static-home__section-head' data-home-reveal>
        <p className='static-home__eyebrow'>{t('home.static.pricing.eyebrow')}</p>
        <h2>{t('home.static.pricing.title')}</h2>
        <p className='static-home__pricing-subtitle'>{t('home.static.pricing.subtitle')}</p>
      </div>
      <div className='static-home__pricing-grid'>
        {pricingCards.map((card) => {
          const isFeatured = 'featured' in card && card.featured

          return (
            <article
              className={cn('static-home__glass-card static-home__pricing-card', isFeatured && 'is-featured')}
              key={card.titleKey}
              data-home-reveal
            >
              {'badgeKey' in card && card.badgeKey && (
                <span className='static-home__pricing-badge'>{t(card.badgeKey)}</span>
              )}
              <h3>{t(card.titleKey)}</h3>
              {'summaryKey' in card && card.summaryKey && (
                <p className='static-home__pricing-summary static-home__pricing-summary--accent'>
                  {t(card.summaryKey)}
                </p>
              )}
              {'priceVariant' in card && card.priceVariant === 'split' ? (
                <p className='static-home__pricing-price static-home__pricing-price--split static-home__pricing-price--accent'>
                  <span className='static-home__pricing-price-prefix'>
                    {t('home.static.pricing.developer.pricePrefix')}
                  </span>
                  <span className='static-home__pricing-price-value'>
                    {t('home.static.pricing.developer.priceValue')}
                  </span>
                  <span className='static-home__pricing-price-unit'>{t('home.static.pricing.developer.priceUnit')}</span>
                </p>
              ) : (
                <p
                  className={cn(
                    'static-home__pricing-price',
                    'static-home__pricing-price--text',
                    'priceTone' in card && card.priceTone === 'neutral'
                      ? 'static-home__pricing-price--neutral'
                      : 'static-home__pricing-price--accent'
                  )}
                >
                  {t(card.priceKey)}
                </p>
              )}
              <ul className='static-home__pricing-feature-list'>
                {card.features.map((feature) => (
                  <li key={feature}>{t(feature)}</li>
                ))}
              </ul>
              <a
                className={cn(
                  'static-home__pricing-cta',
                  isFeatured ? 'static-home__pricing-cta--solid' : 'static-home__pricing-cta--ghost'
                )}
                href={card.href}
                target={'external' in card && card.external ? '_blank' : undefined}
                rel={'external' in card && card.external ? 'noreferrer' : undefined}
              >
                {t(card.ctaKey)}
              </a>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function MetricsSection({ t }: { t: StaticHomeText }) {
  return (
    <section className='static-home__metrics' aria-label='metrics'>
      {metrics.map((metric) => {
        const Icon = metric.icon
        return (
          <article className='static-home__glass-card static-home__metric-card' key={metric.labelKey} data-home-reveal>
            <span className='static-home__metric-icon'>
              <Icon className='size-5' />
            </span>
            <span className='static-home__metric-copy'>
              <strong>{'value' in metric ? metric.value : t(metric.valueKey)}</strong>
              <span>{t(metric.labelKey)}</span>
            </span>
          </article>
        )
      })}
    </section>
  )
}

export function StartJourney({
  primaryHref,
  t,
}: {
  primaryHref: string
  t: StaticHomeText
}) {
  return (
    <section className='static-home__start' id='invite' data-home-reveal>
      <div className='static-home__glass-card static-home__start-journey-card'>
        <div className='static-home__start-journey-copy'>
          <h2>{t('home.static.cta.title')}</h2>
          <p>{t('home.static.cta.text')}</p>
        </div>
        <div className='static-home__start-journey-actions'>
          <Link to={primaryHref} className='static-home__start-journey-button'>
            {t('home.static.cta.free')}
          </Link>
          <a href={DOCS_URL} className='static-home__start-journey-button static-home__start-journey-button--ghost'>
            {t('home.static.hero.viewDocs')}
          </a>
        </div>
      </div>
    </section>
  )
}

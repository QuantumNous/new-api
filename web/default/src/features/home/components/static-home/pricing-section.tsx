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
        <p>{t('home.static.pricing.eyebrow')}</p>
        <h2>{t('home.static.pricing.title')}</h2>
        <span>{t('home.static.pricing.subtitle')}</span>
      </div>
      <div className='static-home__pricing-grid'>
        {pricingCards.map((card) => (
          <article
            className={cn(
              'static-home__glass-card static-home__pricing-card',
              'featured' in card && card.featured && 'is-featured'
            )}
            key={card.titleKey}
            data-home-reveal
          >
            {'badgeKey' in card && card.badgeKey && <span>{t(card.badgeKey)}</span>}
            <h3>{t(card.titleKey)}</h3>
            <strong>{t(card.priceKey)}</strong>
            {'summaryKey' in card && card.summaryKey && <p>{t(card.summaryKey)}</p>}
            <ul>
              {card.features.map((feature) => (
                <li key={feature}>{t(feature)}</li>
              ))}
            </ul>
            <a
              href={card.href}
              target={'external' in card && card.external ? '_blank' : undefined}
              rel={'external' in card && card.external ? 'noreferrer' : undefined}
            >
              {t(card.ctaKey)}
            </a>
          </article>
        ))}
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
          <article className='static-home__glass-card' key={metric.labelKey} data-home-reveal>
            <Icon className='size-6' />
            <strong>{'value' in metric ? metric.value : t(metric.valueKey)}</strong>
            <span>{t(metric.labelKey)}</span>
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
      <div className='static-home__glass-card'>
        <div>
          <h2>{t('home.static.cta.title')}</h2>
          <p>{t('home.static.cta.text')}</p>
        </div>
        <div>
          <Link to={primaryHref}>{t('home.static.cta.free')}</Link>
          <a href={DOCS_URL}>{t('home.static.hero.viewDocs')}</a>
        </div>
      </div>
    </section>
  )
}

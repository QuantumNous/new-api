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
import { DOCS_URL, heroFeatures, whyCards } from './content'
import { HeroVisual } from './hero-visual'
import type { StaticHomeText } from './types'

export function HeroSection({
  primaryHref,
  t,
}: {
  primaryHref: string
  t: StaticHomeText
}) {
  return (
    <section className='static-home__hero'>
      <div className='static-home__hero-copy' data-home-reveal>
        <h1>
          <span>{t('home.static.hero.title1')}</span>
          <span>{t('home.static.hero.title2')}</span>
        </h1>
        <p>{t('home.static.hero.text')}</p>
        <div className='static-home__hero-actions'>
          <Link to={primaryHref} className='static-home__cta static-home__cta--solid'>
            {t('home.static.hero.freeTrial')}
          </Link>
          <a href={DOCS_URL} className='static-home__cta'>
            {t('home.static.hero.viewDocs')}
          </a>
        </div>
        <div className='static-home__hero-features'>
          {heroFeatures.map((item) => {
            const Icon = item.icon
            return (
              <article key={item.titleKey}>
                <Icon className='size-5' />
                <div>
                  <strong>{t(item.titleKey)}</strong>
                  <span>{t(item.textKey)}</span>
                </div>
              </article>
            )
          })}
        </div>
      </div>
      <div className='static-home__hero-art static-home__hero-art--motion' data-home-reveal>
        <HeroVisual label={t('home.static.hero.visual')} />
      </div>
    </section>
  )
}

export function WhySection({ t }: { t: StaticHomeText }) {
  return (
    <section className='static-home__section static-home__why'>
      <div className='static-home__section-head' data-home-reveal>
        <h2>{t('home.static.why.title')}</h2>
        <p>{t('home.static.why.subtitle')}</p>
      </div>
      <div className='static-home__why-grid'>
        {whyCards.map((card) => {
          const Icon = card.icon
          return (
            <article
              className='static-home__glass-card'
              key={card.titleKey}
              data-home-reveal
            >
              <Icon className='size-6' />
              <h3>{t(card.titleKey)}</h3>
              <p>
                {card.lines.map((line) => (
                  <span key={line}>{t(line)}</span>
                ))}
              </p>
            </article>
          )
        })}
      </div>
    </section>
  )
}

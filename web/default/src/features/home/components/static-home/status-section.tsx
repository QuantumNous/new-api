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
import { Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { endpointCards, homeModelShowcase } from './content'
import { healthLabelClass } from './hooks'
import type { CopyToast, HomeModelStatus, StaticHomeText } from './types'

export function EndpointStrip({
  copyToast,
  t,
}: {
  copyToast: CopyToast
  t: StaticHomeText
}) {
  return (
    <section className='static-home__endpoint-strip' id='docs'>
      {endpointCards.map((card) => (
        <article
          className='static-home__glass-card static-home__endpoint-card'
          key={card.value}
          data-home-reveal
        >
          <div className='static-home__endpoint-card-meta'>
            <span className='static-home__endpoint-mark' aria-hidden='true' />
            <p className='static-home__card-label'>{t(card.labelKey)}</p>
          </div>
          <div className='static-home__endpoint-card-value'>
            <code>{card.value}</code>
            <button
              type='button'
              onClick={() => copyToast.copy(card.value, t('home.static.toast.copied'))}
              aria-label={t(card.copyLabelKey)}
            >
              <Copy className='size-4' aria-hidden='true' />
            </button>
          </div>
        </article>
      ))}
    </section>
  )
}

export function ModelStatusSection({
  models: _models,
  t,
}: {
  models: HomeModelStatus
  t: StaticHomeText
}) {
  return (
    <section className='static-home__section static-home__models' id='models'>
      <div className='static-home__section-head static-home__section-head--split' data-home-reveal>
        <div>
          <p className='static-home__eyebrow'>{t('home.static.models.eyebrow')}</p>
          <h2>{t('home.static.models.title')}</h2>
        </div>
        <div className='static-home__legend-row'>
          <div className='static-home__legend'>
            <span><i className='static-home__status-dot static-home__status-dot--running' />{t('home.static.models.up')}</span>
            <span><i className='static-home__status-dot static-home__status-dot--busy' />{t('home.static.models.degraded')}</span>
            <span><i className='static-home__status-dot static-home__status-dot--degraded' />{t('home.static.models.legend.degraded')}</span>
            <span><i className='static-home__status-dot static-home__status-dot--maintenance' />{t('home.static.models.legend.maintenance')}</span>
            <span><i className='static-home__status-dot static-home__status-dot--offline' />{t('home.static.models.down')}</span>
          </div>
        </div>
      </div>
      <div className='static-home__model-grid'>
        {homeModelShowcase.map((model) => (
          <article
            className='static-home__glass-card static-home__model-card'
            key={model.model}
            data-home-reveal
          >
            <div className='static-home__model-card-head'>
              <div className='static-home__model-identity'>
                <span className={cn('static-home__model-logo', model.logoClass)}>{model.logoText}</span>
                <div className='static-home__model-copy'>
                  <h3 title={model.model}>{model.model}</h3>
                  <p>{model.brand}</p>
                </div>
              </div>
              <span
                className={cn(
                  'static-home__status-badge',
                  'static-home__status-badge--compact',
                  healthLabelClass(model.healthLabel)
                )}
              >
                {t(`home.static.models.${model.healthLabel === 'up' ? 'up' : model.healthLabel}`)}
              </span>
            </div>
            <dl>
              <div>
                <dt>{t('home.static.models.availability')}</dt>
                <dd>{`${model.availability.toFixed(1)}%`}</dd>
              </div>
              <div>
                <dt>{t('home.static.models.latency')}</dt>
                <dd>{`${Math.round(model.latency)}ms`}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className='static-home__model-more'>
        <Link to='/status'>{t('home.static.models.viewAll')}</Link>
      </div>
    </section>
  )
}

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
import { endpointCards } from './content'
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
          <p>{t(card.labelKey)}</p>
          <div>
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
  models,
  t,
}: {
  models: HomeModelStatus
  t: StaticHomeText
}) {
  const summaryText = models.error
    ? t('home.static.models.error')
    : `${models.summary.upModels}/${models.summary.totalModels || 0} ${t('home.static.models.up')}`

  return (
    <section className='static-home__section static-home__models' id='models'>
      <div className='static-home__section-head static-home__section-head--split' data-home-reveal>
        <div>
          <p>{t('home.static.models.eyebrow')}</p>
          <h2>{t('home.static.models.title')}</h2>
        </div>
        <span className={cn('static-home__status-summary', healthLabelClass(models.summary.overallStatus))}>
          {summaryText}
        </span>
      </div>
      <div className='static-home__model-grid'>
        {models.models.map((model) => (
          <article
            className='static-home__glass-card static-home__model-card'
            key={`${model.group}-${model.model}`}
            data-home-reveal
          >
            <div>
              <div>
                <span>{model.model.slice(0, 1).toUpperCase()}</span>
                <div>
                  <h3 title={model.model}>{model.model}</h3>
                  <p>{model.group}</p>
                </div>
              </div>
              <span className={cn('static-home__status-badge', healthLabelClass(model.healthLabel))}>
                {t(`home.static.models.${model.healthLabel === 'up' ? 'up' : model.healthLabel}`)}
              </span>
            </div>
            <dl>
              <div>
                <dt>{t('home.static.models.availability')}</dt>
                <dd>{model.availability ? `${model.availability.toFixed(1)}%` : '-'}</dd>
              </div>
              <div>
                <dt>{t('home.static.models.latency')}</dt>
                <dd>{model.latency ? `${Math.round(model.latency)}ms` : '-'}</dd>
              </div>
            </dl>
          </article>
        ))}
        {!models.loading && models.models.length === 0 && (
          <article className='static-home__glass-card static-home__empty-card'>
            {models.error ? t('home.static.models.error') : t('home.static.models.empty')}
          </article>
        )}
      </div>
      <div className='static-home__model-more'>
        <Link to='/status'>{t('home.static.models.viewAll')}</Link>
      </div>
    </section>
  )
}

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
import { ArrowRight, Calculator } from 'lucide-react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { YecaiAction } from '@/components/yecai'

import caiCaiGuide from '../assets/cai-cai-guide-v1.png'

interface HeroMarketStageProps {
  maxSavingsPercent?: number
}

function updateMarketStagePointer(event: ReactPointerEvent<HTMLElement>) {
  const bounds = event.currentTarget.getBoundingClientRect()
  if (bounds.width === 0 || bounds.height === 0) return

  const x = (event.clientX - bounds.left) / bounds.width - 0.5
  const y = (event.clientY - bounds.top) / bounds.height - 0.5
  event.currentTarget.style.setProperty('--market-pointer-x', x.toFixed(3))
  event.currentTarget.style.setProperty('--market-pointer-y', y.toFixed(3))
}

function resetMarketStagePointer(event: ReactPointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty('--market-pointer-x', '0')
  event.currentTarget.style.setProperty('--market-pointer-y', '0')
}

export function HeroMarketStage(props: HeroMarketStageProps) {
  const { t } = useTranslation()
  const hasSavings =
    props.maxSavingsPercent != null && props.maxSavingsPercent > 0
  const savingsPercent = Math.min(
    100,
    Math.max(0, Math.round(props.maxSavingsPercent ?? 0))
  )
  const yecaiPriceIndex = 100 - savingsPercent

  return (
    <aside
      aria-label={t('Savings receipt')}
      className='dopa-market-stage'
      data-testid='hero-savings-proof'
      onPointerMove={updateMarketStagePointer}
      onPointerLeave={resetMarketStagePointer}
    >
      <div className='dopa-market-stage__halo' aria-hidden='true' />
      <div className='dopa-market-stage__scene'>
        <div className='dopa-market-stage__watermark' aria-hidden='true'>
          野菜API
        </div>

        <figure className='dopa-market-stage__guide'>
          <img
            src={caiCaiGuide}
            alt={t('Setup guide')}
            width={1122}
            height={1402}
            fetchPriority='high'
          />
        </figure>

        <div className='dopa-market-stage__token-trail' aria-hidden='true'>
          <i />
          <i />
          <i />
          <i />
        </div>

        <div className='dopa-market-ticket' data-testid='hero-savings-copy'>
          <div className='dopa-market-ticket__live'>
            <span aria-hidden='true' />
            {t('Live pricing')}
          </div>
          <span className='dopa-market-ticket__eyebrow'>
            {t('Best current saving')}
          </span>
          <strong aria-live='polite'>
            {hasSavings ? (
              <span key={savingsPercent} className='dopa-number-change'>
                {t('Save {{percent}}%', { percent: savingsPercent })}
              </span>
            ) : (
              <span>—</span>
            )}
          </strong>
          <p>
            {hasSavings
              ? t('For the same usage, based on the best live model price.')
              : t('Live prices are loading.')}
          </p>

          <dl className='dopa-market-ticket__index'>
            <div>
              <dt>{t('Official API price index')}</dt>
              <dd>100</dd>
            </div>
            <div data-source='yecai'>
              <dt>{t('Yecai price index')}</dt>
              <dd>{hasSavings ? yecaiPriceIndex : '—'}</dd>
            </div>
          </dl>
        </div>

        <YecaiAction
          appearance='soft'
          tone='leaf'
          size='sm'
          className='dopa-market-stage__action'
          render={<a href='#savings-calculator' />}
        >
          <Calculator aria-hidden='true' />
          <span>{t('Calculate with my usage')}</span>
          <ArrowRight aria-hidden='true' />
        </YecaiAction>
      </div>
    </aside>
  )
}

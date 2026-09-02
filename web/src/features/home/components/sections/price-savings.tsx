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
import { ArrowRight, Calculator, RefreshCw, ReceiptText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import type { SavingsModel } from '../../lib/pricing-savings'
import { PriceCompare } from './price-compare'
import { SavingsCalculator } from './savings-calculator'

interface PriceSavingsProps {
  models: SavingsModel[]
  calculatorModels?: SavingsModel[]
}

export function PriceSavings(props: PriceSavingsProps) {
  const { t } = useTranslation()
  const calculatorModels = props.calculatorModels ?? props.models
  const hasCalculatorData = calculatorModels.length > 0
  const hasComparisonData = props.models.length > 0

  return (
    <section
      id='savings-calculator'
      className='dopa-price-stage relative scroll-mt-24 overflow-hidden px-6 py-16 md:py-24'
    >
      <div
        aria-hidden
        className='pointer-events-none absolute inset-x-0 top-20 -z-10 mx-auto h-96 max-w-5xl rounded-full opacity-50 blur-3xl'
        style={{
          background:
            'linear-gradient(100deg, color-mix(in oklch, var(--chart-4) 16%, transparent), color-mix(in oklch, var(--chart-1) 12%, transparent), color-mix(in oklch, var(--chart-3) 14%, transparent))',
        }}
      />

      <div className='dopa-section-shell' data-section='PRICE'>
        <div className='grid items-end gap-6 md:grid-cols-[0.9fr_1.1fr]'>
          <div>
            <div className='dopa-section-kicker'>
              <ReceiptText className='size-3.5' aria-hidden='true' />
              {t('Savings receipt')}
            </div>
            <h2 className='mt-4 text-3xl font-black tracking-[-0.055em] text-balance md:text-5xl'>
              {t('Plan your yearly savings')}
            </h2>
          </div>
          <p className='text-muted-foreground mt-4 text-base leading-relaxed text-pretty md:text-lg'>
            {t(
              "Pick a workload and adjust your team's usage. The estimate updates instantly."
            )}
          </p>
        </div>

        <div className='mt-9 grid gap-5 lg:grid-cols-[1.12fr_0.88fr] lg:items-start'>
          {hasCalculatorData ? (
            <SavingsCalculator models={calculatorModels} />
          ) : (
            <SavingsUnavailable />
          )}
          {hasComparisonData ? (
            <PriceCompare models={props.models} />
          ) : (
            <PriceDataStatus />
          )}
        </div>
      </div>
    </section>
  )
}

function SavingsUnavailable() {
  const { t } = useTranslation()

  return (
    <article
      className='dopa-paper dopa-cut-corner flex min-h-[32rem] flex-col overflow-hidden'
      data-testid='savings-unavailable'
    >
      <div className='flex flex-1 flex-col justify-between p-6 sm:p-8'>
        <div>
          <div className='bg-chart-4/12 text-chart-4 flex size-14 items-center justify-center rounded-2xl'>
            <Calculator className='size-6' aria-hidden='true' />
          </div>
          <h3 className='mt-6 text-2xl font-black tracking-[-0.04em]'>
            {t('Plan your yearly savings')}
          </h3>
          <p className='text-muted-foreground mt-3 max-w-md text-sm leading-relaxed'>
            {t('Prices update from the live model catalog.')}{' '}
            {t('Refresh the list and try again.')}
          </p>
        </div>

        <div className='border-border bg-muted/40 mt-8 rounded-3xl border p-5'>
          <div className='flex items-center gap-3'>
            <span className='bg-background flex size-10 items-center justify-center rounded-2xl'>
              <RefreshCw className='text-primary size-4' aria-hidden='true' />
            </span>
            <div>
              <div className='text-sm font-extrabold'>{t('Live pricing')}</div>
              <div className='text-muted-foreground mt-0.5 text-xs'>
                {t('Loading...')}
              </div>
            </div>
          </div>
          <div className='mt-5 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10'>
            <div className='dopa-gradient-surface h-full w-2/3 rounded-full' />
          </div>
        </div>

        <Button
          className='dopa-spring group mt-6 h-11 self-start rounded-full px-5 font-bold'
          render={<Link to='/pricing' />}
        >
          {t('Model prices')}
          <ArrowRight className='ml-1.5 size-4 transition-transform group-hover:translate-x-0.5' />
        </Button>
      </div>
    </article>
  )
}

function PriceDataStatus() {
  const { t } = useTranslation()

  return (
    <aside className='dopa-paper flex min-h-72 flex-col justify-between rounded-[1.75rem] p-6 sm:p-7'>
      <div>
        <div className='dopa-section-kicker'>
          {t('Latest model price check')}
        </div>
        <h3 className='mt-5 text-xl font-black tracking-[-0.035em]'>
          {t('Real prices, side by side')}
        </h3>
        <p className='text-muted-foreground mt-3 text-sm leading-relaxed'>
          {t(
            'See what you pay here and what the same usage costs at the official API rate.'
          )}
        </p>
      </div>
      <p className='text-muted-foreground border-border mt-8 border-t pt-4 text-xs leading-relaxed'>
        {t('Prices update from the live model catalog.')}
      </p>
    </aside>
  )
}

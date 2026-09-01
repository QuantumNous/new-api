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
import { Calculator } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SavingsModel } from '../../lib/pricing-savings'
import { PriceCompare } from './price-compare'
import { SavingsCalculator } from './savings-calculator'

interface PriceSavingsProps {
  models: SavingsModel[]
}

export function PriceSavings(props: PriceSavingsProps) {
  const { t } = useTranslation()
  if (props.models.length === 0) return null

  return (
    <section className='relative overflow-hidden px-6 py-20 md:py-28'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-x-0 top-20 -z-10 mx-auto h-96 max-w-5xl rounded-full opacity-50 blur-3xl'
        style={{
          background:
            'linear-gradient(100deg, color-mix(in oklch, var(--chart-4) 16%, transparent), color-mix(in oklch, var(--chart-1) 12%, transparent), color-mix(in oklch, var(--chart-3) 14%, transparent))',
        }}
      />

      <div className='mx-auto max-w-6xl'>
        <div className='mx-auto max-w-2xl text-center'>
          <div className='bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold'>
            <Calculator className='size-3.5' aria-hidden='true' />
            {t('Live pricing')}
          </div>
          <h2 className='mt-5 text-3xl font-extrabold tracking-tight text-balance md:text-5xl'>
            {t('Real prices, side by side')}
          </h2>
          <p className='text-muted-foreground mt-4 text-base leading-relaxed text-pretty md:text-lg'>
            {t(
              'See what you pay here and what the same usage costs at the official API rate.'
            )}
          </p>
        </div>

        <div className='mt-12 grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-start'>
          <PriceCompare models={props.models} />
          <SavingsCalculator models={props.models} />
        </div>
      </div>
    </section>
  )
}

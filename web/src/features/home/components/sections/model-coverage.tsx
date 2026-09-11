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
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

import { useLandingModels } from '../../hooks/use-landing-models'

export function ModelCoverage() {
  const { t } = useTranslation()
  const config = useLandingModels()

  return (
    <section className='relative z-10 px-6 py-24 sm:px-10 md:py-32 lg:px-14'>
      <div className='mx-auto max-w-7xl'>
        <AnimateInView className='mb-16 max-w-2xl md:mb-20'>
          <p className='text-primary mb-5 font-mono text-[11px] tracking-[0.28em] uppercase'>
            02 / {t('Model coverage')}
          </p>
          <h2 className='text-foreground font-serif text-4xl leading-[1.05] font-medium tracking-[-0.02em] md:text-5xl'>
            {t('Routing does not choose for you,')}
            <br />
            {t('it leaves the choice with you.')}
          </h2>
          <p className='text-muted-foreground mt-6 max-w-xl text-base leading-7'>
            {t(
              'Use the speed, price, and capability mix that best fits the work.'
            )}
          </p>
        </AnimateInView>

        <div className='border-border/60 divide-border/60 divide-y overflow-hidden rounded-2xl border'>
          <div className='text-muted-foreground/80 hidden grid-cols-[5rem_1fr_1fr] gap-4 px-7 py-3 font-mono text-[10px] tracking-[0.2em] uppercase sm:grid'>
            <span>{t('Model families')}</span>
            <span>{t('What it does')}</span>
            <span>{t('Route type')}</span>
          </div>
          {config.coverage.map((row, i) => (
            <AnimateInView
              key={row.family}
              delay={i * 40}
              animation='fade-up'
              className='hover:bg-card/50 grid grid-cols-[3.5rem_1fr] gap-4 px-7 py-5 transition-colors duration-200 sm:grid-cols-[5rem_1fr_1fr] sm:items-center'
            >
              <div className='flex items-center gap-3'>
                <span className='bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg font-mono text-sm font-semibold'>
                  {row.mark}
                </span>
              </div>
              <div>
                <div className='text-foreground font-serif text-lg font-medium'>
                  {row.family}
                </div>
                <div className='text-muted-foreground mt-0.5 text-sm'>
                  {t(row.description)}
                </div>
              </div>
              <div className='text-muted-foreground col-span-2 text-sm sm:col-span-1 sm:text-right'>
                {t(row.routeType)}
              </div>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}

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
import { ArrowRight, Calculator, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { YecaiAction } from '@/components/yecai'

import { HeroMarketStage } from '../hero-market-stage'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
  maxSavingsPercent?: number
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()

  return (
    <section className='dopa-home-hero'>
      <div className='dopa-home-hero__world' data-section='START'>
        <div className='dopa-home-hero__copy flex flex-col items-start text-left lg:col-span-6'>
          <div className='dopa-fade-up dopa-section-kicker'>
            <Sparkles className='size-3.5' />
            {t('Leave expensive monthly fees behind · Ready in 1 minute')}
          </div>

          <h1 className='dopa-fade-up dopa-delay-1 mt-6 max-w-3xl text-[clamp(2.65rem,6.2vw,5.5rem)] leading-[0.96] font-black tracking-[-0.075em] text-balance'>
            {t("Bring top-tier AI into everyone's daily life")}
          </h1>

          <p className='dopa-fade-up dopa-delay-2 text-muted-foreground mt-6 max-w-xl text-base leading-relaxed text-pretty md:text-lg'>
            {t(
              "No complicated setup and no expensive subscription barrier. Configure once, pay only as you go, and put the latest productivity within everyone's reach."
            )}
          </p>

          <div className='dopa-fade-up dopa-delay-3 mt-9 flex flex-wrap items-center gap-3'>
            <YecaiAction
              tone='leaf'
              size='lg'
              className='dopa-shine group'
              render={<a href='#savings-calculator' />}
            >
              <Calculator className='mr-1.5 size-4' />
              {t('Plan your yearly savings')}
              <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
            </YecaiAction>
            {props.isAuthenticated ? (
              <YecaiAction
                appearance='outline'
                tone='model'
                size='lg'
                className='group'
                render={<Link to='/dashboard' />}
              >
                {t('Go to Dashboard')}
                <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
              </YecaiAction>
            ) : (
              <YecaiAction
                appearance='outline'
                tone='model'
                size='lg'
                className='group'
                render={<Link to='/sign-up' />}
              >
                {t('Start for free')}
                <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
              </YecaiAction>
            )}
          </div>
        </div>

        <HeroMarketStage maxSavingsPercent={props.maxSavingsPercent} />
      </div>

      <div className='dopa-home-hero__ticker' aria-hidden='true'>
        <span>MODEL</span>
        <i />
        <span>TOKEN</span>
        <i />
        <span>PRICE</span>
        <i />
        <span>API</span>
      </div>
    </section>
  )
}

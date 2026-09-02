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
import {
  ArrowRight,
  Calculator,
  Check,
  ReceiptText,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { YecaiAction, YecaiPanel, YecaiPriceFlow } from '@/components/yecai'
import { DEFAULT_SYSTEM_NAME } from '@/lib/constants'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
  maxSavingsPercent?: number
}

/** A price-flow receipt built only from live pricing. */
function HeroSavingsFlow(props: { maxSavingsPercent?: number }) {
  const { t } = useTranslation()
  const hasSavings =
    props.maxSavingsPercent != null && props.maxSavingsPercent > 0

  return (
    <div className='relative w-full max-w-[31rem]'>
      <div
        aria-hidden
        className='dopa-glow-pulse absolute -inset-8 -z-10 rounded-[3rem] opacity-60 blur-3xl'
        style={{
          background:
            'radial-gradient(ellipse 60% 55% at 30% 30%, color-mix(in oklch, var(--chart-1) 32%, transparent), transparent 70%), radial-gradient(ellipse 55% 50% at 75% 65%, color-mix(in oklch, var(--chart-3) 26%, transparent), transparent 70%)',
        }}
      />

      <YecaiPanel
        as='aside'
        tone='model'
        layer='hero'
        className='dopa-token-grid overflow-hidden p-5 sm:p-6'
      >
        <div className='relative z-10 flex items-center justify-between gap-4'>
          <div>
            <div className='text-muted-foreground flex items-center gap-2 text-[10px] font-black tracking-[0.16em] uppercase'>
              <ReceiptText className='size-3.5' aria-hidden='true' />
              {t('Savings receipt')}
            </div>
            <div className='mt-1 text-lg font-black'>{DEFAULT_SYSTEM_NAME}</div>
          </div>
          <span className='bg-success/10 text-success inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold'>
            <span className='bg-success size-1.5 rounded-full' />
            {t('Live pricing')}
          </span>
        </div>

        <YecaiPriceFlow
          accessibleLabel={t('Official API estimate')}
          className='relative z-10 mt-9'
          officialLabel={t('Official API')}
          officialValue={t('Official API estimate')}
          siteLabel={t('Our price')}
          siteValue={t('Live pricing')}
          savingsLabel={t('Estimated savings')}
          savingsValue={
            hasSavings ? (
              <span
                key={props.maxSavingsPercent}
                className='dopa-number-change inline-block'
              >
                -{props.maxSavingsPercent}%
              </span>
            ) : (
              t('Loading...')
            )
          }
          size='hero'
        />

        <YecaiAction
          appearance='soft'
          tone='leaf'
          size='sm'
          className='relative z-10 mt-5 w-full justify-start'
          render={<a href='#savings-calculator' />}
        >
          <Calculator className='text-primary size-4 shrink-0' />
          <span className='text-xs font-bold'>
            {hasSavings
              ? t('Save {{percent}}%', {
                  percent: props.maxSavingsPercent,
                })
              : t('Prices update from the live model catalog.')}
          </span>
          <ArrowRight className='text-muted-foreground ml-auto size-4' />
        </YecaiAction>
      </YecaiPanel>
    </div>
  )
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 overflow-hidden px-6 pt-28 pb-12 md:pt-36 md:pb-18'>
      {/* Soft candy background blobs */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10'
        style={{
          background: [
            'radial-gradient(ellipse 55% 45% at 12% 18%, color-mix(in oklch, var(--chart-1) 14%, transparent) 0%, transparent 70%)',
            'radial-gradient(ellipse 45% 40% at 88% 12%, color-mix(in oklch, var(--chart-3) 12%, transparent) 0%, transparent 70%)',
            'radial-gradient(ellipse 40% 38% at 70% 85%, color-mix(in oklch, var(--chart-2) 10%, transparent) 0%, transparent 70%)',
          ].join(', '),
        }}
      />

      <div
        className='dopa-section-shell grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-10'
        data-section='START'
      >
        {/* Left column */}
        <div className='flex flex-col items-start text-left lg:col-span-7'>
          <div className='dopa-fade-up dopa-section-kicker'>
            <Sparkles className='size-3.5' />
            {t('Leave expensive monthly fees behind · Ready in 1 minute')}
          </div>

          <h1 className='dopa-fade-up dopa-delay-1 mt-6 max-w-3xl text-[clamp(2.65rem,6.2vw,5.15rem)] leading-[0.98] font-black tracking-[-0.075em] text-balance'>
            {t("Bring top-tier AI into everyone's daily life")}
            <span className='dopa-gradient-text mt-4 block text-[0.72em] leading-[1.08] tracking-[-0.055em]'>
              {props.maxSavingsPercent && props.maxSavingsPercent > 0
                ? t('The same powerful experience, {{percent}}% less', {
                    percent: props.maxSavingsPercent,
                  })
                : t(
                    'The same powerful experience, without the high monthly cost'
                  )}
            </span>
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

          {/* Reassurance row */}
          <div className='dopa-fade-up dopa-delay-4 text-muted-foreground mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm'>
            <span className='inline-flex items-center gap-1.5'>
              <Check className='text-success size-4' />
              {t('True pay-as-you-go: pay only for what you use')}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <Check className='text-success size-4' />
              {t('Fully compatible with 30+ popular everyday tools')}
            </span>
          </div>
        </div>

        {/* Right column */}
        <div className='dopa-fade-up dopa-delay-3 flex w-full justify-center lg:col-span-5'>
          <HeroSavingsFlow maxSavingsPercent={props.maxSavingsPercent} />
        </div>
      </div>
    </section>
  )
}

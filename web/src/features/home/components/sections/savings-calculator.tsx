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
import { Bot, Code2, Headphones, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Slider } from '@/components/ui/slider'
import { formatCurrencyFromUSD } from '@/lib/currency'
import { cn } from '@/lib/utils'

import {
  calculateSavingsEstimate,
  DEFAULT_MONTHLY_TOKENS_MILLIONS,
  tokenMillionsToSliderPosition,
  tokenSliderPositionToMillions,
  TOKEN_SLIDER_MAX_MILLIONS,
  TOKEN_SLIDER_MIN_MILLIONS,
  TOKEN_SLIDER_STEPS,
  type SavingsModel,
  type SavingsUseCase,
} from '../../lib/pricing-savings'

interface SavingsCalculatorProps {
  models: SavingsModel[]
}

const useCaseOptions: Array<{
  id: SavingsUseCase
  icon: typeof Code2
}> = [
  { id: 'coding', icon: Code2 },
  { id: 'agents', icon: Bot },
  { id: 'support', icon: Headphones },
  { id: 'research', icon: Search },
]

const totalFormatOptions = {
  digitsLarge: 0,
  digitsSmall: 2,
  abbreviate: false,
  compact: true,
}

export function SavingsCalculator(props: SavingsCalculatorProps) {
  const { t } = useTranslation()
  const [useCase, setUseCase] = useState<SavingsUseCase>('coding')
  const [tokenSliderPosition, setTokenSliderPosition] = useState(() =>
    tokenMillionsToSliderPosition(DEFAULT_MONTHLY_TOKENS_MILLIONS)
  )
  const [people, setPeople] = useState(20)
  const monthlyTokensMillions =
    tokenSliderPositionToMillions(tokenSliderPosition)
  const estimate = useMemo(
    () =>
      calculateSavingsEstimate(
        props.models,
        useCase,
        monthlyTokensMillions,
        people
      ),
    [monthlyTokensMillions, people, props.models, useCase]
  )
  const useCaseLabels: Record<SavingsUseCase, string> = {
    coding: t('AI coding'),
    agents: t('Agent workflows'),
    support: t('Customer support and operations'),
    research: t('Research and content'),
  }

  return (
    <article className='border-border bg-card dopa-candy-shadow flex flex-col overflow-hidden rounded-3xl border'>
      <div className='border-border border-b px-5 py-5 sm:px-7'>
        <h3 className='text-lg font-extrabold'>
          {t('Plan your yearly savings')}
        </h3>
        <p className='text-muted-foreground mt-1 text-xs leading-relaxed'>
          {t(
            "Pick a workload and adjust your team's usage. The estimate updates instantly."
          )}
        </p>
      </div>

      <div className='flex flex-1 flex-col px-5 py-6 sm:px-7'>
        <fieldset>
          <legend className='mb-3 text-xs font-bold'>{t('Use case')}</legend>
          <div
            className='grid grid-cols-2 gap-2'
            role='radiogroup'
            aria-label={t('Use case')}
          >
            {useCaseOptions.map((option) => {
              const Icon = option.icon
              const selected = useCase === option.id
              return (
                <button
                  key={option.id}
                  type='button'
                  role='radio'
                  aria-checked={selected}
                  onClick={() => setUseCase(option.id)}
                  className={cn(
                    'focus-visible:ring-ring flex min-h-16 items-center gap-2.5 rounded-2xl border px-3 text-left text-xs font-bold transition-[background-color,border-color,color,transform] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98]',
                    selected
                      ? 'border-primary/45 bg-primary/10 text-primary'
                      : 'border-border bg-background hover:bg-muted/60'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-xl',
                      selected ? 'bg-primary/15' : 'bg-muted'
                    )}
                  >
                    <Icon className='size-4' aria-hidden='true' />
                  </span>
                  {useCaseLabels[option.id]}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className='mt-7 space-y-7'>
          <div>
            <div className='mb-3 flex items-center justify-between gap-4'>
              <label
                htmlFor='monthly-token-slider'
                className='text-xs font-bold'
              >
                {t('Monthly tokens')}
              </label>
              <output className='bg-chart-4/15 text-foreground rounded-full px-3 py-1 font-mono text-xs font-bold tabular-nums'>
                {t('{{count}}M tokens', { count: monthlyTokensMillions })}
              </output>
            </div>
            <Slider
              id='monthly-token-slider'
              min={0}
              max={TOKEN_SLIDER_STEPS}
              step={1}
              value={[tokenSliderPosition]}
              getAriaLabel={() => t('Monthly tokens')}
              getAriaValueText={(_, value) =>
                t('{{count}}M tokens', {
                  count: tokenSliderPositionToMillions(value),
                })
              }
              onValueChange={(value) => {
                const nextValue = Array.isArray(value) ? value[0] : value
                setTokenSliderPosition(nextValue)
              }}
            />
            <div className='text-muted-foreground mt-2 flex justify-between font-mono text-[10px]'>
              <span>{TOKEN_SLIDER_MIN_MILLIONS}M</span>
              <span>{TOKEN_SLIDER_MAX_MILLIONS}M</span>
            </div>
          </div>

          <div>
            <div className='mb-3 flex items-center justify-between gap-4'>
              <label htmlFor='people-slider' className='text-xs font-bold'>
                {t('People')}
              </label>
              <output className='bg-chart-3/15 text-foreground rounded-full px-3 py-1 font-mono text-xs font-bold tabular-nums'>
                {t('{{count}} people', { count: people })}
              </output>
            </div>
            <Slider
              id='people-slider'
              min={1}
              max={100}
              step={1}
              value={[people]}
              getAriaLabel={() => t('People')}
              getAriaValueText={(_, value) =>
                t('{{count}} people', { count: value })
              }
              onValueChange={(value) => {
                const nextValue = Array.isArray(value) ? value[0] : value
                setPeople(nextValue)
              }}
            />
            <div className='text-muted-foreground mt-2 flex justify-between font-mono text-[10px]'>
              <span>1</span>
              <span>100</span>
            </div>
          </div>
        </div>

        <div className='dopa-gradient-surface relative mt-7 overflow-hidden rounded-3xl p-[1px]'>
          <div className='bg-card/95 rounded-[calc(1.5rem-1px)] px-5 py-5'>
            <div className='text-muted-foreground text-xs font-semibold'>
              {t('Estimated savings in one year')}
            </div>
            <div
              aria-live='polite'
              className='dopa-gradient-text mt-1 font-mono text-[clamp(2rem,6vw,3.2rem)] leading-none font-black tracking-tight tabular-nums'
            >
              {formatCurrencyFromUSD(
                estimate.annualSavings,
                totalFormatOptions
              )}
            </div>

            <div className='border-border mt-5 grid grid-cols-2 gap-4 border-t pt-4'>
              <div>
                <div className='text-muted-foreground text-[10px] font-semibold tracking-wide uppercase'>
                  {t('Official API estimate')}
                </div>
                <div className='mt-1 font-mono text-sm font-bold tabular-nums'>
                  {formatCurrencyFromUSD(
                    estimate.officialMonthlyCost,
                    totalFormatOptions
                  )}
                </div>
              </div>
              <div>
                <div className='text-muted-foreground text-[10px] font-semibold tracking-wide uppercase'>
                  {t('Your estimated cost')}
                </div>
                <div className='text-primary mt-1 font-mono text-sm font-bold tabular-nums'>
                  {formatCurrencyFromUSD(
                    estimate.siteMonthlyCost,
                    totalFormatOptions
                  )}
                </div>
              </div>
            </div>

            <div className='bg-success/10 text-success mt-4 rounded-2xl px-3 py-2 text-xs font-bold'>
              {t('Save {{amount}} per month', {
                amount: formatCurrencyFromUSD(
                  estimate.monthlySavings,
                  totalFormatOptions
                ),
              })}
            </div>
          </div>
        </div>

        <p className='text-muted-foreground mt-4 text-[11px] leading-relaxed'>
          {t('Representative models: {{models}}', {
            models: estimate.representativeModels
              .map((model) => model.modelName)
              .join(' + '),
          })}{' '}
          {t('The estimate uses live pricing and is for reference only.')}
        </p>
      </div>
    </article>
  )
}

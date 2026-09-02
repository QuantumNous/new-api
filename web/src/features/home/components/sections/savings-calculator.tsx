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

import { Combobox } from '@/components/ui/combobox'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

import {
  calculateSavingsEstimate,
  DEFAULT_MONTHLY_TOKENS_MILLIONS,
  formatCnyAmount,
  formatTokenMillions,
  getBillableSavingsTokenMix,
  getDefaultSavingsTokenMix,
  tokenMillionsToSliderPosition,
  tokenSliderPositionToMillions,
  TOKEN_SLIDER_MAX_MILLIONS,
  TOKEN_SLIDER_MIN_MILLIONS,
  TOKEN_SLIDER_STEPS,
  type SavingsModel,
  type SavingsTokenMix,
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
  compact: true,
}

export function SavingsCalculator(props: SavingsCalculatorProps) {
  const { i18n, t } = useTranslation()
  const [useCase, setUseCase] = useState<SavingsUseCase>('coding')
  const [tokenSliderPosition, setTokenSliderPosition] = useState(() =>
    tokenMillionsToSliderPosition(DEFAULT_MONTHLY_TOKENS_MILLIONS)
  )
  const [people, setPeople] = useState(20)
  const [tokenMix, setTokenMix] = useState<SavingsTokenMix>(() =>
    getDefaultSavingsTokenMix('coding')
  )
  const [selectedModelName, setSelectedModelName] = useState(
    () => props.models[0]?.modelName ?? ''
  )
  const monthlyTokensMillions =
    tokenSliderPositionToMillions(tokenSliderPosition)
  const selectedModel =
    props.models.find((model) => model.modelName === selectedModelName) ??
    props.models[0]
  const billableTokenMix = getBillableSavingsTokenMix(tokenMix, selectedModel)
  const supportsCachePricing =
    selectedModel?.siteCacheReadPrice != null ||
    selectedModel?.siteCacheWritePrice != null
  const modelOptions = useMemo(
    () =>
      props.models.map((model) => ({
        value: model.modelName,
        label: `${model.modelName} · ${model.vendorName}`,
      })),
    [props.models]
  )
  const formatTokenUsage = (millions: number) =>
    t('{{count}} tokens', {
      count: formatTokenMillions(
        millions,
        i18n.resolvedLanguage || i18n.language
      ),
    })
  const estimate = useMemo(
    () =>
      calculateSavingsEstimate(
        selectedModel ? [selectedModel] : [],
        useCase,
        monthlyTokensMillions,
        people,
        tokenMix
      ),
    [monthlyTokensMillions, people, selectedModel, tokenMix, useCase]
  )
  const useCaseLabels: Record<SavingsUseCase, string> = {
    coding: t('AI coding'),
    agents: t('Agent workflows'),
    support: t('Customer support and operations'),
    research: t('Research and content'),
  }
  const tokenMixItems = [
    {
      label: t('Regular input'),
      value: billableTokenMix.inputPercent,
      className: 'bg-chart-4/12',
    },
    {
      label: t('Cache Read'),
      value: billableTokenMix.cacheReadPercent,
      className: 'bg-success/12',
    },
    {
      label: t('Cache Write'),
      value: billableTokenMix.cacheWritePercent,
      className: 'bg-chart-3/12',
    },
    {
      label: t('Output'),
      value: billableTokenMix.outputPercent,
      className: 'bg-chart-1/12',
    },
  ]
  const updateTokenMix = (
    key: 'cacheReadPercent' | 'cacheWritePercent' | 'outputPercent',
    value: number
  ) => {
    setTokenMix((current) => {
      const next = getBillableSavingsTokenMix(current, selectedModel)
      const otherPercent =
        next.cacheReadPercent +
        next.cacheWritePercent +
        next.outputPercent -
        next[key]
      next[key] = Math.min(Math.max(Math.round(value), 0), 100 - otherPercent)
      next.inputPercent =
        100 -
        next.cacheReadPercent -
        next.cacheWritePercent -
        next.outputPercent
      return next
    })
  }

  return (
    <article className='dopa-paper dopa-cut-corner flex flex-col overflow-hidden'>
      <div className='px-5 pt-6 pb-3 sm:px-7'>
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
        <div>
          <label htmlFor='savings-model-picker' className='text-xs font-bold'>
            {t('Model')}
          </label>
          <Combobox
            id='savings-model-picker'
            options={modelOptions}
            value={selectedModel?.modelName ?? ''}
            onValueChange={(value) => setSelectedModelName(value ?? '')}
            placeholder={t('Search models...')}
            emptyText={t('No models found')}
            className='bg-background mt-3 h-11 rounded-xl font-mono text-xs font-semibold'
          />
          {selectedModel && (
            <div className='bg-muted/45 mt-3 rounded-2xl px-3 py-3'>
              <div className='text-muted-foreground flex flex-wrap items-center gap-x-2 text-[10px]'>
                <span className='text-foreground font-bold'>
                  {selectedModel.vendorName}
                </span>
                <span aria-hidden='true'>·</span>
                <span>{t('Our price')}</span>
                <span aria-hidden='true'>·</span>
                <span>{t('CNY / 1 million tokens')}</span>
              </div>
              <div className='mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4'>
                <CalculatorPrice
                  label={t('Input')}
                  price={selectedModel.siteInputPrice}
                />
                {selectedModel.siteCacheReadPrice != null && (
                  <CalculatorPrice
                    label={t('Cache Read')}
                    price={selectedModel.siteCacheReadPrice}
                  />
                )}
                {selectedModel.siteCacheWritePrice != null && (
                  <CalculatorPrice
                    label={t('Cache Write')}
                    price={selectedModel.siteCacheWritePrice}
                  />
                )}
                <CalculatorPrice
                  label={t('Output')}
                  price={selectedModel.siteOutputPrice}
                />
              </div>
            </div>
          )}
        </div>

        <fieldset className='mt-6'>
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
                  onClick={() => {
                    setUseCase(option.id)
                    setTokenMix(getDefaultSavingsTokenMix(option.id))
                  }}
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

        <div className='border-border bg-background mt-5 rounded-2xl border px-3 py-3'>
          <div className='flex items-start justify-between gap-3'>
            <div>
              <div className='text-xs font-bold'>{t('Token mix')}</div>
              <p className='text-muted-foreground mt-0.5 text-[10px] leading-relaxed'>
                {supportsCachePricing
                  ? t(
                      'Scenario preset. Adjust it to match your actual usage; cache tokens are priced separately.'
                    )
                  : t(
                      'This model has no separate cache price; cache tokens are estimated as regular input.'
                    )}
              </p>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-1 text-[10px] font-bold',
                supportsCachePricing
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {supportsCachePricing
                ? t('Cache included')
                : t('No separate cache price')}
            </span>
          </div>

          <div className='mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4'>
            {tokenMixItems.map((item) => (
              <div
                key={item.label}
                className={cn('rounded-xl px-2.5 py-2', item.className)}
              >
                <div className='text-muted-foreground text-[9px] font-semibold'>
                  {item.label}
                </div>
                <div className='mt-0.5 font-mono text-xs font-black tabular-nums'>
                  {Math.round(item.value)}%
                </div>
              </div>
            ))}
          </div>

          <details className='group mt-3'>
            <summary className='text-primary cursor-pointer list-none text-[11px] font-bold select-none'>
              {t('Adjust token mix')}
            </summary>
            <div className='mt-4 space-y-5'>
              {selectedModel?.siteCacheReadPrice != null && (
                <TokenMixSlider
                  id='cache-read-percent-slider'
                  label={t('Cache Read')}
                  value={billableTokenMix.cacheReadPercent}
                  max={
                    100 -
                    billableTokenMix.cacheWritePercent -
                    billableTokenMix.outputPercent
                  }
                  onChange={(value) =>
                    updateTokenMix('cacheReadPercent', value)
                  }
                />
              )}
              {selectedModel?.siteCacheWritePrice != null && (
                <TokenMixSlider
                  id='cache-write-percent-slider'
                  label={t('Cache Write')}
                  value={billableTokenMix.cacheWritePercent}
                  max={
                    100 -
                    billableTokenMix.cacheReadPercent -
                    billableTokenMix.outputPercent
                  }
                  onChange={(value) =>
                    updateTokenMix('cacheWritePercent', value)
                  }
                />
              )}
              <TokenMixSlider
                id='output-percent-slider'
                label={t('Output')}
                value={billableTokenMix.outputPercent}
                max={
                  100 -
                  billableTokenMix.cacheReadPercent -
                  billableTokenMix.cacheWritePercent
                }
                onChange={(value) => updateTokenMix('outputPercent', value)}
              />
            </div>
          </details>
        </div>

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
                {formatTokenUsage(monthlyTokensMillions)}
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
                formatTokenUsage(tokenSliderPositionToMillions(value))
              }
              onValueChange={(value) => {
                const nextValue = Array.isArray(value) ? value[0] : value
                setTokenSliderPosition(nextValue)
              }}
            />
            <div className='text-muted-foreground mt-2 flex justify-between font-mono text-[10px]'>
              <span>{formatTokenUsage(TOKEN_SLIDER_MIN_MILLIONS)}</span>
              <span>{formatTokenUsage(TOKEN_SLIDER_MAX_MILLIONS)}</span>
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

        <div className='dopa-savings-result dopa-token-grid relative mt-7 overflow-hidden'>
          <div className='relative z-10 flex items-center justify-between gap-3'>
            <span className='text-muted-foreground text-[10px] font-black tracking-[0.13em] uppercase'>
              {t('Live pricing')}
            </span>
            <span className='bg-success/10 text-success inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold'>
              <span className='bg-success size-1.5 rounded-full' />
              {t('Updates automatically')}
            </span>
          </div>

          <div className='dopa-calculator-price-flow relative z-10 mt-4'>
            <div className='dopa-flow-value' data-tone='official'>
              <span>{t('Official API estimate')}</span>
              <strong className='line-through decoration-1'>
                {formatCnyAmount(estimate.officialMonthlyCost, {
                  compact: totalFormatOptions.compact,
                  maximumFractionDigits: totalFormatOptions.digitsLarge,
                })}
              </strong>
            </div>

            <div className='dopa-price-beam' aria-hidden='true'>
              <span />
            </div>

            <div className='dopa-flow-value' data-tone='yecai'>
              <span>{t('Your estimated cost')}</span>
              <strong>
                {formatCnyAmount(estimate.siteMonthlyCost, {
                  compact: totalFormatOptions.compact,
                  maximumFractionDigits: totalFormatOptions.digitsLarge,
                })}
              </strong>
            </div>
          </div>

          <div className='dopa-savings-total relative z-10 mt-5'>
            <div className='text-muted-foreground text-xs font-semibold'>
              {t('Estimated savings in one year')}
            </div>
            <div
              aria-live='polite'
              data-testid='annual-savings'
              className='dopa-gradient-text mt-1 font-mono text-[clamp(2.25rem,6vw,3.5rem)] leading-none font-black tracking-tight tabular-nums'
            >
              <span
                key={estimate.annualSavings}
                className='dopa-number-change inline-block'
              >
                {formatCnyAmount(estimate.annualSavings, {
                  compact: totalFormatOptions.compact,
                  maximumFractionDigits: totalFormatOptions.digitsLarge,
                })}
              </span>
            </div>
            <div className='text-success mt-3 text-xs font-bold'>
              {t('Save {{amount}} per month', {
                amount: formatCnyAmount(estimate.monthlySavings, {
                  compact: totalFormatOptions.compact,
                  maximumFractionDigits: totalFormatOptions.digitsLarge,
                }),
              })}
            </div>
          </div>
        </div>

        <p className='text-muted-foreground mt-4 text-[11px] leading-relaxed'>
          {t('Model')}: {selectedModel?.modelName ?? ''}.{' '}
          {t('The estimate uses live pricing and is for reference only.')}
        </p>
      </div>
    </article>
  )
}

function CalculatorPrice(props: { label: string; price: number }) {
  return (
    <div>
      <div className='text-muted-foreground text-[9px] font-semibold'>
        {props.label}
      </div>
      <div className='mt-0.5 font-mono text-[11px] font-black tabular-nums'>
        {formatCnyAmount(props.price)}
      </div>
    </div>
  )
}

function TokenMixSlider(props: {
  id: string
  label: string
  value: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div>
      <div className='mb-2 flex items-center justify-between gap-3'>
        <label htmlFor={props.id} className='text-[10px] font-semibold'>
          {props.label}
        </label>
        <output className='font-mono text-[10px] font-black tabular-nums'>
          {Math.round(props.value)}%
        </output>
      </div>
      <Slider
        id={props.id}
        min={0}
        max={Math.max(props.max, 0)}
        step={5}
        value={[props.value]}
        getAriaLabel={() => props.label}
        getAriaValueText={(_, value) => `${Math.round(value)}%`}
        onValueChange={(value) => {
          const nextValue = Array.isArray(value) ? value[0] : value
          props.onChange(nextValue)
        }}
      />
    </div>
  )
}

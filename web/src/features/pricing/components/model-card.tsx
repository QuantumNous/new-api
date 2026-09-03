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
import { ChevronRight, Copy } from 'lucide-react'
import { memo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { YecaiAction, YecaiPanel } from '@/components/yecai'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import {
  getCardExamplePrice,
  getDynamicDisplayGroupRatio,
  getDynamicPriceUnitLabelKey,
  getDynamicPricingSummary,
  isUnconfiguredTaskUsageModel,
} from '../lib/dynamic-price'
import { parseTags } from '../lib/filters'
import { isTokenBasedModel } from '../lib/model-helpers'
import { formatPrice, formatRequestPrice } from '../lib/price'
import { getTaskNumberFields } from '../lib/task-expr'
import type { PricingModel, TokenUnit } from '../types'
import { ModelBillingModeBadge } from './model-billing-mode-badge'
import { ModelPerfBadge, type ModelPerfBadgeData } from './model-perf-badge'

export interface ModelCardProps {
  model: PricingModel
  onClick: () => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
  perf?: ModelPerfBadgeData
}

const priceRowClassName =
  'text-muted-foreground flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 [overflow-wrap:anywhere]'

export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t } = useTranslation()
  const { copyToClipboard } = useCopyToClipboard()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const showRechargePrice = props.showRechargePrice ?? false
  const isTokenBased = isTokenBasedModel(props.model)
  const tokenUnitLabel = tokenUnit === 'K' ? '1K' : '1M'
  const tags = parseTags(props.model.tags)
  const groups = props.model.enable_groups || []
  const endpoints = props.model.supported_endpoint_types || []
  const modelIconKey = props.model.icon || props.model.vendor_icon
  const modelIcon = modelIconKey ? getLobeIcon(modelIconKey, 28) : null
  const initial = props.model.model_name?.charAt(0).toUpperCase() || '?'
  const isDynamicPricing =
    props.model.billing_mode === 'tiered_expr' &&
    Boolean(props.model.billing_expr)
  const isUnconfiguredTaskUsage = isUnconfiguredTaskUsageModel(props.model)
  const hasCachedPrice = isTokenBased && props.model.cache_ratio != null
  const dynamicPriceOptions = {
    tokenUnit,
    showRechargePrice,
    priceRate,
    usdExchangeRate,
    groupRatioMultiplier: getDynamicDisplayGroupRatio(
      props.model,
      props.selectedGroup
    ),
  }
  const dynamicSummary = isDynamicPricing
    ? getDynamicPricingSummary(props.model, dynamicPriceOptions)
    : null
  const cardExamplePrice = getCardExamplePrice(props.model, dynamicPriceOptions)
  const showTaskFieldLabels =
    getTaskNumberFields(props.model.billing_usage_schema).length > 1

  const primaryGroup = groups[0]
  const bottomTags = [...endpoints.slice(0, 2), ...tags.slice(0, 2)]
  const hiddenCount =
    Math.max(groups.length - 1, 0) +
    Math.max(endpoints.length - 2, 0) +
    Math.max(tags.length - 2, 0)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    copyToClipboard(props.model.model_name || '')
  }

  let priceSummary: ReactNode
  if (dynamicSummary) {
    if (dynamicSummary.isSpecialExpression) {
      priceSummary = (
        <span className='min-w-0'>
          <span className='text-amber-700 dark:text-amber-300'>
            {t('Special billing expression')}
          </span>
          <code className='text-muted-foreground/70 mt-0.5 line-clamp-1 block font-mono text-[11px] break-all'>
            {dynamicSummary.rawExpression}
          </code>
        </span>
      )
    } else if (dynamicSummary.primaryEntries.length > 0) {
      priceSummary = (
        <>
          {dynamicSummary.primaryEntries.map((entry) => {
            const unitLabelKey = getDynamicPriceUnitLabelKey(entry)
            let fieldPrefix: ReactNode = null
            if (entry.labelKind !== 'schema') {
              fieldPrefix = <>{t(entry.shortLabel)} </>
            } else if (showTaskFieldLabels) {
              fieldPrefix = (
                <>
                  <code className='font-mono text-[11px]'>
                    {entry.shortLabel}
                  </code>{' '}
                </>
              )
            }
            return (
              <span key={entry.key} className={priceRowClassName}>
                {fieldPrefix}
                <span className='text-foreground font-mono font-semibold'>
                  {entry.formattedRange ?? entry.formatted}
                  {unitLabelKey && <>/{t(unitLabelKey)}</>}
                </span>
              </span>
            )
          })}
          {cardExamplePrice && (
            <span className='text-muted-foreground max-w-full min-w-0 text-xs [overflow-wrap:anywhere]'>
              {cardExamplePrice.label} ≈ {cardExamplePrice.formatted}
            </span>
          )}
          {dynamicSummary.isTaskUsage &&
            dynamicSummary.tier?.label &&
            !dynamicSummary.primaryEntries.some(
              (entry) => entry.formattedRange
            ) && (
              <span className='text-muted-foreground text-xs'>
                ({dynamicSummary.tier.label})
              </span>
            )}
        </>
      )
    } else {
      priceSummary = (
        <span className='text-muted-foreground text-sm'>
          {t('Dynamic Pricing')}
        </span>
      )
    }
  } else if (isUnconfiguredTaskUsage) {
    priceSummary = (
      <span className='text-muted-foreground text-sm'>
        {t('Usage-based billing · price not configured')}
      </span>
    )
  } else if (isTokenBased) {
    priceSummary = (
      <>
        <span className={priceRowClassName}>
          {t('Input')}{' '}
          <span className='text-foreground font-mono font-semibold'>
            {formatPrice(
              props.model,
              'input',
              tokenUnit,
              showRechargePrice,
              priceRate,
              usdExchangeRate,
              props.selectedGroup
            )}
          </span>
        </span>
        <span className={priceRowClassName}>
          {t('Output')}{' '}
          <span className='text-foreground font-mono font-semibold'>
            {formatPrice(
              props.model,
              'output',
              tokenUnit,
              showRechargePrice,
              priceRate,
              usdExchangeRate,
              props.selectedGroup
            )}
          </span>
        </span>
        {hasCachedPrice && (
          <span className={priceRowClassName}>
            {t('Cached')}{' '}
            <span className='text-foreground font-mono font-semibold'>
              {formatPrice(
                props.model,
                'cache',
                tokenUnit,
                showRechargePrice,
                priceRate,
                usdExchangeRate,
                props.selectedGroup
              )}
            </span>
          </span>
        )}
      </>
    )
  } else {
    priceSummary = (
      <span className='text-muted-foreground [overflow-wrap:anywhere]'>
        <span className='text-foreground font-mono font-semibold'>
          {formatRequestPrice(
            props.model,
            showRechargePrice,
            priceRate,
            usdExchangeRate,
            props.selectedGroup
          )}
        </span>{' '}
        / {t('request')}
      </span>
    )
  }

  return (
    <YecaiPanel
      as='article'
      tone='model'
      layer='raised'
      className={cn(
        'dopa-model-tile dopa-scale-texture group relative flex min-w-0 flex-col gap-4 overflow-hidden rounded-3xl border p-4 transition-colors sm:p-5',
        'hover:bg-muted/20'
      )}
    >
      <header className='flex min-w-0 items-start gap-3'>
        <div className='bg-muted/40 flex size-10 shrink-0 items-center justify-center rounded-xl'>
          {modelIcon || (
            <span className='text-muted-foreground text-sm font-bold'>
              {initial}
            </span>
          )}
        </div>
        <h3 className='text-foreground min-w-0 flex-1 pt-1 font-mono text-[15px] leading-relaxed font-bold [overflow-wrap:anywhere]'>
          {props.model.model_name}
        </h3>
      </header>

      <p className='text-muted-foreground line-clamp-2 text-[13px] leading-relaxed [overflow-wrap:anywhere]'>
        {props.model.description || t('No description available.')}
      </p>

      <div className='bg-muted/30 flex min-w-0 flex-col gap-1.5 rounded-2xl p-3 text-sm'>
        {priceSummary}
      </div>

      <div data-slot='model-metadata' className='min-w-0 space-y-2'>
        <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2'>
          {primaryGroup && (
            <span className='text-muted-foreground max-w-full min-w-0 text-sm font-medium [overflow-wrap:anywhere]'>
              {primaryGroup}
            </span>
          )}
          <ModelBillingModeBadge
            model={props.model}
            className='h-auto shrink-0 whitespace-normal [&>span]:overflow-visible [&>span]:text-clip [&>span]:whitespace-normal'
          />
        </div>

        <div className='text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
          {bottomTags.map((item) => (
            <span key={item} className='max-w-full [overflow-wrap:anywhere]'>
              {item}
            </span>
          ))}
          {!dynamicSummary?.isTaskUsage && !isUnconfiguredTaskUsage && (
            <span>{tokenUnitLabel}</span>
          )}
          {hiddenCount > 0 && <span>+{hiddenCount}</span>}
        </div>
      </div>

      <footer className='mt-auto flex min-w-0 flex-wrap items-center justify-between gap-3'>
        <ModelPerfBadge perf={props.perf} />
        <div className='ml-auto flex shrink-0 items-center gap-2'>
          <YecaiAction
            appearance='outline'
            tone='neutral'
            size='sm'
            aria-label={t('Copy model name')}
            onClick={handleCopy}
            title={t('Copy model name')}
          >
            <Copy className='size-3.5' />
          </YecaiAction>
          <YecaiAction
            appearance='soft'
            tone='model'
            size='sm'
            onClick={props.onClick}
          >
            {t('Details')}
            <ChevronRight className='size-3.5' />
          </YecaiAction>
        </div>
      </footer>
    </YecaiPanel>
  )
})

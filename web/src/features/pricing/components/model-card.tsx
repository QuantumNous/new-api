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
import { ChevronRight } from 'lucide-react'
import { memo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
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
import type { PricingModel, PriceType, TokenUnit } from '../types'
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

export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t } = useTranslation()
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
  let priceSummary: ReactNode
  if (dynamicSummary) {
    if (dynamicSummary.isSpecialExpression) {
      priceSummary = (
        <div className='col-span-full min-w-0'>
          <span className='text-warning'>
            {t('Special billing expression')}
          </span>
          <code className='text-muted-foreground mt-1 line-clamp-2 block font-mono text-xs break-all'>
            {dynamicSummary.rawExpression}
          </code>
        </div>
      )
    } else if (dynamicSummary.primaryEntries.length > 0) {
      priceSummary = (
        <>
          {dynamicSummary.primaryEntries.map((entry) => {
            const unitLabelKey = getDynamicPriceUnitLabelKey(entry)
            let label: ReactNode = null
            if (entry.labelKind !== 'schema') {
              label = t(entry.shortLabel)
            } else if (showTaskFieldLabels) {
              label = (
                <code className='font-mono break-all'>{entry.shortLabel}</code>
              )
            }
            return (
              <div
                key={entry.key}
                className={cn(
                  'flex min-w-0 flex-col gap-1',
                  dynamicSummary.isTaskUsage && 'col-span-full'
                )}
              >
                {label && (
                  <span className='text-muted-foreground text-xs'>{label}</span>
                )}
                <span className='flex flex-wrap items-baseline gap-x-1 font-mono text-sm font-semibold tabular-nums'>
                  <span>{entry.formattedRange ?? entry.formatted}</span>
                  <span className='text-muted-foreground text-xs font-normal whitespace-nowrap'>
                    {' '}
                    / {unitLabelKey ? t(unitLabelKey) : tokenUnitLabel}
                  </span>
                </span>
              </div>
            )
          })}
          {cardExamplePrice && (
            <span className='text-muted-foreground col-span-full text-xs break-words'>
              {cardExamplePrice.label} ≈ {cardExamplePrice.formatted}
            </span>
          )}
          {dynamicSummary.isTaskUsage &&
            dynamicSummary.tier?.label &&
            !dynamicSummary.primaryEntries.some(
              (entry) => entry.formattedRange
            ) && (
              <span className='text-muted-foreground col-span-full text-xs break-words'>
                ({dynamicSummary.tier.label})
              </span>
            )}
        </>
      )
    } else {
      priceSummary = (
        <span className='text-muted-foreground col-span-full'>
          {t('Dynamic Pricing')}
        </span>
      )
    }
  } else if (isUnconfiguredTaskUsage) {
    priceSummary = (
      <span className='text-muted-foreground col-span-full'>
        {t('Usage-based billing · price not configured')}
      </span>
    )
  } else if (isTokenBased) {
    const prices: { type: PriceType; label: string }[] = [
      { type: 'input', label: t('Input') },
      { type: 'output', label: t('Output') },
      ...(props.model.cache_ratio != null
        ? [{ type: 'cache' as const, label: t('Cached') }]
        : []),
    ]
    priceSummary = prices.map((price) => (
      <div key={price.type} className='flex min-w-0 flex-col gap-1'>
        <span className='text-muted-foreground text-xs'>{price.label}</span>
        <span className='font-mono text-sm font-semibold tabular-nums'>
          {formatPrice(
            props.model,
            price.type,
            tokenUnit,
            showRechargePrice,
            priceRate,
            usdExchangeRate,
            props.selectedGroup
          )}
          <span className='text-muted-foreground text-xs font-normal'>
            {' '}
            / {tokenUnitLabel}
          </span>
        </span>
      </div>
    ))
  } else {
    priceSummary = (
      <div className='col-span-full flex min-w-0 flex-col gap-1'>
        <span className='font-mono text-sm font-semibold tabular-nums'>
          {formatRequestPrice(
            props.model,
            showRechargePrice,
            priceRate,
            usdExchangeRate,
            props.selectedGroup
          )}
          <span className='text-muted-foreground text-xs font-normal'>
            {' '}
            / {t('request')}
          </span>
        </span>
      </div>
    )
  }

  return (
    <Card className='hover:ring-foreground/20 h-full min-w-0 gap-3 transition-colors'>
      <CardHeader className='flex flex-row items-start gap-3'>
        <div
          aria-hidden
          className='bg-muted/50 flex size-10 shrink-0 items-center justify-center rounded-lg'
        >
          {modelIcon || (
            <span className='text-muted-foreground text-sm font-bold'>
              {initial}
            </span>
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <h3
            className='line-clamp-2 font-mono text-[15px] leading-snug font-semibold [overflow-wrap:anywhere]'
            title={props.model.model_name}
          >
            {props.model.model_name}
          </h3>
          {props.model.vendor_name && (
            <p
              className='text-muted-foreground mt-1 truncate text-xs'
              title={props.model.vendor_name}
            >
              {props.model.vendor_name}
            </p>
          )}
        </div>
        <CopyButton
          value={props.model.model_name}
          tooltip={t('Copy model name')}
          className='size-7'
          iconClassName='size-3.5'
        />
      </CardHeader>
      <CardContent className='flex flex-1 flex-col gap-3'>
        <div className='flex min-w-0 flex-col gap-1.5'>
          <p className='text-muted-foreground line-clamp-2 text-[13px] leading-5 break-words'>
            {props.model.description || t('No description available.')}
          </p>
          {tags.length > 0 && (
            <div
              role='group'
              aria-label={t('Tags')}
              className='text-muted-foreground flex min-w-0 items-baseline gap-1.5 text-xs'
            >
              <span className='shrink-0'>{t('Tags')}</span>
              <span className='truncate' title={tags.join(', ')}>
                {tags.slice(0, 2).join(', ')}
              </span>
              {tags.length > 2 && (
                <span className='shrink-0' title={tags.slice(2).join(', ')}>
                  +{tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
        <div
          role='group'
          aria-label={t('Pricing')}
          className='mt-auto flex min-w-0 flex-col gap-1.5'
        >
          <ModelBillingModeBadge model={props.model} appearance='caption' />
          <div className='grid grid-cols-[repeat(auto-fit,minmax(88px,1fr))] gap-x-3 gap-y-2'>
            {priceSummary}
          </div>
        </div>
        {(groups.length > 0 || endpoints.length > 0) && (
          <dl
            className={cn(
              'grid min-w-0 grid-cols-2 gap-3 text-xs',
              (groups.length === 0 || endpoints.length === 0) && 'grid-cols-1'
            )}
          >
            {groups.length > 0 && (
              <div className='flex min-w-0 items-baseline gap-1.5'>
                <dt className='text-muted-foreground shrink-0'>
                  {t('Groups')}
                </dt>
                <dd className='flex min-w-0 items-baseline gap-1'>
                  <span className='truncate' title={groups.join(', ')}>
                    {groups[0]}
                  </span>
                  {groups.length > 1 && (
                    <span
                      className='text-muted-foreground shrink-0'
                      title={groups.slice(1).join(', ')}
                    >
                      +{groups.length - 1}
                    </span>
                  )}
                </dd>
              </div>
            )}
            {endpoints.length > 0 && (
              <div className='flex min-w-0 items-baseline gap-1.5'>
                <dt className='text-muted-foreground shrink-0'>
                  {t('Endpoints')}
                </dt>
                <dd className='flex min-w-0 items-baseline gap-1'>
                  <span className='truncate' title={endpoints.join(', ')}>
                    {endpoints.slice(0, 2).join(', ')}
                  </span>
                  {endpoints.length > 2 && (
                    <span
                      className='text-muted-foreground shrink-0'
                      title={endpoints.slice(2).join(', ')}
                    >
                      +{endpoints.length - 2}
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>
        )}
      </CardContent>
      <CardFooter className='mt-auto border-0 bg-transparent pt-0'>
        <ModelPerfBadge
          perf={props.perf}
          className='border-border/60 border-t pt-2'
        >
          <Button variant='ghost' size='sm' onClick={props.onClick}>
            {t('Details')}
            <ChevronRight aria-hidden className='size-3.5' />
          </Button>
        </ModelPerfBadge>
      </CardFooter>
    </Card>
  )
})

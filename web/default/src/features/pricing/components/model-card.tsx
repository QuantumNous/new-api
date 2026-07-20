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

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import {
  getDynamicDisplayGroupRatio,
  getDynamicPricingSummary,
} from '../lib/dynamic-price'
import { parseTags } from '../lib/filters'
import { isTokenBasedModel } from '../lib/model-helpers'
import {
  formatOfficialPrice,
  formatOfficialRequestPrice,
  formatPrice,
  formatRequestPrice,
} from '../lib/price'
import type { PricingModel, TokenUnit } from '../types'
import { ModelBillingModeBadge } from './model-billing-mode-badge'
import { ModelPerfBadge, type ModelPerfBadgeData } from './model-perf-badge'
import { PriceValueComparison } from './price-value-comparison'

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

const TOKEN_COUNT_FORMAT = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
})

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${TOKEN_COUNT_FORMAT.format(tokens / 1_000_000)}M`
  }
  if (tokens >= 1_000) {
    return `${TOKEN_COUNT_FORMAT.format(tokens / 1_000)}K`
  }
  return TOKEN_COUNT_FORMAT.format(tokens)
}

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
  const hasCachedPrice = isTokenBased && props.model.cache_ratio != null
  const displayGroupRatio = getDynamicDisplayGroupRatio(
    props.model,
    props.selectedGroup
  )
  const dynamicSummary = isDynamicPricing
    ? getDynamicPricingSummary(props.model, {
        tokenUnit,
        showRechargePrice,
        priceRate,
        usdExchangeRate,
        groupRatioMultiplier: displayGroupRatio,
      })
    : null
  const officialDynamicSummary = isDynamicPricing
    ? getDynamicPricingSummary(props.model, {
        tokenUnit,
        showRechargePrice: false,
        priceRate,
        usdExchangeRate,
        groupRatioMultiplier: 1,
      })
    : null

  const primaryGroup = groups[0]
  const visibleBadges = [...endpoints.slice(0, 2), ...tags.slice(0, 1)]
  const hiddenBadgeCount =
    Math.max(endpoints.length - 2, 0) + Math.max(tags.length - 1, 0)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    copyToClipboard(props.model.model_name || '')
  }

  const priceRows: {
    key: string
    label: string
    value: string
    officialValue?: string
  }[] = []
  let specialPricingExpression = ''
  if (dynamicSummary) {
    if (dynamicSummary.isSpecialExpression) {
      specialPricingExpression = dynamicSummary.rawExpression
    } else if (dynamicSummary.primaryEntries.length > 0) {
      const officialEntries = new Map(
        (officialDynamicSummary?.primaryEntries ?? []).map((entry) => [
          entry.key,
          entry.formatted,
        ])
      )
      priceRows.push(
        ...dynamicSummary.primaryEntries.map((entry) => {
          const officialValue = officialEntries.get(entry.key)
          return {
            key: entry.key,
            label: t(entry.shortLabel),
            value: entry.formatted,
            officialValue,
          }
        })
      )
    }
  } else if (isTokenBased) {
    const inputValue = formatPrice(
      props.model,
      'input',
      tokenUnit,
      showRechargePrice,
      priceRate,
      usdExchangeRate,
      props.selectedGroup
    )
    const outputValue = formatPrice(
      props.model,
      'output',
      tokenUnit,
      showRechargePrice,
      priceRate,
      usdExchangeRate,
      props.selectedGroup
    )
    const officialInputValue = formatOfficialPrice(
      props.model,
      'input',
      tokenUnit
    )
    const officialOutputValue = formatOfficialPrice(
      props.model,
      'output',
      tokenUnit
    )

    priceRows.push(
      {
        key: 'input',
        label: t('Input'),
        value: inputValue,
        officialValue: officialInputValue,
      },
      {
        key: 'output',
        label: t('Output'),
        value: outputValue,
        officialValue: officialOutputValue,
      }
    )
    if (hasCachedPrice) {
      const cachedValue = formatPrice(
        props.model,
        'cache',
        tokenUnit,
        showRechargePrice,
        priceRate,
        usdExchangeRate,
        props.selectedGroup
      )
      const officialCachedValue = formatOfficialPrice(
        props.model,
        'cache',
        tokenUnit
      )
      priceRows.push({
        key: 'cache',
        label: t('Cached'),
        value: cachedValue,
        officialValue: officialCachedValue,
      })
    }
  } else {
    const requestValue = formatRequestPrice(
      props.model,
      showRechargePrice,
      priceRate,
      usdExchangeRate,
      props.selectedGroup
    )
    const officialRequestValue = formatOfficialRequestPrice(props.model)
    priceRows.push({
      key: 'request',
      label: t('Price'),
      value: requestValue,
      officialValue: officialRequestValue,
    })
  }

  const metadata: { key: string; label: string; value: string }[] = []
  if (props.model.context_length && props.model.context_length > 0) {
    metadata.push({
      key: 'context',
      label: t('Context'),
      value: formatTokenCount(props.model.context_length),
    })
  }
  if (props.model.max_output_tokens && props.model.max_output_tokens > 0) {
    metadata.push({
      key: 'output',
      label: t('Max output'),
      value: formatTokenCount(props.model.max_output_tokens),
    })
  }
  if (props.model.release_date) {
    metadata.push({
      key: 'released',
      label: t('Released'),
      value: props.model.release_date,
    })
  }
  if (metadata.length < 3) {
    metadata.push({
      key: 'groups',
      label: t('Groups'),
      value: groups.length.toString(),
    })
  }
  if (metadata.length < 3) {
    metadata.push({
      key: 'endpoints',
      label: t('Endpoints'),
      value: endpoints.length.toString(),
    })
  }
  if (metadata.length < 3) {
    metadata.push({
      key: 'pricing-type',
      label: t('Pricing Type'),
      value: isTokenBased ? t('Token-based') : t('Per Request'),
    })
  }

  const priceUnit = isTokenBased
    ? `${tokenUnitLabel} ${t('tokens')}`
    : t('request')

  let pricingContent: ReactNode
  if (specialPricingExpression) {
    pricingContent = (
      <div className='min-w-0'>
        <p className='text-sm font-medium'>{t('Special billing expression')}</p>
        <code className='text-muted-foreground mt-1 line-clamp-2 block text-xs break-all'>
          {specialPricingExpression}
        </code>
      </div>
    )
  } else if (priceRows.length > 0) {
    pricingContent = priceRows.map((row) => (
      <div
        key={row.key}
        className='grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 text-sm'
      >
        <span className='text-muted-foreground pt-0.5'>{row.label}</span>
        <PriceValueComparison
          current={row.value}
          official={row.officialValue}
          className='text-right'
          currentClassName='font-semibold'
        />
        <span className='text-muted-foreground self-start pt-0.5 text-xs'>
          / {priceUnit}
        </span>
      </div>
    ))
  } else {
    pricingContent = (
      <p className='text-muted-foreground text-sm'>{t('Dynamic Pricing')}</p>
    )
  }

  return (
    <article
      className={cn(
        'group flex min-h-[340px] flex-col rounded-lg border p-4 transition-colors sm:p-5',
        'hover:bg-muted/20'
      )}
    >
      <header className='flex items-start justify-between gap-3'>
        <div className='flex min-w-0 items-start gap-3'>
          <div className='bg-muted/50 flex size-10 shrink-0 items-center justify-center rounded-lg'>
            {modelIcon || (
              <span className='text-muted-foreground text-sm font-bold'>
                {initial}
              </span>
            )}
          </div>
          <div className='min-w-0'>
            {props.model.vendor_name && (
              <p className='text-muted-foreground mb-0.5 truncate text-xs'>
                {props.model.vendor_name}
              </p>
            )}
            <h3 className='text-foreground truncate text-lg leading-tight font-semibold'>
              {props.model.model_name}
            </h3>
            <code className='text-muted-foreground/70 mt-1 block truncate text-xs'>
              {props.model.model_name}
            </code>
          </div>
        </div>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type='button'
                variant='ghost'
                size='icon'
                onClick={handleCopy}
                aria-label={t('Copy')}
              />
            }
          >
            <Copy />
          </TooltipTrigger>
          <TooltipContent>{t('Copy')}</TooltipContent>
        </Tooltip>
      </header>

      <div className='mt-4 flex min-h-6 flex-wrap items-center gap-1.5'>
        {visibleBadges.map((item) => (
          <Badge key={item} variant='outline' className='font-normal'>
            {item}
          </Badge>
        ))}
        {hiddenBadgeCount > 0 && (
          <Badge variant='secondary'>+{hiddenBadgeCount}</Badge>
        )}
      </div>

      <p className='text-muted-foreground mt-4 line-clamp-3 min-h-[3.75rem] text-sm leading-5'>
        {props.model.description || t('No description available.')}
      </p>

      <div className='mt-4 grid grid-cols-3 gap-3'>
        {metadata.slice(0, 3).map((item) => (
          <div key={item.key} className='min-w-0'>
            <p className='text-muted-foreground truncate text-[11px]'>
              {item.label}
            </p>
            <p className='mt-1 truncate text-sm font-semibold'>{item.value}</p>
          </div>
        ))}
      </div>

      <Separator className='my-4' />

      <div className='flex min-h-24 flex-col gap-1.5'>{pricingContent}</div>

      <footer className='mt-auto flex items-center justify-between gap-3 pt-4'>
        <div className='flex min-w-0 flex-wrap items-center gap-1.5'>
          {primaryGroup && (
            <Badge variant='secondary' className='max-w-32 truncate'>
              {primaryGroup}
              {groups.length > 1 ? ` +${groups.length - 1}` : ''}
            </Badge>
          )}
          <ModelBillingModeBadge model={props.model} />
          <ModelPerfBadge perf={props.perf} />
        </div>
        <Button type='button' variant='ghost' size='sm' onClick={props.onClick}>
          {t('Details')}
          <ChevronRight data-icon='inline-end' />
        </Button>
      </footer>
    </article>
  )
})

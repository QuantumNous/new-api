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
import { ArrowRight, Copy } from 'lucide-react'
import { memo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/design-system/button'
import { StatusBadge } from '@/components/status-badge'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { getLobeIcon } from '@/lib/lobe-icon'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import {
  getDynamicDisplayGroupRatio,
  getDynamicPricingSummary,
} from '../lib/dynamic-price'
import { parseTags } from '../lib/filters'
import { isTokenBasedModel } from '../lib/model-helpers'
import { formatPrice, formatRequestPrice } from '../lib/price'
import type { PricingModel, TokenUnit } from '../types'
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

function PriceMetric(props: {
  label: string
  value: string
  unit: string
  muted?: boolean
}) {
  return (
    <div className='min-w-0'>
      <p className='text-muted-foreground text-xs'>{props.label}</p>
      <p
        className={
          props.muted
            ? 'text-muted-foreground mt-1 truncate text-sm tabular-nums'
            : 'text-foreground mt-1 truncate text-sm font-semibold tabular-nums'
        }
      >
        {props.value}
        <span className='text-muted-foreground ml-1 text-xs font-normal'>
          / {props.unit}
        </span>
      </p>
    </div>
  )
}

export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t } = useTranslation()
  const { copyToClipboard } = useCopyToClipboard()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const showRechargePrice = props.showRechargePrice ?? false
  const tokenUnitLabel = `${tokenUnit === 'K' ? '1K' : '1M'} ${t('tokens')}`
  const isTokenBased = isTokenBasedModel(props.model)
  const modelIconKey = props.model.icon || props.model.vendor_icon
  const modelIcon = modelIconKey ? getLobeIcon(modelIconKey, 24) : null
  const tags = parseTags(props.model.tags)
  const endpoints = props.model.supported_endpoint_types || []
  const groups = props.model.enable_groups || []
  const visibleTags = [...endpoints.slice(0, 2), ...tags.slice(0, 2)]
  const hiddenTagCount =
    Math.max(endpoints.length - 2, 0) + Math.max(tags.length - 2, 0)
  const dynamicSummary = getDynamicPricingSummary(props.model, {
    tokenUnit,
    showRechargePrice,
    priceRate,
    usdExchangeRate,
    groupRatioMultiplier: getDynamicDisplayGroupRatio(
      props.model,
      props.selectedGroup
    ),
  })

  const inputPrice = isTokenBased
    ? formatPrice(
        props.model,
        'input',
        tokenUnit,
        showRechargePrice,
        priceRate,
        usdExchangeRate,
        props.selectedGroup
      )
    : ''
  const outputPrice = isTokenBased
    ? formatPrice(
        props.model,
        'output',
        tokenUnit,
        showRechargePrice,
        priceRate,
        usdExchangeRate,
        props.selectedGroup
      )
    : ''
  const cachedPrice =
    isTokenBased && props.model.cache_ratio != null
      ? formatPrice(
          props.model,
          'cache',
          tokenUnit,
          showRechargePrice,
          priceRate,
          usdExchangeRate,
          props.selectedGroup
        )
      : null

  let priceContent: ReactNode
  if (dynamicSummary?.isSpecialExpression) {
    priceContent = (
      <div>
        <p className='text-warning text-sm font-medium'>
          {t('Special billing expression')}
        </p>
        <code className='text-muted-foreground mt-1 line-clamp-2 block font-mono text-xs break-all'>
          {dynamicSummary.rawExpression}
        </code>
      </div>
    )
  } else if (dynamicSummary && dynamicSummary.primaryEntries.length > 0) {
    priceContent = (
      <div className='grid grid-cols-2 gap-4'>
        {dynamicSummary.primaryEntries.slice(0, 2).map((entry) => (
          <PriceMetric
            key={entry.key}
            label={t(entry.shortLabel)}
            value={entry.formatted}
            unit={tokenUnitLabel}
          />
        ))}
      </div>
    )
  } else if (isTokenBased) {
    priceContent = (
      <div className='grid grid-cols-2 gap-4'>
        <PriceMetric
          label={t('Input')}
          value={inputPrice}
          unit={tokenUnitLabel}
        />
        <PriceMetric
          label={t('Output')}
          value={outputPrice}
          unit={tokenUnitLabel}
        />
        {cachedPrice && (
          <PriceMetric
            label={t('Cached input')}
            value={cachedPrice}
            unit={tokenUnitLabel}
            muted
          />
        )}
      </div>
    )
  } else {
    priceContent = (
      <PriceMetric
        label={t('Price')}
        value={formatRequestPrice(
          props.model,
          showRechargePrice,
          priceRate,
          usdExchangeRate,
          props.selectedGroup
        )}
        unit={t('request')}
      />
    )
  }

  return (
    <article className='hover:bg-muted/20 flex min-h-full flex-col rounded-lg border p-4 transition-colors'>
      <div className='flex items-start gap-3'>
        <div className='bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg'>
          {modelIcon || (
            <span className='text-muted-foreground text-sm font-medium'>
              {props.model.model_name?.charAt(0).toUpperCase() || '?'}
            </span>
          )}
        </div>

        <div className='min-w-0 flex-1'>
          <div className='flex min-w-0 items-center gap-2'>
            <h2 className='truncate font-mono text-sm font-medium'>
              {props.model.model_name}
            </h2>
            <Button
              type='button'
              variant='ghost'
              size='icon-xs'
              onClick={() => copyToClipboard(props.model.model_name || '')}
              aria-label={t('Copy model name')}
            >
              <Copy aria-hidden='true' className='size-3' />
            </Button>
          </div>
          <p className='text-muted-foreground mt-0.5 text-xs'>
            {props.model.vendor_name ||
              (isTokenBased ? t('Token-based') : t('Per Request'))}
          </p>
        </div>

        <ModelPerfBadge perf={props.perf} />
      </div>

      <p className='text-muted-foreground mt-4 line-clamp-2 min-h-10 text-sm leading-relaxed'>
        {props.model.description || t('No description available.')}
      </p>

      <div className='mt-5 border-y py-4'>{priceContent}</div>

      <div className='mt-4 flex flex-1 flex-col justify-end gap-4'>
        <div className='flex min-h-6 flex-wrap items-center gap-1.5'>
          {groups.slice(0, 1).map((group) => (
            <StatusBadge key={group} variant='neutral' size='md'>
              {group}
            </StatusBadge>
          ))}
          {visibleTags.map((tag) => (
            <StatusBadge key={tag} variant='neutral' size='md'>
              {tag}
            </StatusBadge>
          ))}
          {hiddenTagCount > 0 && (
            <span className='text-muted-foreground text-xs'>
              +{hiddenTagCount}
            </span>
          )}
        </div>

        <Button
          type='button'
          variant='ghost'
          onClick={props.onClick}
          className='self-start'
        >
          {t('Details')}
          <ArrowRight aria-hidden='true' />
        </Button>
      </div>
    </article>
  )
})

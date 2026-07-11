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
import type { ColumnDef } from '@tanstack/react-table'
import type { TFunction } from 'i18next'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { BadgeListCell } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import { getLobeIcon } from '@/lib/lobe-icon'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import {
  getDynamicDisplayGroupRatio,
  getDynamicPricingSummary,
} from '../lib/dynamic-price'
import { parseTags } from '../lib/filters'
import { isTokenBasedModel } from '../lib/model-helpers'
import {
  formatPrice,
  formatRequestPrice,
  stripTrailingZeros,
} from '../lib/price'
import type { PriceType, PricingModel, TokenUnit } from '../types'
import { ModelPerfBadge, type ModelPerfBadgeData } from './model-perf-badge'

export interface PricingColumnsOptions {
  tokenUnit?: TokenUnit
  priceRate?: number
  usdExchangeRate?: number
  showRechargePrice?: boolean
  selectedGroup?: string
  perfMap?: Map<string, ModelPerfBadgeData>
}

type PriceColumnType = Extract<PriceType, 'input' | 'cache' | 'output'>

const DYNAMIC_FIELD_BY_PRICE_TYPE: Record<PriceColumnType, string> = {
  input: 'inputPrice',
  cache: 'cacheReadPrice',
  output: 'outputPrice',
}

function renderEmptyCell(align: 'left' | 'right' = 'left'): ReactNode {
  const dash = (
    <span className='text-muted-foreground/50 text-sm tabular-nums'>—</span>
  )
  if (align === 'right') {
    return <div className='text-right'>{dash}</div>
  }
  return dash
}

function renderEmptyPrice(): ReactNode {
  return renderEmptyCell('right')
}

function renderPriceCell(
  props: {
    model: PricingModel
    priceType: PriceColumnType
    options: Required<
      Omit<PricingColumnsOptions, 'selectedGroup' | 'perfMap'>
    > & {
      selectedGroup?: string
    }
  },
  t: TFunction
): ReactNode {
  const tokenUnitLabel = props.options.tokenUnit === 'K' ? '1K' : '1M'
  const dynamicSummary = getDynamicPricingSummary(props.model, {
    tokenUnit: props.options.tokenUnit,
    showRechargePrice: props.options.showRechargePrice,
    priceRate: props.options.priceRate,
    usdExchangeRate: props.options.usdExchangeRate,
    groupRatioMultiplier: getDynamicDisplayGroupRatio(
      props.model,
      props.options.selectedGroup
    ),
  })

  if (dynamicSummary?.isSpecialExpression) {
    if (props.priceType !== 'input') return renderEmptyPrice()
    return (
      <div className='max-w-36'>
        <p className='text-warning text-xs font-medium'>
          {t('Special billing expression')}
        </p>
        <p className='text-muted-foreground mt-0.5 text-xs'>
          {t('View details')}
        </p>
      </div>
    )
  }

  if (dynamicSummary) {
    const entry = dynamicSummary.entries.find(
      (item) => item.field === DYNAMIC_FIELD_BY_PRICE_TYPE[props.priceType]
    )
    if (!entry) return renderEmptyPrice()

    return (
      <div className='text-right'>
        <p className='text-sm font-medium tabular-nums'>
          {stripTrailingZeros(entry.formatted)}
        </p>
        <p className='text-muted-foreground mt-0.5 text-xs'>
          / {tokenUnitLabel} {t('tokens')}
          {dynamicSummary.tierCount > 1 &&
            ` · ${t('{{count}} tiers', {
              count: dynamicSummary.tierCount,
            })}`}
        </p>
      </div>
    )
  }

  if (!isTokenBasedModel(props.model)) {
    if (props.priceType !== 'input') return renderEmptyPrice()
    return (
      <div className='text-right'>
        <p className='text-sm font-medium tabular-nums'>
          {stripTrailingZeros(
            formatRequestPrice(
              props.model,
              props.options.showRechargePrice,
              props.options.priceRate,
              props.options.usdExchangeRate,
              props.options.selectedGroup
            )
          )}
        </p>
        <p className='text-muted-foreground mt-0.5 text-xs'>/ {t('request')}</p>
      </div>
    )
  }

  if (props.priceType === 'cache' && props.model.cache_ratio == null) {
    return renderEmptyPrice()
  }

  return (
    <div className='text-right'>
      <p className='text-sm font-medium tabular-nums'>
        {stripTrailingZeros(
          formatPrice(
            props.model,
            props.priceType,
            props.options.tokenUnit,
            props.options.showRechargePrice,
            props.options.priceRate,
            props.options.usdExchangeRate,
            props.options.selectedGroup
          )
        )}
      </p>
      <p className='text-muted-foreground mt-0.5 text-xs'>
        / {tokenUnitLabel} {t('tokens')}
      </p>
    </div>
  )
}

export function usePricingColumns(
  options: PricingColumnsOptions = {}
): ColumnDef<PricingModel>[] {
  const { t } = useTranslation()
  const priceOptions = {
    tokenUnit: options.tokenUnit ?? DEFAULT_TOKEN_UNIT,
    priceRate: options.priceRate ?? 1,
    usdExchangeRate: options.usdExchangeRate ?? 1,
    showRechargePrice: options.showRechargePrice ?? false,
    selectedGroup: options.selectedGroup,
  }

  return [
    {
      accessorKey: 'model_name',
      header: t('Model'),
      cell: ({ row }) => {
        const model = row.original
        const modelIconKey = model.icon || model.vendor_icon
        const modelIcon = modelIconKey ? getLobeIcon(modelIconKey, 20) : null

        return (
          <div className='flex min-w-0 items-start gap-3 py-1'>
            <div className='bg-muted flex size-8 shrink-0 items-center justify-center rounded-md'>
              {modelIcon || (
                <span className='text-muted-foreground text-xs font-medium'>
                  {model.model_name?.charAt(0).toUpperCase() || '?'}
                </span>
              )}
            </div>
            <div className='min-w-0'>
              <p className='truncate font-mono text-sm font-medium'>
                {model.model_name}
              </p>
              <p className='text-muted-foreground mt-0.5 line-clamp-1 text-xs'>
                {model.vendor_name ||
                  model.description ||
                  (isTokenBasedModel(model)
                    ? t('Token-based')
                    : t('Per Request'))}
              </p>
            </div>
          </div>
        )
      },
      minSize: 260,
      enableSorting: false,
    },
    {
      id: 'input_price',
      header: () => <div className='text-right'>{t('Input')}</div>,
      cell: ({ row }) =>
        renderPriceCell(
          {
            model: row.original,
            priceType: 'input',
            options: priceOptions,
          },
          t
        ),
      size: 130,
      enableSorting: false,
    },
    {
      id: 'cached_price',
      header: () => <div className='text-right'>{t('Cached input')}</div>,
      cell: ({ row }) =>
        renderPriceCell(
          {
            model: row.original,
            priceType: 'cache',
            options: priceOptions,
          },
          t
        ),
      size: 130,
      enableSorting: false,
    },
    {
      id: 'output_price',
      header: () => <div className='text-right'>{t('Output')}</div>,
      cell: ({ row }) =>
        renderPriceCell(
          {
            model: row.original,
            priceType: 'output',
            options: priceOptions,
          },
          t
        ),
      size: 130,
      enableSorting: false,
    },
    {
      id: 'health',
      header: t('Health'),
      cell: ({ row }) => {
        const perf = options.perfMap?.get(row.original.model_name || '')
        if (!perf) {
          return renderEmptyCell()
        }
        return <ModelPerfBadge perf={perf} className='grid' />
      },
      size: 160,
      enableSorting: false,
    },
    {
      accessorKey: 'tags',
      header: t('Tags'),
      cell: ({ row }) => {
        const tags = parseTags(row.original.tags)
        if (tags.length === 0) {
          return renderEmptyCell()
        }
        return (
          <BadgeListCell
            items={tags.map((tag) => (
              <StatusBadge key={tag} variant='neutral' size='md'>
                {tag}
              </StatusBadge>
            ))}
          />
        )
      },
      size: 160,
      enableSorting: false,
    },
    {
      accessorKey: 'supported_endpoint_types',
      header: t('Endpoints'),
      cell: ({ row }) => {
        const endpoints = row.original.supported_endpoint_types || []
        if (endpoints.length === 0) {
          return renderEmptyCell()
        }
        return (
          <BadgeListCell
            items={endpoints.map((endpoint) => (
              <StatusBadge key={endpoint} variant='neutral' size='md'>
                {endpoint}
              </StatusBadge>
            ))}
          />
        )
      },
      size: 150,
      enableSorting: false,
    },
    {
      accessorKey: 'enable_groups',
      header: t('Groups'),
      cell: ({ row }) => {
        const groups = row.original.enable_groups || []
        if (groups.length === 0) {
          return renderEmptyCell()
        }
        return (
          <BadgeListCell
            items={groups.map((group) => (
              <GroupBadge key={group} group={group} size='md' />
            ))}
            tooltipClassName='max-w-72 p-2'
          />
        )
      },
      size: 140,
      enableSorting: false,
    },
  ]
}

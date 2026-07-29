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
import { ChevronRight, Play } from 'lucide-react'
import { memo, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ModelBrandIcon } from '@/features/playground/components/catalog/model-brand-icon'
import { cn } from '@/lib/utils'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import {
  getDynamicDisplayGroupRatio,
  getDynamicPricingSummary,
} from '../lib/dynamic-price'
import { getGroupSavingsPercent, isTokenBasedModel } from '../lib/model-helpers'
import { canTryInPlayground } from '../lib/playground-eligibility'
import { formatPrice, formatRequestPrice } from '../lib/price'
import type { PricingModel, TokenUnit } from '../types'

export interface ModelCardProps {
  model: PricingModel
  onClick: () => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
}

function isRecentlyReleased(model: PricingModel): boolean {
  const raw = model.release_date
  if (!raw) return false
  const ts = Date.parse(raw)
  if (!Number.isFinite(ts)) return false
  const days = (Date.now() - ts) / (1000 * 60 * 60 * 24)
  return days >= 0 && days <= 30
}

function formatDiscountPercent(value: number): string {
  if (Number.isInteger(value)) return String(value)
  const tenths = Math.round(value * 10) / 10
  if (Math.abs(tenths - value) < 1e-9) {
    return value.toFixed(1)
  }
  return value.toFixed(2)
}

/**
 * Compact Model Hub card: identity, price, optional discount.
 * Tags, description, groups, availability, and integration live in details.
 */
export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t } = useTranslation()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const showRechargePrice = props.showRechargePrice ?? false
  const isTokenBased = isTokenBasedModel(props.model)
  const tokenUnitLabel = tokenUnit === 'K' ? t('/K tokens') : t('/M tokens')
  const isNew = isRecentlyReleased(props.model)
  const title = props.model.display_name || props.model.model_name
  const canTry = canTryInPlayground(props.model)

  const isDynamicPricing =
    props.model.billing_mode === 'tiered_expr' &&
    Boolean(props.model.billing_expr)
  const dynamicSummary = isDynamicPricing
    ? getDynamicPricingSummary(props.model, {
        tokenUnit,
        showRechargePrice,
        priceRate,
        usdExchangeRate,
        groupRatioMultiplier: getDynamicDisplayGroupRatio(
          props.model,
          props.selectedGroup
        ),
      })
    : null

  const savingsPercent = getGroupSavingsPercent(
    props.model,
    props.selectedGroup
  )
  const officialDiscount =
    typeof props.model.official_discount === 'number' &&
    props.model.official_discount > 0 &&
    props.model.official_discount < 100
      ? Number(props.model.official_discount.toFixed(2))
      : null
  const cornerDiscount = officialDiscount ?? savingsPercent
  let cornerDiscountTitle: string | undefined
  if (officialDiscount != null) {
    cornerDiscountTitle = t('{{percent}}% below official price', {
      percent: formatDiscountPercent(officialDiscount),
    })
  } else if (savingsPercent != null) {
    cornerDiscountTitle = t('Group {{percent}}% off', {
      percent: savingsPercent,
    })
  }

  let priceLine: ReactNode
  if (dynamicSummary) {
    if (dynamicSummary.isSpecialExpression) {
      priceLine = (
        <span className='text-amber-700 dark:text-amber-300'>
          {t('Special billing expression')}
        </span>
      )
    } else if (dynamicSummary.primaryEntries[0]) {
      const entry = dynamicSummary.primaryEntries[0]
      priceLine = (
        <>
          <span className='text-foreground font-mono text-sm font-semibold tabular-nums sm:text-base'>
            {entry.formatted}
          </span>
          <span className='text-muted-foreground text-xs'>
            {t(entry.shortLabel)}
          </span>
        </>
      )
    } else {
      priceLine = (
        <span className='text-muted-foreground text-sm'>
          {t('Dynamic Pricing')}
        </span>
      )
    }
  } else if (isTokenBased) {
    priceLine = (
      <>
        <span className='text-xs'>
          <span className='text-muted-foreground'>{t('Input')} </span>
          <strong className='text-foreground font-mono text-sm tabular-nums'>
            {formatPrice(
              props.model,
              'input',
              tokenUnit,
              showRechargePrice,
              priceRate,
              usdExchangeRate,
              props.selectedGroup
            )}
          </strong>
        </span>
        <span className='text-muted-foreground/40' aria-hidden>
          /
        </span>
        <span className='text-xs'>
          <span className='text-muted-foreground'>{t('Output')} </span>
          <strong className='text-foreground font-mono text-sm tabular-nums'>
            {formatPrice(
              props.model,
              'output',
              tokenUnit,
              showRechargePrice,
              priceRate,
              usdExchangeRate,
              props.selectedGroup
            )}
          </strong>
        </span>
        <span className='text-muted-foreground text-xs'>{tokenUnitLabel}</span>
      </>
    )
  } else {
    priceLine = (
      <>
        <span className='text-foreground font-mono text-sm font-semibold tabular-nums sm:text-base'>
          {formatRequestPrice(
            props.model,
            showRechargePrice,
            priceRate,
            usdExchangeRate,
            props.selectedGroup
          )}
        </span>
        <span className='text-muted-foreground text-xs'>/ {t('request')}</span>
      </>
    )
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      props.onClick()
    }
  }

  return (
    <article
      role='button'
      tabIndex={0}
      onClick={props.onClick}
      onKeyDown={handleKeyDown}
      data-card-hover='true'
      className={cn(
        'group bg-card hover:bg-muted/30 focus-visible:ring-ring relative flex w-full cursor-pointer flex-col rounded-xl border p-3.5 text-left sm:p-4',
        'focus-visible:ring-2 focus-visible:outline-none'
      )}
      aria-label={`${t('Details')}: ${title}`}
    >
      <div className='flex items-start gap-2.5'>
        <ModelBrandIcon
          modelName={props.model.model_name}
          icon={props.model.icon}
          vendorIcon={props.model.vendor_icon}
          size={28}
        />
        <div className='min-w-0 flex-1'>
          <div className='flex min-w-0 items-start gap-1.5'>
            <h3 className='text-foreground min-w-0 flex-1 truncate text-sm leading-snug font-semibold sm:text-[15px]'>
              {isNew && (
                <span className='bg-primary/10 text-primary mr-1.5 inline-flex rounded px-1 py-px align-middle text-[10px] font-bold tracking-wide uppercase'>
                  {t('NEW')}
                </span>
              )}
              {title}
            </h3>
            {cornerDiscount != null && (
              <span
                className='inline-flex shrink-0 items-center rounded-md bg-rose-500/12 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-rose-700 uppercase dark:text-rose-300'
                title={cornerDiscountTitle}
              >
                -{formatDiscountPercent(cornerDiscount)}%
              </span>
            )}
          </div>
          <div className='mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5'>
            {priceLine}
          </div>
        </div>
      </div>

      <div className='mt-3 flex items-center justify-between gap-2'>
        {canTry ? (
          <Link
            to='/playground'
            search={{ model: props.model.model_name }}
            onClick={(event) => event.stopPropagation()}
            className='bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium'
          >
            <Play className='size-3' />
            {t('Try')}
          </Link>
        ) : (
          <span />
        )}
        <span className='text-muted-foreground group-hover:text-foreground inline-flex items-center gap-0.5 text-xs font-medium transition-colors'>
          {t('Details')}
          <ChevronRight className='size-3.5' />
        </span>
      </div>
    </article>
  )
})

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
  AudioLines,
  Brain,
  Eye,
  Film,
  Layers,
  Play,
  type LucideIcon,
} from 'lucide-react'
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
import { ModelPriceRows, type ModelPriceRowItem } from './model-price-rows'

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

const COMPACT_TOKEN_FORMAT = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
})

function formatCompactTokenCount(tokens?: number): string {
  if (!tokens || !Number.isFinite(tokens) || tokens <= 0) return ''
  if (tokens >= 1_000_000) {
    return `${COMPACT_TOKEN_FORMAT.format(tokens / 1_000_000)}M`
  }
  if (tokens >= 1_000) {
    return `${COMPACT_TOKEN_FORMAT.format(tokens / 1_000)}K`
  }
  return COMPACT_TOKEN_FORMAT.format(tokens)
}

type MetaChip = {
  key: string
  icon: LucideIcon
  label: string
  title?: string
}

/** At most this many metadata chips per card so the row stays on one line. */
const MAX_META_CHIPS = 4

function collectMetaChips(
  model: PricingModel,
  t: (key: string) => string
): MetaChip[] {
  const chips: MetaChip[] = []
  const contextLabel = formatCompactTokenCount(model.context_length)
  if (contextLabel) {
    chips.push({
      key: 'context',
      icon: Layers,
      label: contextLabel,
      title: t('Context length'),
    })
  }
  const capabilities = new Set(
    (model.capabilities ?? []).map((item) => item.trim().toLowerCase())
  )
  const inputModalities = new Set(
    (model.input_modalities ?? []).map((item) => item.trim().toLowerCase())
  )
  if (capabilities.has('vision') || inputModalities.has('image')) {
    chips.push({ key: 'vision', icon: Eye, label: t('Vision') })
  }
  if (capabilities.has('reasoning')) {
    chips.push({ key: 'reasoning', icon: Brain, label: t('Reasoning') })
  }
  if (inputModalities.has('audio')) {
    chips.push({ key: 'audio', icon: AudioLines, label: t('Audio') })
  }
  if (inputModalities.has('video')) {
    chips.push({ key: 'video', icon: Film, label: t('Video') })
  }
  return chips.slice(0, MAX_META_CHIPS)
}

/**
 * Compact Model Hub card: identity, metadata chips, price footer.
 * Tags, description, groups, availability, and integration live in details.
 */
export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t } = useTranslation()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const showRechargePrice = props.showRechargePrice ?? false
  const isTokenBased = isTokenBasedModel(props.model)
  const isNew = isRecentlyReleased(props.model)
  const title = props.model.display_name || props.model.model_name
  const canTry = canTryInPlayground(props.model)
  const metaChips = collectMetaChips(props.model, t)

  const modelId = props.model.model_name
  const showsModelId = Boolean(modelId) && modelId !== title
  const subtitle = showsModelId ? modelId : props.model.vendor_name?.trim()

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
        <span className='text-xs text-amber-700 dark:text-amber-300'>
          {t('Special billing expression')}
        </span>
      )
    } else if (dynamicSummary.primaryEntries[0]) {
      const entry = dynamicSummary.primaryEntries[0]
      priceLine = (
        <div className='font-price flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5'>
          <span className='text-foreground text-sm font-semibold tabular-nums sm:text-[15px]'>
            {entry.formatted}
          </span>
          <span className='text-muted-foreground text-xs'>
            {t(entry.shortLabel)}
          </span>
        </div>
      )
    } else {
      priceLine = (
        <span className='text-muted-foreground text-sm'>
          {t('Dynamic Pricing')}
        </span>
      )
    }
  } else if (isTokenBased) {
    const priceItems: ModelPriceRowItem[] = [
      {
        key: 'input',
        label: t('Input'),
        tone: 'input',
        emphasized: true,
        formatted: formatPrice(
          props.model,
          'input',
          tokenUnit,
          showRechargePrice,
          priceRate,
          usdExchangeRate,
          props.selectedGroup
        ),
      },
      {
        key: 'output',
        label: t('Output'),
        tone: 'output',
        emphasized: true,
        formatted: formatPrice(
          props.model,
          'output',
          tokenUnit,
          showRechargePrice,
          priceRate,
          usdExchangeRate,
          props.selectedGroup
        ),
      },
    ]
    if (props.model.cache_ratio != null) {
      priceItems.push({
        key: 'cache',
        label: t('Cache'),
        tone: 'cache',
        formatted: formatPrice(
          props.model,
          'cache',
          tokenUnit,
          showRechargePrice,
          priceRate,
          usdExchangeRate,
          props.selectedGroup
        ),
      })
    }
    priceLine = (
      <ModelPriceRows
        items={priceItems}
        unitSuffix={tokenUnit === 'K' ? '/1K' : '/1M'}
      />
    )
  } else {
    priceLine = (
      <ModelPriceRows
        items={[
          {
            key: 'request',
            label: t('Per request'),
            tone: 'default',
            emphasized: true,
            formatted: formatRequestPrice(
              props.model,
              showRechargePrice,
              priceRate,
              usdExchangeRate,
              props.selectedGroup
            ),
          },
        ]}
      />
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
        'group bg-card hover:border-primary/40 focus-visible:ring-ring relative flex h-full cursor-pointer flex-col rounded-xl border p-4 text-left',
        'focus-visible:ring-2 focus-visible:outline-none'
      )}
      aria-label={`${t('Details')}: ${title}`}
    >
      <div className='mb-3 flex items-start gap-2.5'>
        <div className='bg-muted/40 flex size-9 shrink-0 items-center justify-center rounded-lg'>
          <ModelBrandIcon
            modelName={props.model.model_name}
            icon={props.model.icon}
            vendorIcon={props.model.vendor_icon}
            size={22}
          />
        </div>
        <div className='min-w-0 flex-1'>
          <h3
            className='text-foreground truncate text-sm leading-snug font-semibold sm:text-[15px]'
            title={title}
          >
            {title}
          </h3>
          {(subtitle || isNew) && (
            <div className='mt-0.5 flex min-w-0 items-center gap-1.5'>
              {isNew && (
                <span className='bg-primary/10 text-primary inline-flex shrink-0 rounded px-1 py-px text-[10px] font-bold tracking-wide uppercase'>
                  {t('NEW')}
                </span>
              )}
              {subtitle && (
                <span
                  className={cn(
                    'text-muted-foreground min-w-0 truncate text-[11px]',
                    showsModelId && 'font-mono'
                  )}
                  title={subtitle}
                >
                  {subtitle}
                </span>
              )}
            </div>
          )}
        </div>
        {cornerDiscount != null && (
          <span
            className='inline-flex shrink-0 items-center self-start rounded-md bg-rose-500/12 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-rose-700 uppercase dark:text-rose-300'
            title={cornerDiscountTitle}
          >
            -{formatDiscountPercent(cornerDiscount)}%
          </span>
        )}
      </div>

      {metaChips.length > 0 && (
        <div className='mb-3 flex flex-wrap gap-1.5'>
          {metaChips.map((chip) => {
            const ChipIcon = chip.icon
            return (
              <span
                key={chip.key}
                className='border-border/60 bg-muted/30 text-muted-foreground inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]'
                title={chip.title}
              >
                <ChipIcon className='size-3 shrink-0' aria-hidden />
                {chip.label}
              </span>
            )
          })}
        </div>
      )}

      <div className='mt-auto border-t pt-2.5'>
        {priceLine}
        {canTry && (
          <div className='mt-2.5 flex'>
            <Link
              to='/playground'
              search={{ model: props.model.model_name }}
              onClick={(event) => event.stopPropagation()}
              className='text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors'
            >
              <Play className='size-3' />
              {t('Try')}
            </Link>
          </div>
        )}
      </div>
    </article>
  )
})

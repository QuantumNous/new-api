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
import { memo } from 'react'
import { ChevronRight, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { StatusBadge } from '@/components/status-badge'
import { DEFAULT_TOKEN_UNIT } from '../constants'
import {
  getDynamicDisplayGroupRatio,
  getDynamicPricingSummary,
} from '../lib/dynamic-price'
import { getPricingTokenUnitSuffix } from '../lib/pricing-display'
import {
  pricingCardActionButtonClassName,
  pricingCardClassName,
  pricingCardMetaClassName,
  pricingCardPriceLabelClassName,
  pricingCardPriceValueClassName,
  pricingCardTagClassName,
  pricingCardTitleClassName,
} from '../lib/pricing-portal-styles'
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
  perf?: ModelPerfBadgeData
}

export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t } = useTranslation()
  const { copyToClipboard } = useCopyToClipboard()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const unitSuffix = getPricingTokenUnitSuffix(t, tokenUnit)
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const showRechargePrice = props.showRechargePrice ?? false
  const isTokenBased = isTokenBasedModel(props.model)
  const tags = parseTags(props.model.tags)
  const groups = props.model.enable_groups || []
  const endpoints = props.model.supported_endpoint_types || []
  const vendorName = props.model.vendor_name?.trim()
  const vendorIcon = props.model.vendor_icon
    ? getLobeIcon(props.model.vendor_icon, 28)
    : null
  const initial = props.model.model_name?.charAt(0).toUpperCase() || '?'
  const isDynamicPricing =
    props.model.billing_mode === 'tiered_expr' &&
    Boolean(props.model.billing_expr)
  const hasCachedPrice = isTokenBased && props.model.cache_ratio != null
  const dynamicSummary = isDynamicPricing
    ? getDynamicPricingSummary(props.model, {
        tokenUnit,
        showRechargePrice,
        priceRate,
        usdExchangeRate,
        groupRatioMultiplier: getDynamicDisplayGroupRatio(props.model),
      })
    : null

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

  return (
    <div className={pricingCardClassName}>
      <div className='flex items-start justify-between gap-2.5 sm:gap-3'>
        <div className='flex min-w-0 items-start gap-2.5 sm:gap-3'>
          <div className='flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-950/60 sm:size-10 sm:rounded-xl'>
            {vendorIcon || (
              <span className='text-sm font-bold text-slate-300'>{initial}</span>
            )}
          </div>
          <div className='min-w-0'>
            <h3 className={pricingCardTitleClassName}>
              {props.model.model_name}
            </h3>
            <div className='mt-0.5 flex flex-col gap-0.5 text-xs sm:mt-1 sm:gap-1'>
              {dynamicSummary ? (
                dynamicSummary.isSpecialExpression ? (
                  <span className='min-w-0'>
                    <span className='font-medium text-amber-200'>
                      {t('Special billing expression')}
                    </span>
                    <code className='mt-0.5 line-clamp-1 block font-mono text-[11px] text-slate-300 break-all'>
                      {dynamicSummary.rawExpression}
                    </code>
                  </span>
                ) : dynamicSummary.primaryEntries.length > 0 ? (
                  dynamicSummary.primaryEntries.map((entry) => (
                    <span
                      key={entry.key}
                      className={cn(pricingCardPriceLabelClassName, 'whitespace-nowrap')}
                    >
                      {t(entry.shortLabel)}{' '}
                      <span className={pricingCardPriceValueClassName}>
                        {entry.formatted}
                      </span>
                      {unitSuffix}
                    </span>
                  ))
                ) : (
                  <span className='text-slate-300'>{t('Dynamic Pricing')}</span>
                )
              ) : isTokenBased ? (
                <>
                  <span
                    className={cn(pricingCardPriceLabelClassName, 'whitespace-nowrap')}
                  >
                    {t('Input')}{' '}
                    <span className={pricingCardPriceValueClassName}>
                      {formatPrice(
                        props.model,
                        'input',
                        tokenUnit,
                        showRechargePrice,
                        priceRate,
                        usdExchangeRate
                      )}
                    </span>
                    {unitSuffix}
                  </span>
                  <span
                    className={cn(pricingCardPriceLabelClassName, 'whitespace-nowrap')}
                  >
                    {t('Output')}{' '}
                    <span className={pricingCardPriceValueClassName}>
                      {formatPrice(
                        props.model,
                        'output',
                        tokenUnit,
                        showRechargePrice,
                        priceRate,
                        usdExchangeRate
                      )}
                    </span>
                    {unitSuffix}
                  </span>
                  {hasCachedPrice && (
                    <span
                      className={cn(
                        pricingCardPriceLabelClassName,
                        'whitespace-nowrap text-slate-300'
                      )}
                    >
                      {t('Cached')}{' '}
                      <span className='font-mono text-slate-200'>
                        {formatPrice(
                          props.model,
                          'cache',
                          tokenUnit,
                          showRechargePrice,
                          priceRate,
                          usdExchangeRate
                        )}
                      </span>
                      {unitSuffix}
                    </span>
                  )}
                </>
              ) : (
                <span
                  className={cn(pricingCardPriceLabelClassName, 'whitespace-nowrap')}
                >
                  <span className={pricingCardPriceValueClassName}>
                    {formatRequestPrice(
                      props.model,
                      showRechargePrice,
                      priceRate,
                      usdExchangeRate
                    )}
                  </span>{' '}
                  / {t('request')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className='flex shrink-0 items-center gap-1.5'>
          <button
            type='button'
            onClick={props.onClick}
            className={pricingCardActionButtonClassName}
          >
            {t('Details')}
            <ChevronRight className='size-3.5' />
          </button>
          <button
            type='button'
            onClick={handleCopy}
            className={cn(pricingCardActionButtonClassName, 'p-1.5')}
            title={t('Copy')}
          >
            <Copy className='size-3.5' />
          </button>
        </div>
      </div>

      <p className='mt-2 line-clamp-1 flex-1 text-[13px] leading-relaxed text-slate-300 sm:mt-4 sm:line-clamp-2 sm:min-h-[2.5rem]'>
        {props.model.description || t('No description available.')}
      </p>

      <div className='mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1 sm:mt-4'>
        <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
          {primaryGroup && (
            <span className={pricingCardMetaClassName}>
              {t('Tenant group')}: {primaryGroup}
            </span>
          )}
          <span className={pricingCardMetaClassName}>
            {t('Billing mode')}:{' '}
            {isTokenBased ? t('Token-based billing') : t('Per-request billing')}
          </span>
          {vendorName && (
            <span className={pricingCardMetaClassName}>
              {t('Service source')}: {vendorName}
            </span>
          )}
          {isDynamicPricing && (
            <StatusBadge
              label={t('Dynamic Pricing')}
              variant='warning'
              copyable={false}
              size='sm'
            />
          )}
        </div>
        <ModelPerfBadge perf={props.perf} className='row-span-2 self-start' />

        <div className='flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 sm:gap-x-3 sm:gap-y-1'>
          {bottomTags.map((item) => (
            <span key={item} className={pricingCardTagClassName}>
              {item}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className='text-xs text-slate-400'>+{hiddenCount}</span>
          )}
        </div>
      </div>
    </div>
  )
})

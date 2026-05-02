import { memo } from 'react'
import { ChevronRight, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/status-badge'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { DEFAULT_TOKEN_UNIT } from '../constants'
import { parseTags } from '../lib/filters'
import { isTokenBasedModel } from '../lib/model-helpers'
import { formatPrice, formatRequestPrice } from '../lib/price'
import {
  getDynamicDisplayGroupRatio,
  getDynamicPricingSummary,
} from '../lib/dynamic-price'
import type { PricingModel, TokenUnit } from '../types'

export interface ModelCardProps {
  model: PricingModel
  onClick: () => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
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
  const vendorIcon = props.model.vendor_icon
    ? getLobeIcon(props.model.vendor_icon, 28)
    : null
  const initial = props.model.model_name?.charAt(0).toUpperCase() || '?'
  const isDynamicPricing =
    props.model.billing_mode === 'tiered_expr' && Boolean(props.model.billing_expr)
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
    <div
      className={cn(
        'group flex flex-col rounded-xl border p-3 transition-colors sm:p-5',
        'hover:bg-muted/20'
      )}
    >
      {/* Header: icon + name + price + actions */}
      <div className='flex items-start justify-between gap-2.5 sm:gap-3'>
        <div className='flex min-w-0 items-start gap-2.5 sm:gap-3'>
          <div className='bg-muted/40 flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10 sm:rounded-xl'>
            {vendorIcon || (
              <span className='text-muted-foreground text-sm font-bold'>
                {initial}
              </span>
            )}
          </div>
          <div className='min-w-0'>
            <h3 className='text-foreground truncate font-mono text-[15px] font-bold leading-tight'>
              {props.model.model_name}
            </h3>
            <div className='mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs sm:mt-1 sm:gap-x-3'>
              {dynamicSummary ? (
                dynamicSummary.isSpecialExpression ? (
                  <span className='min-w-0'>
                    <span className='text-amber-700 dark:text-amber-300'>
                      {t('Special billing expression')}
                    </span>
                    <code className='text-muted-foreground/70 mt-0.5 line-clamp-1 block break-all font-mono text-[11px]'>
                      {dynamicSummary.rawExpression}
                    </code>
                  </span>
                ) : dynamicSummary.primaryEntries.length > 0 ? (
                  <>
                    {dynamicSummary.primaryEntries.map((entry) => (
                      <span
                        key={entry.key}
                        className='text-muted-foreground whitespace-nowrap'
                      >
                        {t(entry.shortLabel)}{' '}
                        <span className='text-foreground font-mono font-semibold'>
                          {entry.formatted}
                        </span>
                        /{tokenUnitLabel}
                      </span>
                    ))}
                  </>
                ) : (
                  <span className='text-muted-foreground text-xs'>
                    {t('Dynamic Pricing')}
                  </span>
                )
              ) : isTokenBased ? (
                <>
                  <span className='text-muted-foreground whitespace-nowrap'>
                    {t('Input')}{' '}
                    <span className='text-foreground font-mono font-semibold'>
                      {formatPrice(props.model, 'input', tokenUnit, showRechargePrice, priceRate, usdExchangeRate)}
                    </span>
                    /{tokenUnitLabel}
                  </span>
                  <span className='text-muted-foreground whitespace-nowrap'>
                    {t('Output')}{' '}
                    <span className='text-foreground font-mono font-semibold'>
                      {formatPrice(props.model, 'output', tokenUnit, showRechargePrice, priceRate, usdExchangeRate)}
                    </span>
                    /{tokenUnitLabel}
                  </span>
                  {hasCachedPrice && (
                    <span className='text-muted-foreground/60 whitespace-nowrap'>
                      {t('Cached')}{' '}
                      <span className='font-mono'>
                        {formatPrice(props.model, 'cache', tokenUnit, showRechargePrice, priceRate, usdExchangeRate)}
                      </span>
                    </span>
                  )}
                </>
              ) : (
                <span className='text-muted-foreground whitespace-nowrap'>
                  <span className='text-foreground font-mono font-semibold'>
                    {formatRequestPrice(props.model, showRechargePrice, priceRate, usdExchangeRate)}
                  </span>
                  {' '}/ {t('request')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className='flex shrink-0 items-center gap-1.5'>
          <button
            type='button'
            onClick={props.onClick}
            className='text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors sm:px-2.5 sm:py-1.5'
          >
            {t('Details')}
            <ChevronRight className='size-3.5' />
          </button>
          <button
            type='button'
            onClick={handleCopy}
            className='text-muted-foreground hover:text-foreground hover:bg-muted rounded-md border p-1.5 transition-colors'
            title={t('Copy')}
          >
            <Copy className='size-3.5' />
          </button>
        </div>
      </div>

      {/* Description */}
      <p className='text-muted-foreground mt-2 line-clamp-1 flex-1 text-[13px] leading-relaxed sm:mt-4 sm:line-clamp-2 sm:min-h-[2.5rem]'>
        {props.model.description || t('No description available.')}
      </p>

      {/* Footer row 1: group + billing type */}
      <div className='mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 sm:mt-4'>
        {primaryGroup && (
          <span className='text-muted-foreground text-xs font-medium'>
            {primaryGroup} {t('Groups')}
          </span>
        )}
        <span className='text-muted-foreground text-xs font-medium'>
          {isTokenBased ? t('Token-based') : t('Per Request')}
        </span>
        {isDynamicPricing && (
          <StatusBadge
            label={t('Dynamic Pricing')}
            variant='warning'
            copyable={false}
            size='sm'
          />
        )}
      </div>

      {/* Footer row 2: endpoint + tag chips */}
      <div className='mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 sm:mt-2 sm:gap-x-3 sm:gap-y-1'>
        {bottomTags.map((item) => (
          <span
            key={item}
            className='text-muted-foreground/70 text-xs'
          >
            {item}
          </span>
        ))}
        <span className='text-muted-foreground/50 text-xs'>{tokenUnitLabel}</span>
        {hiddenCount > 0 && (
          <span className='text-muted-foreground/40 text-xs'>
            +{hiddenCount}
          </span>
        )}
      </div>
    </div>
  )
})

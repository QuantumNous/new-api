import { memo, useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
import { DEFAULT_TOKEN_UNIT } from '../constants'
import {
  parseTiersFromExpr,
  splitBillingExprAndRequestRules,
  tryParseRequestRuleExpr,
  SOURCE_TIME,
} from '../lib/billing-expr'
import { parseTags } from '../lib/filters'
import { isTokenBasedModel } from '../lib/model-helpers'
import { formatPrice, formatRequestPrice } from '../lib/price'
import type { PricingModel, TokenUnit } from '../types'

export interface ModelRowProps {
  model: PricingModel
  onClick: () => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
}

interface DynamicPricingHints {
  tierCount: number
  hasTimeCondition: boolean
  hasRequestCondition: boolean
}

/**
 * Extract at-a-glance hints from a tiered billing expression.
 *
 * The full breakdown lives in `DynamicPricingBreakdown`; here we only need a
 * minimal summary (tier count + condition presence) so that users scanning
 * the list can tell *what kind* of dynamic pricing applies before clicking
 * through to the model details page.
 */
function summarizeTieredExpr(
  expr: string | null | undefined
): DynamicPricingHints {
  if (!expr) {
    return { tierCount: 0, hasTimeCondition: false, hasRequestCondition: false }
  }
  const split = splitBillingExprAndRequestRules(expr)
  const tiers = parseTiersFromExpr(split.billingExpr)
  const ruleGroups = tryParseRequestRuleExpr(split.requestRuleExpr || '') || []

  let hasTimeCondition = false
  let hasRequestCondition = false
  for (const group of ruleGroups) {
    for (const condition of group.conditions) {
      if (condition.source === SOURCE_TIME) {
        hasTimeCondition = true
      } else {
        hasRequestCondition = true
      }
    }
  }

  return {
    tierCount: tiers.length,
    hasTimeCondition,
    hasRequestCondition,
  }
}

function PriceLabel(props: { label: string; value: string; muted?: boolean }) {
  return (
    <div className='flex items-baseline justify-end gap-2'>
      <span
        className={cn(
          'text-[11px]',
          props.muted ? 'text-muted-foreground/40' : 'text-muted-foreground/60'
        )}
      >
        {props.label}
      </span>
      <span
        className={cn(
          'font-mono text-sm tabular-nums',
          props.muted
            ? 'text-muted-foreground'
            : 'text-foreground font-semibold'
        )}
      >
        {props.value}
      </span>
    </div>
  )
}

export const ModelRow = memo(function ModelRow(props: ModelRowProps) {
  const { t } = useTranslation()
  const model = props.model
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const showRechargePrice = props.showRechargePrice ?? false

  const isTokenBased = isTokenBasedModel(model)
  const vendorIcon = model.vendor_icon
    ? getLobeIcon(model.vendor_icon, 20)
    : null
  const tags = parseTags(model.tags)
  const tokenUnitLabel = tokenUnit === 'K' ? '1K' : '1M'
  const hasCachedPrice = isTokenBased && model.cache_ratio != null

  const isDynamicPricing =
    model.billing_mode === 'tiered_expr' && Boolean(model.billing_expr)
  const dynamicHints = useMemo(
    () => (isDynamicPricing ? summarizeTieredExpr(model.billing_expr) : null),
    [isDynamicPricing, model.billing_expr]
  )

  return (
    <button
      type='button'
      onClick={props.onClick}
      className='group hover:bg-muted/40 w-full border-b text-left transition-colors last:border-b-0'
    >
      <div className='flex items-start gap-3.5 px-4 py-3.5 sm:gap-4 sm:px-5 sm:py-4'>
        <div className='hidden shrink-0 pt-0.5 sm:block'>
          {vendorIcon || (
            <div className='bg-muted text-muted-foreground flex size-5 items-center justify-center rounded text-[10px] font-bold'>
              {model.model_name?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
        </div>

        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <span className='shrink-0 sm:hidden'>{vendorIcon}</span>
            <h3 className='text-foreground truncate font-mono text-sm font-semibold'>
              {model.model_name}
            </h3>
          </div>

          <div className='text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs'>
            {model.vendor_name && <span>{model.vendor_name}</span>}
            {model.vendor_name && (
              <span className='text-muted-foreground/30'>·</span>
            )}
            <span className='text-muted-foreground/60'>
              {isTokenBased ? t('Token-based') : t('Per Request')}
            </span>
            {model.supported_endpoint_types &&
              model.supported_endpoint_types.length > 0 && (
                <>
                  <span className='text-muted-foreground/30'>·</span>
                  <span className='text-muted-foreground/50'>
                    {model.supported_endpoint_types.slice(0, 2).join(', ')}
                    {model.supported_endpoint_types.length > 2 &&
                      ` +${model.supported_endpoint_types.length - 2}`}
                  </span>
                </>
              )}
            {isDynamicPricing && (
              <>
                <span className='text-muted-foreground/30'>·</span>
                <span className='rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'>
                  {t('Dynamic Pricing')}
                </span>
                {dynamicHints && dynamicHints.tierCount > 1 && (
                  <span className='bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium'>
                    {t('{{count}} tiers', { count: dynamicHints.tierCount })}
                  </span>
                )}
                {dynamicHints?.hasTimeCondition && (
                  <span className='bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium'>
                    {t('Time-based')}
                  </span>
                )}
                {dynamicHints?.hasRequestCondition && (
                  <span className='bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium'>
                    {t('Request-based')}
                  </span>
                )}
              </>
            )}
          </div>

          {model.description && (
            <p className='text-muted-foreground/60 mt-1 line-clamp-1 text-xs leading-relaxed'>
              {model.description}
            </p>
          )}

          {tags.length > 0 && (
            <div className='mt-1.5 flex flex-wrap gap-1'>
              {tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className='bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium'
                >
                  {tag}
                </span>
              ))}
              {tags.length > 4 && (
                <span className='text-muted-foreground/40 self-center text-[10px]'>
                  +{tags.length - 4}
                </span>
              )}
            </div>
          )}
        </div>

        <div className='shrink-0 text-right'>
          {isTokenBased ? (
            <div className='grid gap-0.5'>
              <PriceLabel
                label={t('Input')}
                value={formatPrice(
                  model,
                  'input',
                  tokenUnit,
                  showRechargePrice,
                  priceRate,
                  usdExchangeRate
                )}
              />
              {hasCachedPrice && (
                <PriceLabel
                  label={t('Cached')}
                  value={formatPrice(
                    model,
                    'cache',
                    tokenUnit,
                    showRechargePrice,
                    priceRate,
                    usdExchangeRate
                  )}
                  muted
                />
              )}
              <PriceLabel
                label={t('Output')}
                value={formatPrice(
                  model,
                  'output',
                  tokenUnit,
                  showRechargePrice,
                  priceRate,
                  usdExchangeRate
                )}
              />
              <span className='text-muted-foreground/40 text-[10px]'>
                / {tokenUnitLabel} tokens
              </span>
            </div>
          ) : (
            <div>
              <span className='text-foreground text-sm font-semibold tabular-nums'>
                {formatRequestPrice(
                  model,
                  showRechargePrice,
                  priceRate,
                  usdExchangeRate
                )}
              </span>
              <div className='text-muted-foreground/40 text-[10px]'>
                / {t('request')}
              </div>
            </div>
          )}
        </div>

        <ChevronRight className='text-muted-foreground/20 group-hover:text-muted-foreground/50 mt-1.5 hidden size-4 shrink-0 transition-colors sm:block' />
      </div>
    </button>
  )
})

import { getLobeIcon } from '@/lib/lobe-icon'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/status-badge'
import { MAX_TAGS_DISPLAY, DEFAULT_TOKEN_UNIT } from '../constants'
import { parseTags } from '../lib/filters'
import { isTokenBasedModel } from '../lib/model-helpers'
import { formatPrice, formatRequestPrice } from '../lib/price'
import type { PricingModel, TokenUnit } from '../types'

// ----------------------------------------------------------------------------
// Model Row Component
// ----------------------------------------------------------------------------

export interface ModelRowProps {
  model: PricingModel
  onClick: () => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
}

export function ModelRow({
  model,
  onClick,
  priceRate = 1,
  usdExchangeRate = 1,
  tokenUnit = DEFAULT_TOKEN_UNIT,
  showRechargePrice = false,
}: ModelRowProps) {
  const tags = parseTags(model.tags).slice(0, MAX_TAGS_DISPLAY)
  const isTokenBased = isTokenBasedModel(model)
  const vendorIcon = model.vendor_icon
    ? getLobeIcon(model.vendor_icon, 14)
    : null
  const tokenUnitLabel = tokenUnit === 'K' ? '1K' : '1M'

  return (
    <button
      onClick={onClick}
      className='hover:bg-accent/5 group w-full px-4 py-4 text-left transition-colors sm:px-6 sm:py-6'
    >
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8'>
        {/* Model Info */}
        <div className='min-w-0 flex-1 space-y-2'>
          {/* Title */}
          <div className='space-y-0.5 sm:space-y-1'>
            <h3 className='text-foreground text-sm font-medium sm:text-base'>
              {model.model_name}
            </h3>
            {model.vendor_name && (
              <div className='flex items-center gap-1.5'>
                {vendorIcon}
                <p className='text-muted-foreground text-xs sm:text-sm'>
                  {model.vendor_name}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          {model.description && (
            <p className='text-muted-foreground line-clamp-2 text-xs leading-relaxed sm:text-sm'>
              {model.description}
            </p>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className='flex flex-wrap gap-1 sm:gap-1.5'>
              {tags.map((tag) => (
                <StatusBadge
                  key={tag}
                  label={tag}
                  autoColor={tag}
                  size='sm'
                  copyable={false}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pricing */}
        <div className='flex shrink-0 flex-col items-start gap-1 sm:items-end sm:gap-1.5'>
          {isTokenBased ? (
            <>
              <div className='flex items-center gap-2 sm:gap-3'>
                <div className='flex flex-col items-start gap-0.5 sm:items-end'>
                  <span className='text-muted-foreground text-[9px] font-medium tracking-wide uppercase sm:text-[10px]'>
                    Input
                  </span>
                  <span className='text-foreground text-sm font-semibold tabular-nums sm:text-base'>
                    {formatPrice(
                      model,
                      'input',
                      tokenUnit,
                      showRechargePrice,
                      priceRate,
                      usdExchangeRate
                    )}
                  </span>
                </div>
                <Separator
                  orientation='vertical'
                  className='h-6 sm:h-8'
                  decorative
                />
                <div className='flex flex-col items-start gap-0.5 sm:items-end'>
                  <span className='text-muted-foreground text-[9px] font-medium tracking-wide uppercase sm:text-[10px]'>
                    Output
                  </span>
                  <span className='text-foreground text-sm font-semibold tabular-nums sm:text-base'>
                    {formatPrice(
                      model,
                      'output',
                      tokenUnit,
                      showRechargePrice,
                      priceRate,
                      usdExchangeRate
                    )}
                  </span>
                </div>
              </div>
              <span className='text-muted-foreground text-[10px] sm:text-xs'>
                per {tokenUnitLabel} tokens
              </span>
            </>
          ) : (
            <>
              <div className='flex flex-col items-start gap-0.5 sm:items-end'>
                <span className='text-muted-foreground text-[9px] font-medium tracking-wide uppercase sm:text-[10px]'>
                  Price
                </span>
                <span className='text-foreground text-sm font-semibold tabular-nums sm:text-base'>
                  {formatRequestPrice(
                    model,
                    showRechargePrice,
                    priceRate,
                    usdExchangeRate
                  )}
                </span>
              </div>
              <span className='text-muted-foreground text-[10px] sm:text-xs'>
                per request
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}

import { getLobeIcon } from '@/lib/lobe-icon'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/status-badge'
import { MAX_TAGS_DISPLAY } from '../constants'
import { parseTags } from '../lib/filters'
import { isTokenBasedModel } from '../lib/model-helpers'
import { formatPrice } from '../lib/price'
import type { PricingModel } from '../types'

// ----------------------------------------------------------------------------
// Model Row Component
// ----------------------------------------------------------------------------

export interface ModelRowProps {
  model: PricingModel
  onClick: () => void
}

export function ModelRow({ model, onClick }: ModelRowProps) {
  const tags = parseTags(model.tags).slice(0, MAX_TAGS_DISPLAY)
  const isTokenBased = isTokenBasedModel(model)
  const vendorIcon = model.vendor_icon
    ? getLobeIcon(model.vendor_icon, 14)
    : null

  return (
    <button
      onClick={onClick}
      className='hover:bg-accent/5 group w-full px-6 py-6 text-left transition-colors'
    >
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8'>
        {/* Model Info */}
        <div className='min-w-0 flex-1 space-y-2.5'>
          {/* Title */}
          <div className='space-y-1'>
            <h3 className='text-foreground text-base font-medium'>
              {model.model_name}
            </h3>
            {model.vendor_name && (
              <div className='flex items-center gap-1.5'>
                {vendorIcon}
                <p className='text-muted-foreground text-sm'>
                  {model.vendor_name}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          {model.description && (
            <p className='text-muted-foreground line-clamp-2 text-sm leading-relaxed'>
              {model.description}
            </p>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className='flex flex-wrap gap-1.5'>
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
        <div className='flex shrink-0 flex-col items-start gap-1.5 sm:items-end'>
          {isTokenBased ? (
            <>
              <div className='flex items-center gap-3'>
                <div className='flex flex-col items-start gap-0.5 sm:items-end'>
                  <span className='text-muted-foreground text-[10px] font-medium tracking-wide uppercase'>
                    Input
                  </span>
                  <span className='text-foreground text-base font-semibold tabular-nums'>
                    {formatPrice(model, 'input', 'USD', 'M', false, 1, 1)}
                  </span>
                </div>
                <Separator orientation='vertical' className='h-8' decorative />
                <div className='flex flex-col items-start gap-0.5 sm:items-end'>
                  <span className='text-muted-foreground text-[10px] font-medium tracking-wide uppercase'>
                    Output
                  </span>
                  <span className='text-foreground text-base font-semibold tabular-nums'>
                    {formatPrice(model, 'output', 'USD', 'M', false, 1, 1)}
                  </span>
                </div>
              </div>
              <span className='text-muted-foreground text-xs'>
                per 1M tokens
              </span>
            </>
          ) : (
            <StatusBadge
              label='Pay per request'
              variant='neutral'
              size='sm'
              copyable={false}
            />
          )}
        </div>
      </div>
    </button>
  )
}

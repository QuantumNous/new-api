import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'
import type { PricingModel } from '../types'
import { ModelRow } from './model-row'

// ----------------------------------------------------------------------------
// Virtual Model List Component
// ----------------------------------------------------------------------------

export interface VirtualModelListProps {
  models: PricingModel[]
  onModelClick: (modelName: string) => void
  estimateSize?: number
  overscan?: number
  priceRate?: number
  usdExchangeRate?: number
}

export function VirtualModelList({
  models,
  onModelClick,
  estimateSize = 140,
  overscan = 5,
  priceRate = 1,
  usdExchangeRate = 1,
}: VirtualModelListProps) {
  // Window-based virtualizer - page scroll controls virtualization
  const virtualizer = useWindowVirtualizer({
    count: models.length,
    estimateSize: () => estimateSize,
    overscan,
    measureElement:
      typeof window !== 'undefined' &&
      navigator.userAgent.indexOf('Firefox') === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
  })

  const items = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  return (
    <div
      className='border-border/40 rounded-lg border'
      style={{ height: `${totalSize}px`, position: 'relative' }}
    >
      <div
        style={{
          height: `${totalSize}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualItem) => {
          const model = models[virtualItem.index]
          const isLast = virtualItem.index === models.length - 1
          const reactKey =
            model.id != null
              ? `m-${model.id}`
              : `${model.vendor_id ?? model.vendor_name ?? 'v-unknown'}-${model.model_name}-${virtualItem.index}`

          return (
            <div
              key={reactKey}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className={cn(
                'border-border/30 absolute top-0 left-0 w-full',
                !isLast && 'border-b'
              )}
              style={{
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <ModelRow
                model={model}
                priceRate={priceRate}
                usdExchangeRate={usdExchangeRate}
                onClick={() => onModelClick(model.model_name || '')}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

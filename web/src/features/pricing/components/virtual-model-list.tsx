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
}

export function VirtualModelList({
  models,
  onModelClick,
  estimateSize = 140,
  overscan = 5,
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

          return (
            <div
              key={model.model_name}
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
                onClick={() => onModelClick(model.model_name || '')}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

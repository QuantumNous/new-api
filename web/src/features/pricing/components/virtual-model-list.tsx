import { useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
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
  height?: string | number
  overscan?: number
}

export function VirtualModelList({
  models,
  onModelClick,
  estimateSize = 140,
  height = '70vh',
  overscan = 5,
}: VirtualModelListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  // Memoize virtualizer to prevent unnecessary re-calculations
  const virtualizer = useVirtualizer({
    count: models.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    measureElement:
      typeof window !== 'undefined' &&
      navigator.userAgent.indexOf('Firefox') === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
  })

  const items = virtualizer.getVirtualItems()

  // Calculate the height style
  const heightStyle = useMemo(() => {
    if (typeof height === 'number') return `${height}px`
    return height
  }, [height])

  // Memoize total size to reduce recalculations
  const totalSize = virtualizer.getTotalSize()

  return (
    <div
      ref={parentRef}
      className='border-border/40 overflow-auto rounded-lg border'
      style={{
        height: heightStyle,
        maxHeight: 'calc(100vh - 20rem)',
        contain: 'strict',
      }}
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

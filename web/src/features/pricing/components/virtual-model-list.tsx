import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { DEFAULT_TOKEN_UNIT } from '../constants'
import type { PricingModel, TokenUnit } from '../types'
import { ModelRow } from './model-row'

export interface VirtualModelListProps {
  models: PricingModel[]
  onModelClick: (modelName: string) => void
  estimateSize?: number
  overscan?: number
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
}

export function VirtualModelList(props: VirtualModelListProps) {
  const estimateSize = props.estimateSize ?? 130
  const overscan = props.overscan ?? 5
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT

  const virtualizer = useWindowVirtualizer({
    count: props.models.length,
    estimateSize: () => estimateSize,
    overscan,
    measureElement:
      typeof window !== 'undefined' && !navigator.userAgent.includes('Firefox')
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
  })

  const items = virtualizer.getVirtualItems()

  if (props.models.length === 0) {
    return null
  }

  return (
    <div
      className='overflow-hidden rounded-lg border'
      style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
    >
      {items.map((virtualItem) => {
        const model = props.models[virtualItem.index]
        const key =
          model.id ??
          `${model.vendor_name}-${model.model_name}-${virtualItem.index}`

        return (
          <div
            key={key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            className='absolute top-0 left-0 w-full'
            style={{ transform: `translateY(${virtualItem.start}px)` }}
          >
            <ModelRow
              model={model}
              priceRate={props.priceRate}
              usdExchangeRate={props.usdExchangeRate}
              tokenUnit={tokenUnit}
              showRechargePrice={props.showRechargePrice}
              onClick={() => props.onModelClick(model.model_name || '')}
            />
          </div>
        )
      })}
    </div>
  )
}

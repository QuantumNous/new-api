import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DEFAULT_PRICING_PAGE_SIZE, DEFAULT_TOKEN_UNIT } from '../constants'
import type { PricingModel, TokenUnit } from '../types'
import { ModelCard } from './model-card'

export interface ModelCardGridProps {
  models: PricingModel[]
  onModelClick: (modelName: string) => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
}

export function ModelCardGrid(props: ModelCardGridProps) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const pageSize = DEFAULT_PRICING_PAGE_SIZE
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const totalPages = Math.max(1, Math.ceil(props.models.length / pageSize))

  useEffect(() => {
    setPage(1)
  }, [props.models])

  const pagedModels = useMemo(() => {
    const start = (page - 1) * pageSize
    return props.models.slice(start, start + pageSize)
  }, [page, pageSize, props.models])

  if (props.models.length === 0) {
    return null
  }

  return (
    <div className='space-y-4 sm:space-y-5'>
      <div className='grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3'>
        {pagedModels.map((model) => (
          <ModelCard
            key={model.id ?? model.model_name}
            model={model}
            tokenUnit={tokenUnit}
            priceRate={props.priceRate}
            usdExchangeRate={props.usdExchangeRate}
            showRechargePrice={props.showRechargePrice}
            onClick={() => props.onModelClick(model.model_name || '')}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className='text-muted-foreground flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:flex-row'>
          <p className='text-muted-foreground'>
            {t('Page {{current}} of {{total}}', {
              current: page,
              total: totalPages,
            })}
          </p>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className='gap-1.5'
            >
              <ChevronLeft className='size-4' />
              {t('Previous')}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages}
              className='gap-1.5'
            >
              {t('Next')}
              <ChevronRight className='size-4' />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

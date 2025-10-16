import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/status-badge'
import type { PricingModel } from '../api'
import { formatPrice } from '../utils/price-calculator'

type PricingCardViewProps = {
  models: PricingModel[]
  currency: 'USD' | 'CNY'
  tokenUnit: 'M' | 'K'
  showWithRecharge: boolean
  priceRate: number
  usdExchangeRate: number
  filterButton?: React.ReactNode
}

export function PricingCardView({
  models,
  currency,
  tokenUnit,
  showWithRecharge,
  priceRate,
  usdExchangeRate,
  filterButton,
}: PricingCardViewProps) {
  const navigate = useNavigate({ from: '/pricing' })
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20
  const { copyToClipboard } = useCopyToClipboard()

  const filteredModels = useMemo(() => {
    if (!searchTerm) return models

    const searchLower = searchTerm.toLowerCase()
    return models.filter(
      (model) =>
        model.model_name?.toLowerCase().includes(searchLower) ||
        model.description?.toLowerCase().includes(searchLower) ||
        model.tags?.toLowerCase().includes(searchLower) ||
        model.vendor_name?.toLowerCase().includes(searchLower)
    )
  }, [models, searchTerm])

  const totalPages = Math.ceil(filteredModels.length / pageSize)
  const paginatedModels = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredModels.slice(startIndex, startIndex + pageSize)
  }, [filteredModels, currentPage])

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleCopyModelName = (modelName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    copyToClipboard(modelName)
  }

  const handleCardClick = (modelName: string) => {
    navigate({
      to: '/pricing/$modelId',
      params: { modelId: modelName },
      search: (prev) => prev,
    })
  }

  return (
    <div className='flex justify-center'>
      <div className='w-full max-w-3xl space-y-6'>
        {/* Search bar - no border */}
        <div className='flex items-center justify-between gap-4 py-4'>
          <div className='flex flex-1 items-center gap-2'>
            <Input
              placeholder='Search models...'
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className='h-9 w-full max-w-[300px]'
            />
            {filterButton}
          </div>
          <div className='text-muted-foreground text-sm'>
            {filteredModels.length} models
          </div>
        </div>

        {/* Models list */}
        {paginatedModels.length > 0 ? (
          <div>
            {paginatedModels.map((model, index) => (
              <div key={model.model_name}>
                <div
                  className='cursor-pointer space-y-3 py-6 transition-opacity hover:opacity-70'
                  onClick={() => handleCardClick(model.model_name || '')}
                >
                  {/* Model name with copy button */}
                  <div className='flex items-center gap-2'>
                    <h3 className='text-foreground text-lg font-bold'>
                      {model.model_name}
                    </h3>
                    <button
                      onClick={(e) =>
                        handleCopyModelName(model.model_name || '', e)
                      }
                      className='text-muted-foreground hover:text-foreground inline-flex h-6 w-6 items-center justify-center rounded transition-colors'
                      title='Copy model name'
                    >
                      <Copy className='h-4 w-4' />
                    </button>
                  </div>

                  {/* Description */}
                  {model.description && (
                    <p className='text-muted-foreground line-clamp-2 text-sm leading-relaxed'>
                      {model.description}
                    </p>
                  )}

                  {/* Metadata bar */}
                  <div className='text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs'>
                    {model.vendor_name && (
                      <>
                        <span>by {model.vendor_name}</span>
                        <span className='text-border'>|</span>
                      </>
                    )}

                    {model.quota_type === 0 ? (
                      <>
                        <span className='font-mono'>
                          {formatPrice(
                            model,
                            'input',
                            currency,
                            tokenUnit,
                            showWithRecharge,
                            priceRate,
                            usdExchangeRate
                          )}
                          /{tokenUnit} input tokens
                        </span>
                        <span className='text-border'>|</span>
                        <span className='font-mono'>
                          {formatPrice(
                            model,
                            'output',
                            currency,
                            tokenUnit,
                            showWithRecharge,
                            priceRate,
                            usdExchangeRate
                          )}
                          /{tokenUnit} output tokens
                        </span>
                      </>
                    ) : (
                      <span>Pay Per Request</span>
                    )}
                  </div>

                  {/* Tags */}
                  {model.tags && model.tags.trim() && (
                    <div className='flex flex-wrap gap-1.5'>
                      {model.tags
                        .split(/[,;|\s]+/)
                        .map((tag) => tag.trim())
                        .filter(Boolean)
                        .map((tag, idx) => (
                          <StatusBadge
                            key={idx}
                            label={tag}
                            autoColor={tag}
                            copyable={false}
                            size='sm'
                          />
                        ))}
                    </div>
                  )}
                </div>

                {/* Separator between cards */}
                {index < paginatedModels.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        ) : (
          <div className='text-muted-foreground py-12 text-center'>
            No models found.
          </div>
        )}

        {/* Pagination - no border */}
        {totalPages > 1 && (
          <div className='flex items-center justify-between py-4'>
            <div className='text-muted-foreground text-sm'>
              Page {currentPage} of {totalPages}
            </div>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className='size-4' />
                Previous
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className='size-4' />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

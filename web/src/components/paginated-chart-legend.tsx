'use client'

import * as React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface LegendPayloadItem {
  value: string
  type?: string
  color?: string
  payload?: any
  dataKey?: string
  [key: string]: any
}

interface PaginatedChartLegendContentProps extends React.ComponentProps<'div'> {
  payload?: LegendPayloadItem[]
  verticalAlign?: 'top' | 'bottom'
  hideIcon?: boolean
  itemsPerPage?: number
}

export function PaginatedChartLegendContent({
  payload,
  className,
  hideIcon = false,
  verticalAlign = 'bottom',
  itemsPerPage = 12,
}: PaginatedChartLegendContentProps) {
  const { t } = useTranslation()
  const [currentPage, setCurrentPage] = React.useState(0)

  // Filter valid legend items
  const filteredPayload = React.useMemo(
    () => (payload || []).filter((item) => item.type !== 'none'),
    [payload]
  )

  const totalPages = Math.ceil(filteredPayload.length / itemsPerPage)
  const needsPagination = totalPages > 1

  // Reset to first page when data changes
  React.useEffect(() => {
    setCurrentPage(0)
  }, [filteredPayload.length])

  // Calculate items for current page
  const currentItems = React.useMemo(() => {
    const startIndex = currentPage * itemsPerPage
    const endIndex = Math.min(startIndex + itemsPerPage, filteredPayload.length)
    return filteredPayload.slice(startIndex, endIndex)
  }, [currentPage, itemsPerPage, filteredPayload])

  // Pagination handlers
  const handlePrevPage = React.useCallback(() => {
    setCurrentPage((prev) => Math.max(0, prev - 1))
  }, [])

  const handleNextPage = React.useCallback(() => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))
  }, [totalPages])

  // Keyboard navigation support
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowUp' && currentPage > 0) {
        handlePrevPage()
      } else if (event.key === 'ArrowDown' && currentPage < totalPages - 1) {
        handleNextPage()
      }
    },
    [currentPage, totalPages, handlePrevPage, handleNextPage]
  )

  if (!filteredPayload.length) {
    return null
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2',
        verticalAlign === 'top' ? 'pb-3' : 'pt-3',
        className
      )}
      role='group'
      aria-label={t('Chart legend')}
    >
      {/* Legend items */}
      <div
        className='flex flex-wrap items-center justify-center gap-4'
        role='list'
      >
        {currentItems.map((item, index) => {
          return (
            <div
              key={`${item.value}-${item.dataKey || ''}-${index}`}
              className={cn(
                '[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3'
              )}
              role='listitem'
            >
              {!hideIcon && (
                <div
                  className='h-2 w-2 shrink-0 rounded-[2px]'
                  style={{
                    backgroundColor: item.color,
                  }}
                  aria-hidden='true'
                />
              )}
              <span className='text-muted-foreground text-xs'>
                {item.value}
              </span>
            </div>
          )
        })}
      </div>

      {/* Pagination controls */}
      {needsPagination && (
        <div
          className='flex items-center gap-1'
          role='navigation'
          aria-label={t('Legend pagination')}
          onKeyDown={handleKeyDown}
        >
          <Button
            variant='ghost'
            size='icon'
            className='h-6 w-6'
            onClick={handlePrevPage}
            disabled={currentPage === 0}
            title={`Previous page (Page ${currentPage + 1} of ${totalPages})`}
            aria-label={`Previous page (Page ${currentPage + 1} of ${totalPages})`}
          >
            <ChevronUp className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className='h-6 w-6'
            onClick={handleNextPage}
            disabled={currentPage === totalPages - 1}
            title={`Next page (Page ${currentPage + 1} of ${totalPages})`}
            aria-label={`Next page (Page ${currentPage + 1} of ${totalPages})`}
          >
            <ChevronDown className='h-4 w-4' />
          </Button>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Cross2Icon } from '@radix-ui/react-icons'
import { type Table } from '@tanstack/react-table'
import { SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableFacetedFilter } from './faceted-filter'
import { DataTableViewOptions } from './view-options'

type DataTableToolbarProps<TData> = {
  table: Table<TData>
  searchPlaceholder?: string
  searchKey?: string
  filters?: {
    columnId: string
    title: string
    options: {
      label: string
      value: string
      icon?: React.ComponentType<{ className?: string }>
      iconNode?: React.ReactNode
      count?: number
    }[]
    singleSelect?: boolean
  }[]
  /** Custom search component to replace the default input */
  customSearch?: React.ReactNode
  /** Additional search input to show alongside the main search */
  additionalSearch?: React.ReactNode
  /** Whether additional filters are active (for showing reset button) */
  hasAdditionalFilters?: boolean
  /** Callback when reset button is clicked (for clearing additional filters) */
  onReset?: () => void
}

export function DataTableToolbar<TData>({
  table,
  searchPlaceholder,
  searchKey,
  filters = [],
  customSearch,
  additionalSearch,
  hasAdditionalFilters = false,
  onReset,
}: DataTableToolbarProps<TData>) {
  const { t } = useTranslation()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('Filter...')
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    table.getState().globalFilter ||
    hasAdditionalFilters

  const activeFilterCount =
    table.getState().columnFilters.length + (hasAdditionalFilters ? 1 : 0)
  const hasFilterContent = filters.length > 0 || additionalSearch != null

  const searchInput = searchKey ? (
    <Input
      placeholder={resolvedSearchPlaceholder}
      value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ''}
      onChange={(event) =>
        table.getColumn(searchKey)?.setFilterValue(event.target.value)
      }
      className='h-9 w-full sm:h-8 sm:w-[150px] lg:w-[250px]'
    />
  ) : (
    <Input
      placeholder={resolvedSearchPlaceholder}
      value={table.getState().globalFilter ?? ''}
      onChange={(event) => table.setGlobalFilter(event.target.value)}
      className='h-9 w-full sm:h-8 sm:w-[150px] lg:w-[250px]'
    />
  )

  const filterChips = filters.map((filter) => {
    const column = table.getColumn(filter.columnId)
    if (!column) return null
    return (
      <DataTableFacetedFilter
        key={filter.columnId}
        column={column}
        title={filter.title}
        options={filter.options}
        singleSelect={filter.singleSelect}
      />
    )
  })

  const resetButton = isFiltered ? (
    <Button
      variant='ghost'
      onClick={() => {
        table.resetColumnFilters()
        table.setGlobalFilter('')
        onReset?.()
      }}
      className='h-8 px-2 lg:px-3'
    >
      {t('Reset')}
      <Cross2Icon className='ms-2 h-4 w-4' />
    </Button>
  ) : null

  return (
    <div className='space-y-2'>
      <div className='flex items-center gap-1.5 sm:gap-2'>
        {/* Search input */}
        {customSearch !== undefined ? customSearch : searchInput}

        {/* Desktop: filters inline */}
        {additionalSearch && (
          <div className='hidden w-auto sm:block'>{additionalSearch}</div>
        )}
        <div className='hidden flex-wrap gap-2 sm:flex'>{filterChips}</div>
        <div className='hidden sm:block'>{resetButton}</div>

        {/* Mobile: filter toggle button */}
        {hasFilterContent && (
          <Button
            variant='outline'
            size='sm'
            className='relative h-9 shrink-0 gap-1 px-2 sm:hidden'
            onClick={() => setMobileFiltersOpen((v) => !v)}
          >
            <SlidersHorizontal className='h-3.5 w-3.5' />
            {activeFilterCount > 0 && (
              <Badge
                variant='secondary'
                className='h-4 min-w-4 rounded-full px-1 text-[10px] leading-none'
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        )}

        <DataTableViewOptions table={table} />
      </div>

      {/* Mobile: collapsible filter area */}
      {hasFilterContent && mobileFiltersOpen && (
        <div className='bg-muted/30 flex flex-wrap items-center gap-2 rounded-lg border p-2 sm:hidden'>
          {additionalSearch && <div className='w-full'>{additionalSearch}</div>}
          {filterChips}
          {resetButton}
        </div>
      )}
    </div>
  )
}

import { Cross2Icon } from '@radix-ui/react-icons'
import { type Table } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
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
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('Filter...')
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    table.getState().globalFilter ||
    hasAdditionalFilters

  return (
    <div className='flex items-center justify-between'>
      <div className='flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2'>
        {customSearch !== undefined ? (
          customSearch
        ) : searchKey ? (
          <Input
            placeholder={resolvedSearchPlaceholder}
            value={
              (table.getColumn(searchKey)?.getFilterValue() as string) ?? ''
            }
            onChange={(event) =>
              table.getColumn(searchKey)?.setFilterValue(event.target.value)
            }
            className='h-8 w-full sm:w-[150px] lg:w-[250px]'
          />
        ) : (
          <Input
            placeholder={resolvedSearchPlaceholder}
            value={table.getState().globalFilter ?? ''}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            className='h-8 w-full sm:w-[150px] lg:w-[250px]'
          />
        )}
        {additionalSearch && (
          <div className='w-full sm:w-auto'>{additionalSearch}</div>
        )}
        <div className='flex w-full flex-wrap gap-2 sm:w-auto'>
          {filters.map((filter) => {
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
          })}
        </div>
        {isFiltered && (
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
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  )
}

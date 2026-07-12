/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getExpandedRowModel,
  type OnChangeFn,
  type SortingState,
  type VisibilityState,
  type ExpandedState,
  type Row,
} from '@tanstack/react-table'
import { useDebounce, useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { getLobeIcon } from '@/lib/lobe-icon'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { cn, getPageNumbers } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DISABLED_ROW_DESKTOP,
  DISABLED_ROW_MOBILE,
  TableEmpty,
  TableSkeleton,
  MobileCardList,
} from '@/components/data-table'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Search01Icon,
  FilterResetIcon,
  Download01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons'
import { getChannels, searchChannels, getGroups } from '../api'
import {
  DEFAULT_PAGE_SIZE,
  CHANNEL_STATUS,
  CHANNEL_STATUS_OPTIONS,
} from '../constants'
import {
  channelsQueryKeys,
  aggregateChannelsByTag,
  isTagAggregateRow,
  getChannelTypeIcon,
  getChannelTypeLabel,
} from '../lib'
import type { Channel, ChannelSortBy } from '../types'
import { useChannelsColumns } from './channels-columns'
import { useChannels } from './channels-provider'
import { DataTableBulkActions } from './data-table-bulk-actions'

const route = getRouteApi('/_authenticated/channels/')

const CHANNEL_SORTABLE_COLUMNS = new Set<ChannelSortBy>([
  'id',
  'name',
  'priority',
  'balance',
  'response_time',
  'test_time',
])

function isDisabledChannelRow(channel: Channel) {
  return (
    !isTagAggregateRow(channel) && channel.status !== CHANNEL_STATUS.ENABLED
  )
}

export function ChannelsTable() {
  const { t } = useTranslation()
  const { enableTagMode, idSort } = useChannels()
  const isMobile = useMediaQuery('(max-width: 640px)')

  // Table state
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    models: false,
    tag: false,
  })
  const [rowSelection, setRowSelection] = useState({})
  const [expanded, setExpanded] = useState<ExpandedState>({})

  // URL state management
  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    persistKey: 'channels-filters',
    pagination: {
      defaultPage: 1,
      defaultPageSize: isMobile ? 10 : DEFAULT_PAGE_SIZE,
    },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: 'type', searchKey: 'type', type: 'array' },
      { columnId: 'group', searchKey: 'group', type: 'array' },
      { columnId: 'model', searchKey: 'model', type: 'string' },
    ],
  })

  // Extract filters from column filters
  const statusFilter =
    (columnFilters.find((f) => f.id === 'status')?.value as string[]) || []
  const typeFilter =
    (columnFilters.find((f) => f.id === 'type')?.value as string[]) || []
  const groupFilter =
    (columnFilters.find((f) => f.id === 'group')?.value as string[]) || []
  const modelFilterFromUrl =
    (columnFilters.find((f) => f.id === 'model')?.value as string) || ''

  // Local state for immediate input feedback
  const [modelFilterInput, setModelFilterInput] = useState(modelFilterFromUrl)
  const debouncedModelFilter = useDebounce(modelFilterInput, 500)

  // Sync local input with URL when URL changes (e.g., from back/forward navigation)
  useEffect(() => {
    setModelFilterInput(modelFilterFromUrl)
  }, [modelFilterFromUrl])

  // Update URL when debounced value changes
  useEffect(() => {
    if (debouncedModelFilter !== modelFilterFromUrl) {
      onColumnFiltersChange((prev) => {
        const filtered = prev.filter((f) => f.id !== 'model')
        return debouncedModelFilter
          ? [...filtered, { id: 'model', value: debouncedModelFilter }]
          : filtered
      })
    }
  }, [debouncedModelFilter, modelFilterFromUrl, onColumnFiltersChange])

  const modelFilter = modelFilterFromUrl

  // Determine whether to use search or regular list API
  const shouldSearch = Boolean(globalFilter?.trim() || modelFilter.trim())

  const sortParams = useMemo(() => {
    const activeSort = sorting[0]
    if (
      !activeSort ||
      !CHANNEL_SORTABLE_COLUMNS.has(activeSort.id as ChannelSortBy)
    ) {
      return {}
    }

    return {
      sort_by: activeSort.id as ChannelSortBy,
      sort_order: activeSort.desc ? 'desc' : 'asc',
    } as const
  }, [sorting])

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater
      if (pagination.pageIndex > 0) {
        onPaginationChange({ ...pagination, pageIndex: 0 })
      }
      return next
    })
  }

  // Fetch groups for filter
  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: getGroups,
  })

  const groupOptions = useMemo(
    () =>
      (groupsData?.data || []).map((g) => ({
        label: g,
        value: g,
      })),
    [groupsData]
  )

  // Fetch channels data
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const { data, isLoading, isFetching } = useQuery({
    queryKey: channelsQueryKeys.list({
      keyword: globalFilter,
      model: modelFilter,
      group:
        groupFilter.length > 0 && !groupFilter.includes('all')
          ? groupFilter[0]
          : undefined,
      status:
        statusFilter.length > 0 && !statusFilter.includes('all')
          ? statusFilter[0]
          : undefined,
      type:
        typeFilter.length > 0 && !typeFilter.includes('all')
          ? Number(typeFilter[0])
          : undefined,
      tag_mode: enableTagMode,
      id_sort: idSort,
      ...sortParams,
      p: pagination.pageIndex + 1,
      page_size: pagination.pageSize,
    }),
    queryFn: async () => {
      if (shouldSearch) {
        return searchChannels({
          keyword: globalFilter,
          model: modelFilter,
          group:
            groupFilter.length > 0 && !groupFilter.includes('all')
              ? groupFilter[0]
              : undefined,
          status:
            statusFilter.length > 0 && !statusFilter.includes('all')
              ? statusFilter[0]
              : undefined,
          type:
            typeFilter.length > 0 && !typeFilter.includes('all')
              ? Number(typeFilter[0])
              : undefined,
          tag_mode: enableTagMode,
          id_sort: idSort,
          ...sortParams,
          p: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
        })
      } else {
        return getChannels({
          group:
            groupFilter.length > 0 && !groupFilter.includes('all')
              ? groupFilter[0]
              : undefined,
          status:
            statusFilter.length > 0 && !statusFilter.includes('all')
              ? statusFilter[0]
              : undefined,
          type:
            typeFilter.length > 0 && !typeFilter.includes('all')
              ? Number(typeFilter[0])
              : undefined,
          tag_mode: enableTagMode,
          id_sort: idSort,
          ...sortParams,
          p: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
        })
      }
    },
    placeholderData: (previousData) => previousData,
  })

  // Apply tag aggregation if tag mode is enabled
  const channels = useMemo(() => {
    const rawChannels = data?.data?.items || []

    if (enableTagMode && rawChannels.length > 0) {
      return aggregateChannelsByTag(rawChannels)
    }

    return rawChannels
  }, [data, enableTagMode])

  const totalCount = data?.data?.total || 0
  const typeCounts = data?.data?.type_counts

  // Columns configuration
  const columns = useChannelsColumns()

  // React Table instance
  const table = useReactTable({
    data: channels,
    columns,
    pageCount: Math.ceil(totalCount / pagination.pageSize),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
      expanded,
      globalFilter,
    },
    enableRowSelection: (row: Row<Channel>) => !isTagAggregateRow(row.original),
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange,
    onExpandedChange: setExpanded,
    onGlobalFilterChange,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row: Channel & { children?: Channel[] }) => row.children,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  })

  // Ensure page is in range when total count changes
  const pageCount = table.getPageCount()
  useEffect(() => {
    ensurePageInRange(pageCount)
  }, [pageCount, ensurePageInRange])

  // Prepare filter options from existing channel types only.
  const typeFilterOptions = useMemo(() => {
    const counts = typeCounts || {}
    const typeIds = Object.entries(counts)
      .map(([type, count]) => ({
        type: Number(type),
        count: Number(count) || 0,
      }))
      .filter((item) => item.type > 0 && item.count > 0)
      .sort((a, b) => {
        const labelA = t(getChannelTypeLabel(a.type))
        const labelB = t(getChannelTypeLabel(b.type))
        return labelA.localeCompare(labelB)
      })

    const selectedType = typeFilter.find((value) => value !== 'all')
    if (selectedType) {
      const selectedTypeId = Number(selectedType)
      const alreadyIncluded = typeIds.some(
        (item) => item.type === selectedTypeId
      )
      if (selectedTypeId > 0 && !alreadyIncluded) {
        typeIds.push({
          type: selectedTypeId,
          count: Number(counts[selectedType]) || 0,
        })
      }
    }

    const totalTypes = Object.values(counts).reduce(
      (sum, count) => sum + (Number(count) || 0),
      0
    )

    return [
      {
        label: t('All Types'),
        value: 'all',
        count: totalTypes,
      },
      ...typeIds.map((item) => {
        const iconName = getChannelTypeIcon(item.type)
        return {
          label: getChannelTypeLabel(item.type),
          value: String(item.type),
          count: item.count,
          iconNode: getLobeIcon(`${iconName}.Color`, 16),
        }
      }),
    ]
  }, [t, typeCounts, typeFilter])

  const groupFilterOptions = [
    { label: t('All Groups'), value: 'all' },
    ...groupOptions,
  ]

  // Filter handlers
  const handleStatusFilterChange = (value: string) => {
    const column = table.getColumn('status')
    if (!column) return
    if (value === 'all') {
      column.setFilterValue([])
    } else {
      column.setFilterValue([value])
    }
  }

  const handleTypeFilterChange = (value: string) => {
    const column = table.getColumn('type')
    if (!column) return
    if (value === 'all') {
      column.setFilterValue([])
    } else {
      column.setFilterValue([value])
    }
  }

  const handleGroupFilterChange = (value: string) => {
    const column = table.getColumn('group')
    if (!column) return
    if (value === 'all') {
      column.setFilterValue([])
    } else {
      column.setFilterValue([value])
    }
  }

  const currentStatusValue =
    statusFilter.length > 0 && !statusFilter.includes('all')
      ? statusFilter[0]
      : 'all'
  const currentTypeValue =
    typeFilter.length > 0 && !typeFilter.includes('all')
      ? typeFilter[0]
      : 'all'
  const currentGroupValue =
    groupFilter.length > 0 && !groupFilter.includes('all')
      ? groupFilter[0]
      : 'all'

  // Is filtered?
  const isFiltered =
    !!globalFilter ||
    columnFilters.some((f) => {
      const value = f.value as string[]
      return value && value.length > 0 && !value.includes('all')
    }) ||
    !!modelFilter

  // Reset filters
  const handleReset = () => {
    table.resetColumnFilters()
    table.setGlobalFilter('')
    setModelFilterInput('')
    onColumnFiltersChange((prev) => prev.filter((f) => f.id !== 'model'))
  }

  // Pagination
  const currentPage = table.getState().pagination.pageIndex + 1
  const totalPages = table.getPageCount()
  const pageNumbers = getPageNumbers(currentPage, totalPages)
  const startRow =
    totalCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const endRow = Math.min(
    (pagination.pageIndex + 1) * pagination.pageSize,
    totalCount
  )

  // Rows
  const rows = table.getRowModel().rows

  return (
    <div className='space-y-6'>
      {/* Filter Bar */}
      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative'>
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={2}
            className='pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground'
          />
          <Input
            placeholder={t('Filter by name, ID, or key...')}
            value={globalFilter ?? ''}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            className='h-8 w-full pl-8 text-xs sm:w-[240px] lg:w-[280px]'
          />
        </div>

        <Input
          placeholder={t('Filter by model...')}
          value={modelFilterInput}
          onChange={(e) => setModelFilterInput(e.target.value)}
          className='h-8 w-full text-xs sm:w-[150px] lg:w-[180px]'
        />

        <Select
          value={currentStatusValue}
          onValueChange={handleStatusFilterChange}
        >
          <SelectTrigger className='h-8 w-[130px] text-xs'>
            <SelectValue>
              {(value: string) => {
                if (value === 'all') return t('All Status')
                const opt = CHANNEL_STATUS_OPTIONS.find(
                  (o) => o.value === value
                )
                return opt ? t(opt.label) : value
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {[...CHANNEL_STATUS_OPTIONS].map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t(opt.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentTypeValue}
          onValueChange={handleTypeFilterChange}
        >
          <SelectTrigger className='h-8 w-[130px] text-xs'>
            <SelectValue>
              {(value: string) => {
                const opt = typeFilterOptions.find((o) => o.value === value)
                if (!opt) return value
                if (value === 'all') return opt.label
                return t(opt.label)
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {typeFilterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {typeof option.label === 'string' && option.value === 'all'
                  ? option.label
                  : t(option.label)}
                {option.count != null ? ` (${option.count})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentGroupValue}
          onValueChange={handleGroupFilterChange}
        >
          <SelectTrigger className='h-8 w-[130px] text-xs'>
            <SelectValue>
              {(value: string) => {
                const opt = groupFilterOptions.find((o) => o.value === value)
                return opt ? opt.label : value
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {groupFilterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant='ghost'
          size='sm'
          onClick={handleReset}
          className='h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground'
        >
          <HugeiconsIcon
            icon={FilterResetIcon}
            strokeWidth={2}
            className='size-3'
          />
          {t('Reset')}
        </Button>
      </div>

      {/* Table Wrap */}
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-border bg-card transition-opacity duration-150',
          isFetching && !isLoading && 'pointer-events-none opacity-60'
        )}
      >
        {/* Toolbar */}
        <div className='flex items-center justify-between border-b border-border px-4 py-3'>
          <span className='text-sm text-muted-foreground'>
            {t('Total {{count}} channels', { count: totalCount })}
          </span>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground'
          >
            <HugeiconsIcon
              icon={Download01Icon}
              strokeWidth={2}
              className='size-3'
            />
            {t('Export')}
          </Button>
        </div>

        {/* Desktop Table */}
        {!isMobile && (
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader className='bg-muted/30'>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        style={{ width: header.getSize() }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeleton
                    table={table}
                    keyPrefix='channel-skeleton'
                  />
                ) : rows.length === 0 ? (
                  <TableEmpty
                    colSpan={columns.length}
                    title={t('No Channels Found')}
                    description={t(
                      'No channels available. Create your first channel to get started.'
                    )}
                  />
                ) : (
                  rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={
                        row.getIsSelected() ? 'selected' : undefined
                      }
                      className={
                        isDisabledChannelRow(row.original)
                          ? DISABLED_ROW_DESKTOP
                          : undefined
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Mobile Card List */}
        {isMobile && (
          <MobileCardList
            table={table}
            isLoading={isLoading}
            emptyTitle={t('No Channels Found')}
            emptyDescription={t(
              'No channels available. Create your first channel to get started.'
            )}
          />
        )}

        {/* Footer */}
        <div className='flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground'>
          <span>
            {t('Showing {{start}} to {{end}} of {{total}}', {
              start: startRow,
              end: endRow,
              total: totalCount,
            })}
          </span>

          {totalPages > 0 && (
            <div className='flex items-center gap-0.5'>
              <Button
                variant='ghost'
                className='h-6.5 w-6.5 p-0 text-xs'
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <HugeiconsIcon
                  icon={ArrowLeft01Icon}
                  strokeWidth={2}
                  className='size-3.5'
                />
              </Button>

              {pageNumbers.map((pageNumber, index) => (
                <div
                  key={`${pageNumber}-${index}`}
                  className='flex items-center'
                >
                  {pageNumber === '...' ? (
                    <span className='px-1 text-muted-foreground'>...</span>
                  ) : (
                    <Button
                      variant={
                        currentPage === pageNumber ? 'default' : 'ghost'
                      }
                      className='h-6.5 min-w-6.5 px-1.5 text-xs'
                      onClick={() =>
                        table.setPageIndex((pageNumber as number) - 1)
                      }
                    >
                      {pageNumber}
                    </Button>
                  )}
                </div>
              ))}

              <Button
                variant='ghost'
                className='h-6.5 w-6.5 p-0 text-xs'
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  className='size-3.5'
                />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {!isMobile && Object.keys(rowSelection).length > 0 && (
        <DataTableBulkActions table={table} />
      )}
    </div>
  )
}

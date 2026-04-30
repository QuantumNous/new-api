import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Database } from 'lucide-react'
import { useTableUrlState } from '@/hooks/use-table-url-state'
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
  DataTablePagination,
  DataTableToolbar,
  TableSkeleton,
  TableEmpty,
} from '@/components/data-table'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { PageFooterPortal } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import { getApiKeys, searchApiKeys } from '../api'
import {
  API_KEY_STATUS,
  API_KEY_STATUS_OPTIONS,
  API_KEY_STATUSES,
  ERROR_MESSAGES,
} from '../constants'
import { type ApiKey } from '../types'
import { ApiKeyCell } from './api-keys-cells'
import { useApiKeysColumns } from './api-keys-columns'
import { ApiKeysPrimaryButtons } from './api-keys-primary-buttons'
import { useApiKeys } from './api-keys-provider'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { DataTableRowActions } from './data-table-row-actions'

const route = getRouteApi('/_authenticated/keys/')

function isDisabledApiKeyRow(apiKey: ApiKey) {
  return apiKey.status !== API_KEY_STATUS.ENABLED
}

function ApiKeysMobileSkeleton() {
  return (
    <div className='divide-border overflow-hidden rounded-lg border'>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className='space-y-2 border-b px-3 py-2.5 last:border-b-0'
        >
          <div className='flex items-center justify-between'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-5 w-16 rounded-full' />
          </div>
          <div className='flex items-center justify-between gap-3'>
            <Skeleton className='h-7 w-44' />
            <Skeleton className='h-8 w-16' />
          </div>
          <Skeleton className='h-3 w-28' />
        </div>
      ))}
    </div>
  )
}

function ApiKeysMobileList({
  table,
  isLoading,
}: {
  table: ReturnType<typeof useReactTable<ApiKey>>
  isLoading: boolean
}) {
  const { t } = useTranslation()
  const rows = table.getRowModel().rows

  if (isLoading) return <ApiKeysMobileSkeleton />

  if (!rows.length) {
    return (
      <div className='rounded-lg border p-8'>
        <Empty className='border-none p-0'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <Database className='size-6' />
            </EmptyMedia>
            <EmptyTitle>{t('No API Keys Found')}</EmptyTitle>
            <EmptyDescription>
              {t(
                'No API keys available. Create your first API key to get started.'
              )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className='divide-border overflow-hidden rounded-lg border'>
      {rows.map((row) => {
        const apiKey = row.original
        const statusConfig = API_KEY_STATUSES[apiKey.status]
        const total = apiKey.used_quota + apiKey.remain_quota

        return (
          <div
            key={row.id}
            className={cn(
              'bg-card space-y-2.5 border-b px-3 py-2.5 last:border-b-0',
              isDisabledApiKeyRow(apiKey) && DISABLED_ROW_MOBILE
            )}
          >
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <div className='truncate text-sm font-semibold'>
                  {apiKey.name}
                </div>
                <div className='text-muted-foreground text-[11px]'>
                  {t('API Key')}
                </div>
              </div>
              {statusConfig && (
                <StatusBadge
                  label={t(statusConfig.label)}
                  variant={statusConfig.variant}
                  showDot={statusConfig.showDot}
                  copyable={false}
                />
              )}
            </div>

            <div className='flex min-w-0 items-center justify-between gap-2'>
              <div className='min-w-0 flex-1 [&_button:first-child]:max-w-full [&_button:first-child]:truncate [&_button:first-child]:px-0'>
                <ApiKeyCell apiKey={apiKey} />
              </div>
              <DataTableRowActions row={row} />
            </div>

            <div className='flex items-center justify-between gap-2 text-xs'>
              <span className='text-muted-foreground'>{t('Quota')}</span>
              {apiKey.unlimited_quota ? (
                <span className='font-medium'>{t('Unlimited')}</span>
              ) : (
                <span className='font-medium tabular-nums'>
                  {formatQuota(apiKey.remain_quota)}
                  <span className='text-muted-foreground font-normal'>
                    {' / '}
                    {formatQuota(total)}
                  </span>
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ApiKeysTable() {
  const { t } = useTranslation()
  const { refreshTrigger } = useApiKeys()
  const columns = useApiKeysColumns()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [rowSelection, setRowSelection] = useState({})
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

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
    pagination: { defaultPage: 1, defaultPageSize: 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [{ columnId: 'status', searchKey: 'status', type: 'array' }],
  })

  // Fetch data with React Query
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'keys',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      refreshTrigger,
    ],
    queryFn: async () => {
      // If there's a global filter, use search
      const hasFilter = globalFilter?.trim()

      if (hasFilter) {
        const result = await searchApiKeys({ keyword: globalFilter })
        if (!result.success) {
          toast.error(result.message || t(ERROR_MESSAGES.SEARCH_FAILED))
          return { items: [], total: 0 }
        }
        return {
          items: result.data || [],
          total: result.data?.length || 0,
        }
      }

      // Otherwise use pagination
      const result = await getApiKeys({
        p: pagination.pageIndex + 1,
        size: pagination.pageSize,
      })

      if (!result.success) {
        toast.error(result.message || t(ERROR_MESSAGES.LOAD_FAILED))
        return { items: [], total: 0 }
      }

      return {
        items: result.data?.items || [],
        total: result.data?.total || 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const apiKeys = data?.items || []

  const table = useReactTable({
    data: apiKeys,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      globalFilter,
      pagination,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: (row, _columnId, filterValue) => {
      const name = String(row.getValue('name')).toLowerCase()
      const key = String(row.original.key).toLowerCase()
      const searchValue = String(filterValue).toLowerCase()

      return name.includes(searchValue) || key.includes(searchValue)
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: !globalFilter,
    pageCount: globalFilter
      ? Math.ceil((data?.total || 0) / pagination.pageSize)
      : Math.ceil((data?.total || 0) / pagination.pageSize),
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    ensurePageInRange(pageCount)
  }, [pageCount, ensurePageInRange])

  return (
    <>
      <div className='space-y-3 sm:space-y-4'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
          <ApiKeysPrimaryButtons />
          <div className='min-w-0 sm:flex sm:justify-end'>
            <DataTableToolbar
              table={table}
              searchPlaceholder={t('Filter by name or key...')}
              filters={[
                {
                  columnId: 'status',
                  title: t('Status'),
                  options: API_KEY_STATUS_OPTIONS,
                },
              ]}
            />
          </div>
        </div>
        {isMobile ? (
          <ApiKeysMobileList
            table={table}
            isLoading={isLoading}
          />
        ) : (
          <div
            className={cn(
              'overflow-hidden rounded-md border transition-opacity duration-150',
              isFetching && !isLoading && 'pointer-events-none opacity-50'
            )}
          >
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
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
                  <TableSkeleton table={table} keyPrefix='api-keys-skeleton' />
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableEmpty
                    colSpan={columns.length}
                    title={t('No API Keys Found')}
                    description={t(
                      'No API keys available. Create your first API key to get started.'
                    )}
                  />
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                      className={cn(
                        isDisabledApiKeyRow(row.original) &&
                          DISABLED_ROW_DESKTOP
                      )}
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
        {!isMobile && <DataTableBulkActions table={table} />}
      </div>
      <PageFooterPortal>
        <DataTablePagination table={table} />
      </PageFooterPortal>
    </>
  )
}

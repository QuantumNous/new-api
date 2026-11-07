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
import { useQuery } from '@tanstack/react-query'
import type {
  ColumnFiltersState,
  OnChangeFn,
  PaginationState,
} from '@tanstack/react-table'
import { RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { createServerError } from '@/lib/server-error-message'

import { getPaymentLogs } from '../api'
import { buildPaymentLogQuery } from '../lib/query'
import { usePaymentLogColumns } from './payment-logs-columns'
import { PaymentLogsFilters } from './payment-logs-filters'

const DEFAULT_PAGE_SIZE = 20

export function PaymentLogsTable() {
  const { t } = useTranslation()
  const columns = usePaymentLogColumns()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  })
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [provider, setProvider] = useState('')
  // Dates are held as ISO Gregorian calendar values (YYYY-MM-DD); the query
  // builder converts them once, at the API boundary.
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // The table only needs to know which filters are active; the strings above
  // stay the single source of truth for every request.
  const columnFilters = useMemo<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = []
    if (status) filters.push({ id: 'status', value: [status] })
    if (provider) filters.push({ id: 'payment_provider', value: [provider] })
    return filters
  }, [status, provider])

  const resetPage = () =>
    setPagination((previous) =>
      previous.pageIndex === 0 ? previous : { ...previous, pageIndex: 0 }
    )

  const handleKeywordChange: OnChangeFn<string> = (updater) => {
    setKeyword((previous) =>
      typeof updater === 'function' ? updater(previous) : updater
    )
    resetPage()
  }

  const handleStatusChange = (value: string) => {
    setStatus(value)
    resetPage()
  }

  const handleProviderChange = (value: string) => {
    setProvider(value)
    resetPage()
  }

  const handleFromDateChange = (value: string) => {
    setFromDate(value)
    resetPage()
  }

  const handleToDateChange = (value: string) => {
    setToDate(value)
    resetPage()
  }

  const handleResetFilters = () => {
    setKeyword('')
    setStatus('')
    setProvider('')
    setFromDate('')
    setToDate('')
    setPagination((previous) =>
      previous.pageIndex === 0 ? previous : { ...previous, pageIndex: 0 }
    )
  }

  const handlePaginationChange: OnChangeFn<PaginationState> = (updater) => {
    setPagination((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater
      // A new page size restarts at the first page: keeping page N after
      // switching to a larger size can land past the last page.
      return next.pageSize === previous.pageSize
        ? next
        : { ...next, pageIndex: 0 }
    })
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'payment-logs',
      pagination.pageIndex + 1,
      pagination.pageSize,
      keyword,
      status,
      provider,
      fromDate,
      toDate,
    ],
    queryFn: async () => {
      const result = await getPaymentLogs(
        buildPaymentLogQuery({
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          keyword,
          status,
          provider,
          fromDate,
          toDate,
        })
      )
      if (!result.success) {
        throw createServerError(result, t('Failed to load payment logs'))
      }
      return {
        items: result.data?.items ?? [],
        total: result.data?.total ?? 0,
      }
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30 * 1000,
  })

  const entries = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize))

  // Keep the requested page inside the range the server just reported, e.g.
  // when a filter shrinks the result set while page N was open.
  useEffect(() => {
    if (pagination.pageIndex > totalPages - 1) {
      setPagination((previous) => ({
        ...previous,
        pageIndex: Math.max(0, totalPages - 1),
      }))
    }
  }, [pagination.pageIndex, totalPages])

  const { table } = useDataTable({
    data: entries,
    columns,
    globalFilter: keyword,
    onGlobalFilterChange: handleKeywordChange,
    columnFilters,
    pagination,
    onPaginationChange: handlePaginationChange,
    manualPagination: true,
    manualFiltering: true,
    enableSorting: false,
    totalCount: total,
  })

  const hasActiveFilters = Boolean(
    keyword || status || provider || fromDate || toDate
  )

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No payment records found')}
      emptyDescription={t('No payment records match the current filters.')}
      emptyAction={
        hasActiveFilters ? (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={handleResetFilters}
            className='gap-1.5'
          >
            <RotateCcw className='size-4' aria-hidden='true' />
            {t('Reset')}
          </Button>
        ) : undefined
      }
      skeletonKeyPrefix='payment-logs-skeleton'
      applyHeaderSize
      toolbar={
        <PaymentLogsFilters
          keyword={keyword}
          status={status}
          provider={provider}
          fromDate={fromDate}
          toDate={toDate}
          onKeywordChange={handleKeywordChange}
          onStatusChange={handleStatusChange}
          onProviderChange={handleProviderChange}
          onFromDateChange={handleFromDateChange}
          onToDateChange={handleToDateChange}
          onReset={handleResetFilters}
        />
      }
    />
  )
}

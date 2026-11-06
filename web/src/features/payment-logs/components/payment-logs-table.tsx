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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createServerError } from '@/lib/server-error-message'

import { getPaymentLogs } from '../api'
import {
  getPaymentProviderOptions,
  getPaymentStatusOptions,
} from '../constants'
import { buildPaymentLogQuery } from '../lib/query'
import { usePaymentLogColumns } from './payment-logs-columns'

const DEFAULT_PAGE_SIZE = 20

export function PaymentLogsTable() {
  const { t } = useTranslation()
  const columns = usePaymentLogColumns()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  })
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const statusFilter = columnFilters.find(
    (filter) => filter.id === 'status'
  )?.value
  const status = Array.isArray(statusFilter)
    ? String(statusFilter[0] ?? '')
    : String(statusFilter ?? '')
  const providerFilter = columnFilters.find(
    (filter) => filter.id === 'payment_provider'
  )?.value
  const provider = Array.isArray(providerFilter)
    ? String(providerFilter[0] ?? '')
    : String(providerFilter ?? '')

  const resetPage = () => {
    setPagination((previous) =>
      previous.pageIndex === 0 ? previous : { ...previous, pageIndex: 0 }
    )
  }

  const handleGlobalFilterChange: OnChangeFn<string> = (updater) => {
    setGlobalFilter(updater)
    resetPage()
  }

  const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (
    updater
  ) => {
    setColumnFilters(updater)
    resetPage()
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'payment-logs',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
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
          keyword: globalFilter,
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

  const { table } = useDataTable({
    data: entries,
    columns,
    globalFilter,
    columnFilters,
    pagination,
    onGlobalFilterChange: handleGlobalFilterChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onPaginationChange: setPagination,
    manualPagination: true,
    manualFiltering: true,
    totalCount: data?.total ?? 0,
  })

  const statusOptions = useMemo(() => getPaymentStatusOptions(t), [t])
  const providerOptions = useMemo(() => getPaymentProviderOptions(t), [t])

  const dateRange = (
    <div className='flex flex-wrap items-end gap-2'>
      <div className='space-y-1'>
        <Label htmlFor='payment-logs-from' className='text-xs'>
          {t('From date')}
        </Label>
        <Input
          id='payment-logs-from'
          type='date'
          value={fromDate}
          onChange={(event) => {
            setFromDate(event.target.value)
            resetPage()
          }}
          className='h-8 w-[150px]'
        />
      </div>
      <div className='space-y-1'>
        <Label htmlFor='payment-logs-to' className='text-xs'>
          {t('To date')}
        </Label>
        <Input
          id='payment-logs-to'
          type='date'
          value={toDate}
          onChange={(event) => {
            setToDate(event.target.value)
            resetPage()
          }}
          className='h-8 w-[150px]'
        />
      </div>
    </div>
  )

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No payment records found')}
      emptyDescription={t('No payment records match the current filters.')}
      skeletonKeyPrefix='payment-logs-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t(
          'Search by trade number, email, username, or user ID...'
        ),
        searchDebounceMs: 500,
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: statusOptions,
            singleSelect: true,
          },
          {
            columnId: 'payment_provider',
            title: t('Payment gateway'),
            options: providerOptions,
            singleSelect: true,
          },
        ],
        additionalSearch: dateRange,
        hasAdditionalFilters: Boolean(fromDate || toDate),
        onReset: () => {
          setFromDate('')
          setToDate('')
          resetPage()
        },
      }}
    />
  )
}

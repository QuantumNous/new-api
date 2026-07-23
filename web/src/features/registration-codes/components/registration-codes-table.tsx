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
import { getRouteApi } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  DISABLED_ROW_DESKTOP,
  DISABLED_ROW_MOBILE,
  DataTablePage,
  useDataTable,
} from '@/components/data-table'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'

import { getRegistrationCodes, searchRegistrationCodes } from '../api'
import {
  ERROR_MESSAGES,
  REGISTRATION_CODE_STATUS,
  getRegistrationCodeStatusOptions,
} from '../constants'
import { isRegistrationCodeExpired } from '../lib'
import type { RegistrationCode } from '../types'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { useRegistrationCodesColumns } from './registration-codes-columns'
import { RegistrationCodesMobileList } from './registration-codes-mobile-list'
import { useRegistrationCodes } from './registration-codes-provider'

const route = getRouteApi('/_authenticated/registration-codes/')

function isDisabledRegistrationCodeRow(registrationCode: RegistrationCode) {
  return (
    registrationCode.status !== REGISTRATION_CODE_STATUS.UNUSED ||
    isRegistrationCodeExpired(
      registrationCode.expired_time,
      registrationCode.status
    )
  )
}

export function RegistrationCodesTable() {
  const { t } = useTranslation()
  const columns = useRegistrationCodesColumns()
  const { refreshTrigger } = useRegistrationCodes()
  const isMobile = useMediaQuery('(max-width: 640px)')

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
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [{ columnId: 'status', searchKey: 'status', type: 'array' }],
  })
  const statusFilter =
    (columnFilters.find((filter) => filter.id === 'status')?.value as
      | string[]
      | undefined) ?? []
  const statusFilterValue = statusFilter[0] ?? ''

  // Fetch data with React Query
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'registration-codes',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      statusFilterValue,
      refreshTrigger,
    ],
    queryFn: async () => {
      const hasFilter = globalFilter?.trim()
      const hasStatusFilter = statusFilterValue !== ''
      const params = {
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      }

      const result =
        hasFilter || hasStatusFilter
          ? await searchRegistrationCodes({
              ...params,
              keyword: globalFilter,
              status: statusFilterValue,
            })
          : await getRegistrationCodes(params)

      if (!result.success) {
        toast.error(
          result.message ||
            t(
              hasFilter || hasStatusFilter
                ? ERROR_MESSAGES.SEARCH_FAILED
                : ERROR_MESSAGES.LOAD_FAILED
            )
        )
        return { items: [], total: 0 }
      }

      return {
        items: result.data?.items || [],
        total: result.data?.total || 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const registrationCodes = data?.items || []

  const { table } = useDataTable({
    data: registrationCodes,
    columns,
    enableRowSelection: true,
    columnFilters,
    globalFilter,
    pagination,
    globalFilterFn: (row, _columnId, filterValue) => {
      const name = String(row.getValue('name')).toLowerCase()
      const id = String(row.getValue('id'))
      const searchValue = String(filterValue).toLowerCase()

      return name.includes(searchValue) || id.includes(searchValue)
    },
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: true,
    manualFiltering: true,
    totalCount: data?.total || 0,
    ensurePageInRange,
  })

  const registrationCodeStatusOptions = useMemo(
    () => getRegistrationCodeStatusOptions(t),
    [t]
  )

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No Registration Codes Found')}
      emptyDescription={t(
        'No registration codes available. Create your first registration code to get started.'
      )}
      skeletonKeyPrefix='registration-codes-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Filter by name or ID...'),
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: registrationCodeStatusOptions,
            singleSelect: true,
          },
        ],
      }}
      mobile={
        <RegistrationCodesMobileList table={table} isLoading={isLoading} />
      }
      getRowClassName={(row, { isMobile }) => {
        if (!isDisabledRegistrationCodeRow(row.original)) return undefined
        return isMobile ? DISABLED_ROW_MOBILE : DISABLED_ROW_DESKTOP
      }}
      bulkActions={<DataTableBulkActions table={table} />}
    />
  )
}

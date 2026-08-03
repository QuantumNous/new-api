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
*/
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  DataTablePage,
  useDataTable,
} from '@/components/data-table'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'

import { listSlaIncidents } from '../api'
import { ERROR_MESSAGES, getSlaIncidentStatusOptions } from '../constants'
import { useSlaIncidentsColumns } from './sla-incidents-columns'
import { SlaIncidentsMobileList } from './sla-incidents-mobile-list'
import { useSlaIncidents } from './sla-incidents-provider'

const route = getRouteApi('/_authenticated/sla-incidents/')

export function SlaIncidentsTable() {
  const { t } = useTranslation()
  const columns = useSlaIncidentsColumns()
  const { refreshTrigger } = useSlaIncidents()
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
    globalFilter: { enabled: false, key: 'filter' },
    columnFilters: [{ columnId: 'status', searchKey: 'status', type: 'array' }],
  })

  const statusFilter =
    (columnFilters.find((filter) => filter.id === 'status')?.value as
      | string[]
      | undefined) ?? []
  const statusFilterValue = statusFilter[0] ?? ''

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'sla-incidents',
      pagination.pageIndex + 1,
      pagination.pageSize,
      statusFilterValue,
      refreshTrigger,
    ],
    queryFn: async () => {
      const result = await listSlaIncidents({
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        status: statusFilterValue || undefined,
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

  const slaIncidents = data?.items || []

  const { table } = useDataTable({
    data: slaIncidents,
    columns,
    enableRowSelection: true,
    columnFilters,
    globalFilter,
    pagination,
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: true,
    manualFiltering: true,
    totalCount: data?.total || 0,
    ensurePageInRange,
  })

  const statusOptions = useMemo(
    () => getSlaIncidentStatusOptions(t),
    [t]
  )

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No SLA Incidents Found')}
      emptyDescription={t(
        'No SLA incidents available. Create your first incident to get started.'
      )}
      skeletonKeyPrefix='sla-incidents-skeleton'
      applyHeaderSize
      toolbarProps={{
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: statusOptions,
            singleSelect: true,
          },
        ],
      }}
      mobile={<SlaIncidentsMobileList table={table} isLoading={isLoading} />}
    />
  )
}

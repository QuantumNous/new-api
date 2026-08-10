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
import type { PaginationState } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { getChannels } from '@/features/channels/api'
import type { Channel } from '@/features/channels/types'
import {
  DataTablePage,
  useDataTable,
} from '@/components/data-table'
import { useMediaQuery } from '@/hooks'

import { listRegionRoutes } from '../api'
import { ERROR_MESSAGES } from '../constants'
import { buildChannelNameMap } from '../lib'
import type { RegionRoute } from '../types'
import { useRegionRoutesColumns } from './region-routes-columns'
import { RegionRoutesMobileList } from './region-routes-mobile-list'
import { useRegionRoutes } from './region-routes-provider'

export function RegionRoutesTable() {
  const { t } = useTranslation()
  const { refreshTrigger } = useRegionRoutes()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: isMobile ? 10 : 20,
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['region-routes', refreshTrigger],
    queryFn: async () => {
      const result = await listRegionRoutes({ page: 1, page_size: 1000 })
      if (!result.success) {
        toast.error(result.message || t(ERROR_MESSAGES.LOAD_FAILED))
        return { items: [] as RegionRoute[] }
      }
      return { items: result.data?.items ?? [] }
    },
    placeholderData: (previousData) => previousData,
  })

  const { data: channelsData } = useQuery({
    queryKey: ['region-routes-channels'],
    queryFn: async () => {
      const result = await getChannels({ page_size: 1000, id_sort: true })
      return (result.data?.items ?? []) as Channel[]
    },
  })

  const channelNameById = useMemo(
    () => buildChannelNameMap(channelsData ?? []),
    [channelsData]
  )

  const columns = useRegionRoutesColumns(channelNameById)
  const routes = data?.items ?? []

  const { table } = useDataTable({
    data: routes,
    columns,
    manualPagination: false,
    manualFiltering: false,
    manualSorting: false,
    globalFilter,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const route = row.original as RegionRoute
      const q = String(filterValue).toLowerCase().trim()
      if (!q) return true
      return (
        route.region.toLowerCase().includes(q) ||
        (route.model || '*').toLowerCase().includes(q) ||
        route.strategy.toLowerCase().includes(q) ||
        route.tag.toLowerCase().includes(q) ||
        String(route.id).includes(q)
      )
    },
    enableRowSelection: true,
    pagination,
    onPaginationChange: setPagination,
    autoResetPageIndex: false,
  })

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No Region Routes Found')}
      emptyDescription={t(
        'No region routes available. Create your first region route to get started.'
      )}
      skeletonKeyPrefix='region-routes-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Search by region, model, strategy, tag...'),
      }}
      mobile={<RegionRoutesMobileList table={table} isLoading={isLoading} />}
    />
  )
}

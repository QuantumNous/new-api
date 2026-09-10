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
import type { PaginationState } from '@tanstack/react-table'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useDataTable } from '@/components/data-table'

import { getUsageRanking } from '../../api'
import { getDefaultTimeRange } from '../../lib/utils'
import type {
  UsageRankingData,
  UsageRankingItem,
  UsageRankingParams,
} from '../../types'
import {
  getUsageRankingRowKey,
  useUsageRankingColumns,
} from './usage-ranking-columns'
import {
  UsageRankingFilterBar,
  type UsageRankingFilters,
} from './usage-ranking-filter-bar'
import { UsageRankingMobileList } from './usage-ranking-mobile-list'
import { UsageRankingSummary } from './usage-ranking-summary'
import { UsageRankingTable } from './usage-ranking-table'

const EMPTY_RANKING_DATA: UsageRankingData = {
  items: [],
  total: 0,
  page: 1,
  page_size: 20,
  summary: {
    quota: 0,
    request_count: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    active_user_count: 0,
  },
}

function createDefaultRankingFilters(): UsageRankingFilters {
  const range = getDefaultTimeRange()
  return {
    startTime: range.start,
    endTime: range.end,
    modelName: '',
    channel: '',
    group: '',
    sortBy: 'quota',
  }
}

function buildRankingParams(
  filters: UsageRankingFilters,
  pagination: PaginationState
): UsageRankingParams {
  const channel = Number(filters.channel)
  return {
    start_timestamp: Math.floor(filters.startTime.getTime() / 1000),
    end_timestamp: Math.floor(filters.endTime.getTime() / 1000),
    model_name: filters.modelName || undefined,
    channel:
      filters.channel && Number.isFinite(channel) && channel >= 0
        ? channel
        : undefined,
    group: filters.group || undefined,
    sort_by: filters.sortBy,
    p: pagination.pageIndex + 1,
    page_size: pagination.pageSize,
  }
}

export function UsageRankingView() {
  const { t } = useTranslation()
  const [defaultFilters] = useState(createDefaultRankingFilters)
  const [draftFilters, setDraftFilters] = useState(defaultFilters)
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters)
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [refreshVersion, setRefreshVersion] = useState(0)

  const toggleRow = useCallback((rowKey: string) => {
    setExpandedRows((current) => {
      const next = new Set(current)
      if (next.has(rowKey)) {
        next.delete(rowKey)
      } else {
        next.add(rowKey)
      }
      return next
    })
  }, [])

  const params = useMemo(
    () => buildRankingParams(appliedFilters, pagination),
    [appliedFilters, pagination]
  )
  const rankingQuery = useQuery({
    queryKey: ['usage-ranking', params, refreshVersion, t],
    queryFn: async () => {
      const response = await getUsageRanking(params)
      if (!response.success) {
        toast.error(response.message || t('Failed to load usage ranking'))
        return EMPTY_RANKING_DATA
      }
      return response.data ?? EMPTY_RANKING_DATA
    },
    placeholderData: (previousData) => previousData,
  })
  const ranking = rankingQuery.data ?? EMPTY_RANKING_DATA
  const columns = useUsageRankingColumns({
    expandedRows,
    onToggleRow: toggleRow,
  })
  const { table } = useDataTable<UsageRankingItem>({
    data: ranking.items,
    columns,
    totalCount: ranking.total,
    pagination,
    onPaginationChange: setPagination,
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    enableRowSelection: false,
    getRowId: getUsageRankingRowKey,
    columnVisibilityStorageKey: 'usage-ranking:column-visibility',
  })

  const applyFilters = useCallback(() => {
    setAppliedFilters({ ...draftFilters })
    setPagination((current) => ({ ...current, pageIndex: 0 }))
    setExpandedRows(new Set())
    setRefreshVersion((version) => version + 1)
  }, [draftFilters])

  const resetFilters = useCallback(() => {
    const defaults = createDefaultRankingFilters()
    setDraftFilters(defaults)
    setAppliedFilters(defaults)
    setPagination((current) => ({ ...current, pageIndex: 0 }))
    setExpandedRows(new Set())
    setRefreshVersion((version) => version + 1)
  }, [])

  const hasActiveFilters =
    draftFilters.startTime.getTime() !== defaultFilters.startTime.getTime() ||
    draftFilters.endTime.getTime() !== defaultFilters.endTime.getTime() ||
    draftFilters.modelName !== '' ||
    draftFilters.channel !== '' ||
    draftFilters.group !== '' ||
    draftFilters.sortBy !== 'quota'
  const loading = rankingQuery.isLoading && ranking.items.length === 0

  return (
    <UsageRankingTable
      table={table}
      columns={columns}
      loading={loading}
      fetching={rankingQuery.isFetching}
      expandedRows={expandedRows}
      toolbar={
        <div className='flex flex-col gap-3'>
          <UsageRankingSummary summary={ranking.summary} loading={loading} />
          <UsageRankingFilterBar
            table={table}
            filters={draftFilters}
            onChange={setDraftFilters}
            onSearch={applyFilters}
            onReset={resetFilters}
            searchLoading={rankingQuery.isFetching}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      }
      mobile={
        <UsageRankingMobileList
          items={ranking.items}
          loading={loading}
          expandedRows={expandedRows}
          onToggleRow={toggleRow}
        />
      }
    />
  )
}

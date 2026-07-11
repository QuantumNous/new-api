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
import type { Row, PaginationState } from '@tanstack/react-table'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTablePagination,
  DataTableRow,
  DataTableView,
  useDataTable,
} from '@/components/data-table'
import { getPerfMetricsSummary } from '@/features/performance-metrics/api'

import { DEFAULT_PRICING_PAGE_SIZE, DEFAULT_TOKEN_UNIT } from '../constants'
import type { PricingModel, TokenUnit } from '../types'
import type { ModelPerfBadgeData } from './model-perf-badge'
import { usePricingColumns } from './pricing-columns'

export interface PricingTableProps {
  models: PricingModel[]
  isLoading?: boolean
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
  onModelClick?: (modelName: string) => void
}

export function PricingTable(props: PricingTableProps) {
  const { t } = useTranslation()
  const {
    models,
    isLoading = false,
    priceRate = 1,
    usdExchangeRate = 1,
    tokenUnit = DEFAULT_TOKEN_UNIT,
    showRechargePrice = false,
    selectedGroup,
    onModelClick,
  } = props

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PRICING_PAGE_SIZE,
  })

  useEffect(() => {
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
    )
  }, [models])

  const perfQuery = useQuery({
    queryKey: ['perf-metrics-summary', 24],
    queryFn: () => getPerfMetricsSummary(24),
    staleTime: 60 * 1000,
    retry: false,
  })

  const perfMap = useMemo(() => {
    const map = new Map<string, ModelPerfBadgeData>()
    for (const model of perfQuery.data?.data?.models ?? []) {
      map.set(model.model_name, model)
    }
    return map
  }, [perfQuery.data])

  const columns = usePricingColumns({
    tokenUnit,
    priceRate,
    usdExchangeRate,
    showRechargePrice,
    selectedGroup,
    perfMap,
  })

  const { table } = useDataTable({
    data: models,
    columns,
    pageCount: Math.ceil(models.length / pagination.pageSize),
    pagination,
    onPaginationChange: setPagination,
    manualPagination: false,
    withFilteredRowModel: false,
    withSortedRowModel: false,
    withFacetedRowModel: false,
  })

  const handleRowClick = useCallback(
    (model: PricingModel) => {
      onModelClick?.(model.model_name)
    },
    [onModelClick]
  )

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>, model: PricingModel) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      handleRowClick(model)
    },
    [handleRowClick]
  )

  return (
    <div className='space-y-4'>
      <DataTableView
        table={table}
        isLoading={isLoading}
        emptyTitle={t('No Models Found')}
        emptyDescription={t('No models match your current filters.')}
        skeletonKeyPrefix='pricing-skeleton'
        applyHeaderSize
        getColumnClassName={(_columnId, kind) =>
          kind === 'header' ? 'text-muted-foreground font-medium' : undefined
        }
        renderRow={(row: Row<PricingModel>) => (
          <DataTableRow
            key={row.id}
            row={row}
            tabIndex={0}
            aria-label={`${t('View details')}: ${row.original.model_name}`}
            className='hover:bg-muted/30 focus-visible:ring-ring cursor-pointer transition-colors focus-visible:ring-2 focus-visible:outline-none'
            onClick={() => handleRowClick(row.original)}
            onKeyDown={(event) => handleRowKeyDown(event, row.original)}
          />
        )}
      />

      {!isLoading && models.length > 0 && <DataTablePagination table={table} />}
    </div>
  )
}

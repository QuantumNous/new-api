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
import { useState, useCallback, useMemo, useEffect } from 'react'
import { type Row, type PaginationState } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import {
  DataTablePagination,
  DataTableRow,
  DataTableView,
  useDataTable,
} from '@/components/data-table'
import { usePerfBadgeMap } from '../hooks/use-perf-badge-map'
import { DEFAULT_PRICING_PAGE_SIZE, DEFAULT_TOKEN_UNIT } from '../constants'
import type { PricingModel, TokenUnit } from '../types'
import { usePricingColumns } from './pricing-columns'

export interface PricingTableProps {
  models: PricingModel[]
  isLoading?: boolean
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  /** When true, only show badges backed by real probe/relay samples (no mock fill). */
  selectedGroup?: string
  liveMetricsOnly?: boolean
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
    liveMetricsOnly = false,
    onModelClick,
  } = props

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PRICING_PAGE_SIZE,
  })

  // Match card grid: filters that change `models` should snap back to page 1.
  useEffect(() => {
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }))
  }, [models])

  // Badge only the current page to avoid O(N) work on large catalogs.
  const pageModels = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize
    return models.slice(start, start + pagination.pageSize)
  }, [models, pagination.pageIndex, pagination.pageSize])

  const { perfMap } = usePerfBadgeMap({
    models: pageModels,
    liveMetricsOnly,
  })

  const columns = usePricingColumns({
    tokenUnit,
    priceRate,
    usdExchangeRate,
    showRechargePrice,
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
            className='hover:bg-muted/30 cursor-pointer transition-colors'
            onClick={() => handleRowClick(row.original)}
          />
        )}
      />

      {!isLoading && models.length > 0 && <DataTablePagination table={table} />}
    </div>
  )
}

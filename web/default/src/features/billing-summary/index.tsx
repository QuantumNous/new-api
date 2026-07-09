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
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { DataTablePage } from '@/components/data-table'
import { SectionPageLayout } from '@/components/layout'
import { getBillingSummary } from './api'
import { buildBillingSummaryColumns } from './components/billing-summary-columns'
import { BillingSummaryFilterBar } from './components/billing-summary-filter-bar'
import { getDefaultBillingTimeRange } from './lib/utils'
import type { BillingSummaryFilters, BillingTableRow } from './types'

export function BillingSummaryPage() {
  const { t } = useTranslation()
  const [filters, setFilters] = useState<BillingSummaryFilters>(() => {
    const { start, end } = getDefaultBillingTimeRange()
    return { startTime: start, endTime: end }
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['billing-summary', filters],
    queryFn: () => getBillingSummary(filters),
  })

  const rows = useMemo(() => (data?.success ? (data.data ?? []) : []), [data])

  // Prepend a synthetic "Total" row so the summed cost/revenue/profit/margin
  // render as a real, always-first table row instead of a separate element.
  const tableRows = useMemo<BillingTableRow[]>(() => {
    if (rows.length === 0) return []
    const totals = rows.reduce(
      (acc, row) => ({
        cost_usd: acc.cost_usd + row.cost_usd,
        revenue_usd: acc.revenue_usd + row.revenue_usd,
      }),
      { cost_usd: 0, revenue_usd: 0 }
    )
    return [{ day: 0, ...totals, isTotal: true }, ...rows]
  }, [rows])

  const columns = useMemo(() => buildBillingSummaryColumns(t), [t])

  const table = useReactTable({
    data: tableRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Platform Billing')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Daily cost, revenue, profit and margin across the platform')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <DataTablePage
          table={table}
          columns={columns}
          isLoading={isLoading}
          isFetching={isFetching}
          hideMobile
          showPagination={false}
          emptyTitle={t('No Data')}
          getRowClassName={(row) =>
            row.original.isTotal ? 'bg-muted/40 border-b-2' : undefined
          }
          toolbar={
            <BillingSummaryFilterBar
              table={table}
              isFetching={isFetching}
              onApply={setFilters}
            />
          }
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

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
import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatDay, formatUSD } from '../constants'
import type { BillingTableRow } from '../types'

// Profit and margin are derived here from cost/revenue — not sent by the
// backend, so they never go stale relative to the source numbers.
// 毛利 (margin) is intentionally profit/cost, not profit/revenue.
export function buildBillingSummaryColumns(
  t: (key: string) => string
): ColumnDef<BillingTableRow, unknown>[] {
  return [
    {
      accessorKey: 'day',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Date')} />
      ),
      cell: ({ row }) =>
        row.original.isTotal ? (
          <span className='text-sm font-semibold'>{t('Total')}</span>
        ) : (
          <span className='font-mono text-sm'>
            {formatDay(row.original.day)}
          </span>
        ),
    },
    {
      id: 'accounting_requests',
      header: () => <span>{t('Accounting OK / Requests (%)')}</span>,
      cell: ({ row }) => {
        const okCount = row.original.accounting_ok_request_count ?? 0
        const targetCount = row.original.accounting_target_request_count ?? 0
        const ratio = targetCount > 0 ? (okCount / targetCount) * 100 : null
        return (
          <span className='font-mono text-sm whitespace-nowrap'>
            {okCount} / {targetCount}
            <span className='text-xs text-muted-foreground'>
              {ratio == null ? '' : ` (${ratio.toFixed(1)}%)`}
            </span>
          </span>
        )
      },
    },
    {
      accessorKey: 'cost_usd',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Platform Cost')} />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-sm'>
          {formatUSD(row.original.cost_usd)}
        </span>
      ),
    },
    {
      accessorKey: 'revenue_usd',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Revenue')} />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-sm'>
          {formatUSD(row.original.revenue_usd)}
        </span>
      ),
    },
    {
      id: 'profit_usd',
      header: () => <span>{t('Profit')}</span>,
      cell: ({ row }) => {
        const profit = row.original.revenue_usd - row.original.cost_usd
        return (
          <span
            className={`font-mono text-sm ${profit < 0 ? 'text-destructive' : ''}`}
          >
            {formatUSD(profit)}
          </span>
        )
      },
    },
    {
      id: 'margin',
      header: () => <span>{t('Margin')}</span>,
      cell: ({ row }) => {
        const { cost_usd: cost, revenue_usd: revenue } = row.original
        if (cost <= 0)
          return <span className='text-muted-foreground text-sm'>—</span>
        const margin = ((revenue - cost) / cost) * 100
        return (
          <span
            className={`font-mono text-sm ${margin < 0 ? 'text-destructive' : ''}`}
          >
            {margin.toFixed(1)}%
          </span>
        )
      },
    },
  ]
}

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
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { KeyRound, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { Button } from '@/components/ui/button'
import { TitledCard } from '@/components/ui/titled-card'
import { DataTableColumnHeader, DataTablePage } from '@/components/data-table'
import { MaskedValueDisplay } from '@/components/masked-value-display'
import { StatusBadge } from '@/components/status-badge'
import { getSelfAffiliateCdkCodes } from '@/features/affiliate-commissions/api'
import type { AffiliateCdkCodeRecord } from '@/features/affiliate-commissions/types'
import {
  REDEMPTION_STATUS,
  REDEMPTION_STATUSES,
} from '@/features/redemption-codes/constants'
import {
  formatLocalPaymentAmount,
  formatUsdCreditAmount,
} from '@/features/wallet/lib'

const route = getRouteApi('/_authenticated/affiliate-cdk/')

function maskCode(key: string) {
  if (key.length <= 16) {
    return `${key.slice(0, 4)}${'*'.repeat(8)}${key.slice(-4)}`
  }
  return `${key.slice(0, 8)}${'*'.repeat(16)}${key.slice(-8)}`
}

function useAffiliateCdkCodeColumns(): ColumnDef<AffiliateCdkCodeRecord>[] {
  const { t } = useTranslation()

  return useMemo(
    () => [
      {
        id: 'cdk',
        accessorKey: 'key',
        meta: { label: t('CDK'), mobileTitle: true },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('CDK')} />
        ),
        cell: ({ row }) => {
          const key = row.original.key
          return (
            <div className='max-w-[320px] min-w-[220px]'>
              <MaskedValueDisplay
                label={t('Full CDK')}
                fullValue={key}
                maskedValue={maskCode(key)}
                copyTooltip={t('Copy CDK')}
                copyAriaLabel={t('Copy CDK')}
              />
            </div>
          )
        },
        enableSorting: false,
      },
      {
        accessorKey: 'code_amount',
        meta: { label: t('CDK face value') },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('CDK face value')} />
        ),
        cell: ({ row }) => (
          <div className='font-medium tabular-nums'>
            {formatUsdCreditAmount(row.original.code_amount)}
          </div>
        ),
      },
      {
        accessorKey: 'unit_pay_amount',
        meta: { label: t('Unit purchase cost') },
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('Unit purchase cost')}
          />
        ),
        cell: ({ row }) => {
          const code = row.original
          const unitPayAmount = code.unit_pay_amount || code.pay_amount
          return (
            <div className='min-w-[150px]'>
              <div className='font-medium tabular-nums'>
                {formatLocalPaymentAmount(unitPayAmount)}
              </div>
              <div className='text-muted-foreground text-xs'>
                {t('Order {{amount}} · {{count}} CDKs', {
                  amount: formatLocalPaymentAmount(code.pay_amount),
                  count: code.order_quantity || 1,
                })}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'status',
        meta: { label: t('Status'), mobileBadge: true },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Status')} />
        ),
        cell: ({ row }) => {
          const statusConfig = REDEMPTION_STATUSES[row.original.status]
          if (!statusConfig) return null
          return (
            <StatusBadge
              label={t(statusConfig.labelKey)}
              variant={statusConfig.variant}
              showDot={statusConfig.showDot}
              copyable={false}
            />
          )
        },
      },
      {
        accessorKey: 'used_username',
        meta: { label: t('Redeemed by') },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Redeemed by')} />
        ),
        cell: ({ row }) => {
          const username = row.original.used_username?.trim()
          return username ? (
            <StatusBadge label={username} variant='neutral' copyable={false} />
          ) : (
            <span className='text-muted-foreground text-sm'>-</span>
          )
        },
      },
      {
        accessorKey: 'redeemed_time',
        meta: { label: t('Redeemed at') },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Redeemed at')} />
        ),
        cell: ({ row }) => (
          <div className='min-w-[140px] font-mono text-xs'>
            {formatTimestampToDate(row.original.redeemed_time)}
          </div>
        ),
      },
      {
        id: 'order',
        accessorKey: 'source_order_id',
        meta: { label: t('Order info') },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Order info')} />
        ),
        cell: ({ row }) => {
          const code = row.original
          return (
            <div className='min-w-[160px] text-sm'>
              <div className='font-medium tabular-nums'>
                {t('Order #{{id}}', { id: code.source_order_id })}
              </div>
              <div className='text-muted-foreground text-xs'>
                {code.payment_method || '-'}
              </div>
              <div className='text-muted-foreground font-mono text-xs'>
                {formatTimestampToDate(code.order_complete_time)}
              </div>
            </div>
          )
        },
      },
    ],
    [t]
  )
}

export function AffiliateCdkCodesTable() {
  const { t } = useTranslation()
  const { copyToClipboard } = useCopyToClipboard()
  const columns = useAffiliateCdkCodeColumns()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const search = route.useSearch()

  const {
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: 10 },
    globalFilter: { enabled: false },
    columnFilters: [{ columnId: 'status', searchKey: 'status', type: 'array' }],
  })

  const statusValues = Array.isArray(search.status) ? search.status : []
  const statusFilter = statusValues[0] ? Number(statusValues[0]) : undefined

  const codesQuery = useQuery({
    queryKey: [
      'self-affiliate-cdk-codes',
      pagination.pageIndex + 1,
      pagination.pageSize,
      statusFilter || '',
    ],
    queryFn: async () => {
      const result = await getSelfAffiliateCdkCodes({
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        status: statusFilter,
      })

      return {
        items: result.success ? result.data?.items || [] : [],
        total: result.success ? result.data?.total || 0 : 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const codes = codesQuery.data?.items || []
  const pageCount = Math.max(
    1,
    Math.ceil((codesQuery.data?.total || 0) / pagination.pageSize)
  )
  const availableCodes = codes.filter(
    (code) => code.status === REDEMPTION_STATUS.ENABLED
  )

  const table = useReactTable({
    data: codes,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange,
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
    manualFiltering: true,
    pageCount,
  })

  useEffect(() => {
    ensurePageInRange(pageCount)
  }, [pageCount, ensurePageInRange])

  const statusOptions = useMemo(
    () =>
      Object.values(REDEMPTION_STATUSES).map((config) => ({
        label: t(config.labelKey),
        value: String(config.value),
      })),
    [t]
  )

  const copyCurrentPageAvailableCodes = async () => {
    if (availableCodes.length === 0) return
    await copyToClipboard(availableCodes.map((code) => code.key).join('\n'))
  }

  return (
    <TitledCard
      title={t('Purchased CDKs')}
      description={t('Only paid orders with generated CDKs are shown.')}
      icon={<KeyRound className='h-4 w-4' />}
      action={
        <Button
          variant='outline'
          size='sm'
          className='w-full gap-2 sm:w-auto'
          disabled={codesQuery.isFetching}
          onClick={() => codesQuery.refetch()}
        >
          <RefreshCw
            className={cn('h-4 w-4', codesQuery.isFetching && 'animate-spin')}
          />
          {t('Refresh')}
        </Button>
      }
      contentClassName='min-w-0'
    >
      <DataTablePage
        table={table}
        columns={columns}
        isLoading={codesQuery.isLoading}
        isFetching={codesQuery.isFetching}
        emptyTitle={t('No purchased CDKs')}
        emptyDescription={t(
          'Pay for a CDK order, then generated codes will appear here.'
        )}
        skeletonKeyPrefix='affiliate-cdk-codes-skeleton'
        paginationInFooter={false}
        tableClassName='overflow-x-auto'
        toolbarProps={{
          customSearch: null,
          filters: [
            {
              columnId: 'status',
              title: t('Status'),
              options: statusOptions,
              singleSelect: true,
            },
          ],
          preActions: (
            <Button
              variant='outline'
              size='sm'
              className='gap-2'
              disabled={
                availableCodes.length === 0 ||
                codesQuery.isLoading ||
                codesQuery.isFetching
              }
              onClick={copyCurrentPageAvailableCodes}
            >
              <KeyRound className='h-4 w-4' />
              {t('Copy available CDKs on this page')}
            </Button>
          ),
          hideViewOptions: true,
        }}
      />
    </TitledCard>
  )
}

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
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { DataTablePage, useDataTable } from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { FilterInput } from '@/components/filter-input'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { getPaymentMethodName } from '@/features/wallet/lib/billing'
import { toIntlLocale } from '@/i18n/languages'
import { formatTimestampToDate, formatNumber } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'

import {
  getOrders,
  type SiteOrder,
  type OrderFilters,
  type OrderScope,
} from './api'
import { OrderDetail } from './order-detail'
import { OrderStatus } from './order-status'
import { paymentAmount } from './presentation'

const emptyFilters: OrderFilters = {
  keyword: '',
  user: '',
  provider: '',
  status: '',
  start: '',
  end: '',
}
const emptyOrders: SiteOrder[] = []
export function SiteOrders(props: { scope?: OrderScope }) {
  const scope = props.scope ?? 'site'
  const personal = scope === 'personal'
  const { t, i18n } = useTranslation()
  const userId = useAuthStore((state) => state.auth.user?.id)
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [filters, setFilters] = useState(emptyFilters)
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })
  const [selected, setSelected] = useState<number | null>(null)
  const updateFilters = (patch: Partial<OrderFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }
  const query = useQuery({
    queryKey: ['site-orders', scope, userId, 'list', filters, pagination],
    queryFn: () =>
      getOrders(filters, pagination.pageIndex + 1, pagination.pageSize, scope),
  })
  const columns: ColumnDef<SiteOrder>[] = [
    {
      accessorKey: 'create_time',
      header: t('Created Time'),
      cell: ({ row }) => formatTimestampToDate(row.original.create_time),
    },
    {
      accessorKey: 'username',
      header: t('User'),
      cell: ({ row }) => (
        <Link
          to='/users'
          search={{
            filter: row.original.username || String(row.original.user_id),
          }}
        >
          {row.original.username} (#{row.original.user_id})
        </Link>
      ),
    },
    {
      accessorKey: 'trade_no',
      header: t('Order number'),
      cell: ({ row }) => (
        <div className='flex items-center gap-1'>
          <Button variant='link' onClick={() => setSelected(row.original.id)}>
            {row.original.trade_no}
          </Button>
          <CopyButton value={row.original.trade_no} />
        </div>
      ),
    },
    {
      accessorKey: 'order_type',
      header: t('Type'),
      cell: ({ row }) =>
        row.original.order_type === 'subscription'
          ? t('Subscription')
          : t('Top-up'),
    },
    {
      accessorKey: 'payment_method',
      header: t('Payment Method'),
      cell: ({ row }) => (
        <>
          {getPaymentMethodName(row.original.payment_method, t)}
          {row.original.sandbox && (
            <span className='ml-2 text-amber-600'>{t('Sandbox')}</span>
          )}
        </>
      ),
    },
    {
      id: 'payment',
      header: t('Order amount'),
      cell: ({ row }) => (
        <>
          {paymentAmount(row.original)}
          {row.original.amount_fen === null && !row.original.currency && (
            <span className='text-muted-foreground block text-xs'>
              {t('Currency not recorded')}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'quota',
      header: t('Frozen quota'),
      cell: ({ row }) =>
        row.original.frozen_quota === null
          ? t('Not recorded')
          : formatNumber(row.original.frozen_quota, locale),
    },
    {
      accessorKey: 'order_status',
      header: t('Status'),
      cell: ({ row }) => <OrderStatus order={row.original} />,
    },
    {
      accessorKey: 'complete_time',
      header: t('Completed Time'),
      cell: ({ row }) =>
        row.original.complete_time
          ? formatTimestampToDate(row.original.complete_time)
          : '—',
    },
    {
      id: 'actions',
      header: t('Actions'),
      cell: ({ row }) => (
        <Button
          variant='outline'
          size='sm'
          onClick={() => setSelected(row.original.id)}
        >
          {t('Details')}
        </Button>
      ),
    },
  ]
  const visibleColumns = personal
    ? columns.filter(
        (column) =>
          column.id !== 'quota' &&
          !('accessorKey' in column && column.accessorKey === 'username')
      )
    : columns
  const { table } = useDataTable({
    data: query.data?.items ?? emptyOrders,
    columns: visibleColumns,
    totalCount: query.data?.total ?? 0,
    pagination,
    onPaginationChange: setPagination,
    manualPagination: true,
    manualFiltering: true,
    enableSorting: false,
    enableRowSelection: false,
  })
  const providerOptions = [
    { value: 'all', label: t('All') },
    ...[
      'alipay',
      'wechatpay',
      'epay',
      'stripe',
      'creem',
      'waffo',
      'waffo_pancake',
      'balance',
    ].map((value) => ({
      value,
      label:
        (
          { alipay: t('Alipay'), wechatpay: t('WeChat Pay') } as Record<
            string,
            string
          >
        )[value] ?? getPaymentMethodName(value, t),
    })),
  ]
  const statusOptions = [
    { value: 'all', label: t('All') },
    { value: 'pending', label: t('Awaiting payment') },
    { value: 'paid', label: t('Paid, awaiting credit') },
    { value: 'success', label: t('Completed') },
    { value: 'expired', label: t('Closed') },
    { value: 'failed', label: t('Failed') },
  ]
  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>
        {personal ? t('My orders') : t('Site orders')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex h-full min-h-0 flex-col'>
          <div className='mb-4 flex shrink-0 flex-wrap items-end gap-3'>
            {(['keyword', 'user', 'start', 'end'] as const)
              .filter((key) => !personal || key !== 'user')
              .map((key) => {
                const labels = {
                  keyword: t('Order or payment transaction number'),
                  user: t('Username or user ID'),
                  start: t('Start time'),
                  end: t('End time'),
                }
                return (
                  <div
                    key={key}
                    className='flex min-w-40 flex-1 flex-col gap-1'
                  >
                    <Label htmlFor={`order-${key}`}>{labels[key]}</Label>
                    {key === 'start' || key === 'end' ? (
                      <Input
                        id={`order-${key}`}
                        type='datetime-local'
                        value={filters[key]}
                        onChange={(event) =>
                          updateFilters({ [key]: event.target.value })
                        }
                      />
                    ) : (
                      <FilterInput
                        id={`order-${key}`}
                        maxLength={key === 'user' ? 64 : 128}
                        value={filters[key]}
                        onValueChange={(value) =>
                          updateFilters({ [key]: value })
                        }
                      />
                    )}
                  </div>
                )
              })}
            {(['provider', 'status'] as const).map((key) => (
              <div key={key} className='flex flex-col gap-1'>
                <Label htmlFor={`order-${key}`}>
                  {key === 'provider' ? t('Payment Method') : t('Status')}
                </Label>
                <Select
                  items={key === 'provider' ? providerOptions : statusOptions}
                  value={filters[key] || 'all'}
                  onValueChange={(value) =>
                    updateFilters({
                      [key]: value === 'all' ? '' : (value ?? ''),
                    })
                  }
                >
                  <SelectTrigger id={`order-${key}`} className='min-w-36'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(key === 'provider' ? providerOptions : statusOptions).map(
                      (option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className='min-h-0 flex-1'>
            {query.isError ? (
              <ErrorState onRetry={() => void query.refetch()} />
            ) : (
              <DataTablePage
                table={table}
                columns={visibleColumns}
                pinnedColumns={[{ columnId: 'actions', side: 'right' }]}
                toolbarProps={null}
                isLoading={query.isLoading}
                isFetching={query.isFetching}
                emptyTitle={t('No billing records found')}
              />
            )}
          </div>
          <OrderDetail
            key={selected}
            id={selected}
            scope={scope}
            onClose={() => setSelected(null)}
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

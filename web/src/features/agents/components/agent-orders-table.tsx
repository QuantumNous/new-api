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
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useAuthStore } from '@/stores/auth-store'

import { getAgentOrders } from '../api'
import { formatAgentPoints } from '../lib/money'
import {
  agentQueryKeys,
  agentUserQueryKey,
  localDateInputToTimestamp,
  retainSameAgentPage,
  timestampToLocalDateInput,
  type AgentWorkspaceSearch,
} from '../lib/workspace'
import type { AgentOrder } from '../types'
import { AgentTableShell } from './agent-table-shell'

type AgentOrdersTableProps = {
  search: AgentWorkspaceSearch
  onSearchChange: (updates: Partial<AgentWorkspaceSearch>) => void
}

export function AgentOrdersTable(props: AgentOrdersTableProps) {
  const { t } = useTranslation()
  const userID = useAuthStore((state) => state.auth.user?.id ?? 0)
  const page = props.search.p ?? 1
  const pageSize = props.search.page_size ?? 20
  const ordersQuery = useQuery({
    queryKey: agentUserQueryKey(
      agentQueryKeys.orders,
      userID,
      page,
      pageSize,
      props.search.plan_id,
      props.search.order_status,
      props.search.start_timestamp,
      props.search.end_timestamp
    ),
    queryFn: async () => {
      const response = await getAgentOrders({
        p: page,
        page_size: pageSize,
        plan_id: props.search.plan_id,
        status: props.search.order_status,
        start_timestamp: props.search.start_timestamp,
        end_timestamp: props.search.end_timestamp,
      })
      if (!response.success) throw new Error('Agent orders unavailable')
      return response.data
    },
    placeholderData: (previous, previousQuery) =>
      retainSameAgentPage(
        userID,
        typeof previousQuery?.queryKey[2] === 'number'
          ? previousQuery.queryKey[2]
          : undefined,
        previous
      ),
  })

  const columns = useMemo<ColumnDef<AgentOrder>[]>(
    () => [
      {
        accessorKey: 'order_no',
        header: t('Order'),
        cell: ({ row }) => (
          <div>
            <div className='font-medium'>{row.original.order_no}</div>
            <div className='text-muted-foreground text-xs'>
              {t('Order ID: {{id}}', { id: row.original.id })}
              {' · '}
              {new Date(row.original.created_at * 1000).toLocaleString()}
            </div>
          </div>
        ),
      },
      { accessorKey: 'plan_title', header: t('Plan') },
      { accessorKey: 'quantity', header: t('Quantity') },
      {
        accessorKey: 'total_price',
        header: t('Total points'),
        cell: ({ row }) => formatAgentPoints(row.original.total_price),
      },
      {
        accessorKey: 'refunded_count',
        header: t('Refunded'),
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        cell: ({ row }) => {
          const status = row.original.status
          const variant = status === 'refunded' ? 'outline' : 'secondary'
          if (status === 'partially_refunded') {
            return <Badge variant='secondary'>{t('Partially refunded')}</Badge>
          }
          return (
            <Badge variant={variant}>
              {status === 'completed' ? t('Completed') : t('Refunded')}
            </Badge>
          )
        },
      },
    ],
    [t]
  )

  const table = useReactTable({
    data: ordersQuery.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: ordersQuery.data?.total ?? 0,
    getRowId: (row) => row.id.toString(),
  })

  const updateFilters = (updates: Partial<AgentWorkspaceSearch>) =>
    props.onSearchChange({ ...updates, p: 1 })

  return (
    <AgentTableShell
      table={table}
      isLoading={ordersQuery.isPending}
      isFetching={ordersQuery.isFetching}
      error={ordersQuery.error}
      onRetry={() => ordersQuery.refetch()}
      emptyTitle={t('No agent orders found')}
      emptyDescription={t('Purchased package-code orders will appear here.')}
      page={page}
      pageSize={pageSize}
      total={ordersQuery.data?.total ?? 0}
      onPageChange={(nextPage) => props.onSearchChange({ p: nextPage })}
      filters={
        <>
          <Input
            type='number'
            min={1}
            className='w-32'
            aria-label={t('Filter orders by plan')}
            placeholder={t('Plan ID')}
            value={props.search.plan_id?.toString() ?? ''}
            onChange={(event) =>
              updateFilters({
                plan_id: event.target.value
                  ? Number(event.target.value)
                  : undefined,
              })
            }
          />
          <NativeSelect
            aria-label={t('Filter orders by status')}
            value={props.search.order_status ?? ''}
            onChange={(event) =>
              updateFilters({
                order_status:
                  (event.target
                    .value as AgentWorkspaceSearch['order_status']) ||
                  undefined,
              })
            }
          >
            <NativeSelectOption value=''>
              {t('All statuses')}
            </NativeSelectOption>
            <NativeSelectOption value='completed'>
              {t('Completed')}
            </NativeSelectOption>
            <NativeSelectOption value='partially_refunded'>
              {t('Partially refunded')}
            </NativeSelectOption>
            <NativeSelectOption value='refunded'>
              {t('Refunded')}
            </NativeSelectOption>
          </NativeSelect>
          <Input
            type='date'
            aria-label={t('Order start date')}
            className='w-auto'
            value={timestampToLocalDateInput(props.search.start_timestamp)}
            onChange={(event) =>
              updateFilters({
                start_timestamp: localDateInputToTimestamp(event.target.value),
              })
            }
          />
          <Input
            type='date'
            aria-label={t('Order end date')}
            className='w-auto'
            value={timestampToLocalDateInput(props.search.end_timestamp)}
            onChange={(event) => {
              const startOfDay = localDateInputToTimestamp(event.target.value)
              updateFilters({
                end_timestamp: startOfDay ? startOfDay + 86_399 : undefined,
              })
            }}
          />
          <NativeSelect
            aria-label={t('Rows per page')}
            value={pageSize.toString()}
            onChange={(event) =>
              updateFilters({ page_size: Number(event.target.value) })
            }
          >
            {[10, 20, 50, 100].map((size) => (
              <NativeSelectOption key={size} value={size}>
                {t('{{size}} per page', { size })}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </>
      }
    />
  )
}

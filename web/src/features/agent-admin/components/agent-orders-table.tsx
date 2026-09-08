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
import { getAdminAgentOrders } from '@/features/agents/api'
import { AgentTableShell } from '@/features/agents/components/agent-table-shell'
import type { AgentOrder } from '@/features/agents/types'

import { agentAdminQueryKeys, type AgentAdminSearch } from '../lib/admin'

type AgentOrdersTableProps = {
  scope: number
  search: AgentAdminSearch
  onSearchChange: (updates: Partial<AgentAdminSearch>) => void
}

export function AgentOrdersTable(props: AgentOrdersTableProps) {
  const { t } = useTranslation()
  const orderStatus =
    props.search.status === 'completed' ||
    props.search.status === 'partially_refunded' ||
    props.search.status === 'refunded'
      ? props.search.status
      : undefined
  const query = useQuery({
    queryKey: agentAdminQueryKeys.orders(props.scope, props.search),
    queryFn: async () => {
      const response = await getAdminAgentOrders({
        p: props.search.p,
        page_size: 20,
        agent_user_id: props.search.agent_user_id,
        plan_id: props.search.plan_id,
        status: orderStatus,
      })
      if (!response.success) throw new Error(response.message)
      return response.data
    },
  })
  const columns = useMemo<ColumnDef<AgentOrder>[]>(() => {
    const statusLabels = {
      completed: t('Completed'),
      partially_refunded: t('Partially refunded'),
      refunded: t('Refunded'),
    }
    return [
      {
        accessorKey: 'order_no',
        header: t('Order'),
        cell: ({ row }) => (
          <div>
            <div className='font-medium'>{row.original.order_no}</div>
            <div className='text-muted-foreground text-xs'>
              #{row.original.id} ·{' '}
              {new Date(row.original.created_at * 1000).toLocaleString()}
            </div>
          </div>
        ),
      },
      { accessorKey: 'agent_user_id', header: t('Agent user ID') },
      {
        accessorKey: 'plan_title',
        header: t('Plan'),
        cell: ({ row }) => (
          <div>
            <div>{row.original.plan_title}</div>
            <div className='text-muted-foreground text-xs'>
              #{row.original.plan_id}
            </div>
          </div>
        ),
      },
      { accessorKey: 'quantity', header: t('Quantity') },
      {
        accessorKey: 'total_price',
        header: t('Total points'),
        cell: ({ row }) => (
          <span className='tabular-nums'>{row.original.total_price}</span>
        ),
      },
      {
        id: 'refunds',
        header: t('Refunded'),
        cell: ({ row }) => (
          <span className='tabular-nums'>
            {row.original.refunded_count} / {row.original.quantity} ·{' '}
            {row.original.refunded_amount}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.status === 'completed' ? 'secondary' : 'outline'
            }
          >
            {statusLabels[row.original.status]}
          </Badge>
        ),
      },
    ]
  }, [t])
  const table = useReactTable({
    data: query.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: query.data?.total ?? 0,
    getRowId: (row) => row.id.toString(),
  })

  const numericFilter = (key: 'agent_user_id' | 'plan_id', value: string) =>
    props.onSearchChange({ [key]: value ? Number(value) : undefined, p: 1 })

  return (
    <AgentTableShell
      table={table}
      isLoading={query.isPending}
      isFetching={query.isFetching}
      error={query.error}
      onRetry={() => query.refetch()}
      emptyTitle={t('No agent orders found')}
      emptyDescription={t('Agent package-code purchases will appear here.')}
      page={props.search.p}
      pageSize={20}
      total={query.data?.total ?? 0}
      onPageChange={(p) => props.onSearchChange({ p })}
      filters={
        <>
          <Input
            type='number'
            min={1}
            className='w-36'
            aria-label={t('Filter by agent user ID')}
            placeholder={t('Agent user ID')}
            value={props.search.agent_user_id ?? ''}
            onChange={(event) =>
              numericFilter('agent_user_id', event.target.value)
            }
          />
          <Input
            type='number'
            min={1}
            className='w-32'
            aria-label={t('Filter by plan ID')}
            placeholder={t('Plan ID')}
            value={props.search.plan_id ?? ''}
            onChange={(event) => numericFilter('plan_id', event.target.value)}
          />
          <NativeSelect
            aria-label={t('Filter orders by status')}
            value={orderStatus ?? ''}
            onChange={(event) =>
              props.onSearchChange({
                status: (event.target.value as typeof orderStatus) || undefined,
                p: 1,
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
        </>
      }
    />
  )
}

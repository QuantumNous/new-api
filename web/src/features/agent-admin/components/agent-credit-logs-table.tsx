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

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { getAdminAgentCreditLogs } from '@/features/agents/api'
import { AgentTableShell } from '@/features/agents/components/agent-table-shell'
import type { AgentCreditLog } from '@/features/agents/types'

import { agentAdminQueryKeys, type AgentAdminSearch } from '../lib/admin'

type AgentCreditLogsTableProps = {
  scope: number
  search: AgentAdminSearch
  onSearchChange: (updates: Partial<AgentAdminSearch>) => void
}

export function AgentCreditLogsTable(props: AgentCreditLogsTableProps) {
  const { t } = useTranslation()
  const userID = props.search.agent_user_id ?? 0
  const query = useQuery({
    queryKey: agentAdminQueryKeys.ledger(props.scope, userID, props.search.p),
    queryFn: async () => {
      const response = await getAdminAgentCreditLogs(userID, {
        p: props.search.p,
        page_size: 20,
      })
      if (!response.success) throw new Error(response.message)
      return response.data
    },
    enabled: userID > 0,
  })
  const columns = useMemo<ColumnDef<AgentCreditLog>[]>(
    () => [
      {
        accessorKey: 'created_at',
        header: t('Time'),
        cell: ({ row }) =>
          new Date(row.original.created_at * 1000).toLocaleString(),
      },
      {
        accessorKey: 'event_type',
        header: t('Event'),
        cell: ({ row }) => {
          const labels = {
            admin_credit: t('Admin credit'),
            admin_debit: t('Admin debit'),
            purchase: t('Purchase'),
            refund: t('Refund'),
          }
          return labels[row.original.event_type]
        },
      },
      { accessorKey: 'delta', header: t('Delta') },
      { accessorKey: 'balance_before', header: t('Balance before') },
      { accessorKey: 'balance_after', header: t('Balance after') },
      {
        accessorKey: 'remark',
        header: t('Reason'),
        cell: ({ row }) => (
          <span className='block max-w-64 break-words'>
            {row.original.remark || '—'}
          </span>
        ),
      },
      {
        id: 'references',
        header: t('References'),
        cell: ({ row }) => (
          <span className='text-muted-foreground text-xs'>
            {row.original.business_key}
            {row.original.order_id
              ? t(' · order #{{id}}', { id: row.original.order_id })
              : ''}
            {row.original.operator_user_id
              ? t(' · operator #{{id}}', {
                  id: row.original.operator_user_id,
                })
              : ''}
          </span>
        ),
      },
    ],
    [t]
  )
  const table = useReactTable({
    data: query.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: query.data?.total ?? 0,
    getRowId: (row) => row.id.toString(),
  })
  const userFilter = (
    <Input
      type='number'
      min={1}
      className='w-48'
      aria-label={t('Agent user ID for ledger')}
      placeholder={t('Enter agent user ID')}
      value={props.search.agent_user_id ?? ''}
      onChange={(event) =>
        props.onSearchChange({
          agent_user_id: event.target.value
            ? Number(event.target.value)
            : undefined,
          p: 1,
        })
      }
    />
  )

  if (userID <= 0) {
    return (
      <div className='flex flex-col gap-3'>
        <div>{userFilter}</div>
        <Empty className='min-h-56 border'>
          <EmptyHeader>
            <EmptyTitle>{t('Select an agent ledger')}</EmptyTitle>
            <EmptyDescription>
              {t(
                'Enter an agent user ID or open the ledger from the Agents tab.'
              )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <AgentTableShell
      table={table}
      isLoading={query.isPending}
      isFetching={query.isFetching}
      error={query.error}
      onRetry={() => query.refetch()}
      emptyTitle={t('No ledger entries found')}
      emptyDescription={t('Financial entries for this agent will appear here.')}
      page={props.search.p}
      pageSize={20}
      total={query.data?.total ?? 0}
      onPageChange={(p) => props.onSearchChange({ p })}
      filters={userFilter}
    />
  )
}

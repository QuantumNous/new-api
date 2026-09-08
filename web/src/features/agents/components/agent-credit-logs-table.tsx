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

import { getAgentCreditLogs } from '../api'
import { formatAgentPoints } from '../lib/money'
import {
  agentQueryKeys,
  agentUserQueryKey,
  localDateInputToTimestamp,
  retainSameAgentPage,
  timestampToLocalDateInput,
  type AgentWorkspaceSearch,
} from '../lib/workspace'
import type { AgentCreditLog } from '../types'
import { AgentTableShell } from './agent-table-shell'

type AgentCreditLogsTableProps = {
  search: AgentWorkspaceSearch
  onSearchChange: (updates: Partial<AgentWorkspaceSearch>) => void
}

export function AgentCreditLogsTable(props: AgentCreditLogsTableProps) {
  const { t } = useTranslation()
  const userID = useAuthStore((state) => state.auth.user?.id ?? 0)
  const page = props.search.p ?? 1
  const pageSize = props.search.page_size ?? 20
  const query = useQuery({
    queryKey: agentUserQueryKey(
      agentQueryKeys.creditLogs,
      userID,
      page,
      pageSize,
      props.search.event_type,
      props.search.start_timestamp,
      props.search.end_timestamp
    ),
    queryFn: async () => {
      const response = await getAgentCreditLogs({
        p: page,
        page_size: pageSize,
        event_type: props.search.event_type,
        start_timestamp: props.search.start_timestamp,
        end_timestamp: props.search.end_timestamp,
      })
      if (!response.success) throw new Error('Agent credit logs unavailable')
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
          return (
            <Badge variant='outline'>{labels[row.original.event_type]}</Badge>
          )
        },
      },
      {
        accessorKey: 'delta',
        header: t('Point change'),
        cell: ({ row }) => (
          <span className='font-medium tabular-nums'>
            {formatAgentPoints(row.original.delta)}
          </span>
        ),
      },
      {
        accessorKey: 'balance_after',
        header: t('Balance after'),
        cell: ({ row }) => formatAgentPoints(row.original.balance_after),
      },
      { accessorKey: 'business_key', header: t('Business reference') },
      {
        accessorKey: 'remark',
        header: t('Remark'),
        cell: ({ row }) => row.original.remark || t('No remark'),
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

  const updateFilters = (updates: Partial<AgentWorkspaceSearch>) =>
    props.onSearchChange({ ...updates, p: 1 })

  return (
    <AgentTableShell
      table={table}
      isLoading={query.isPending}
      isFetching={query.isFetching}
      error={query.error}
      onRetry={() => query.refetch()}
      emptyTitle={t('No point ledger entries found')}
      emptyDescription={t(
        'Point adjustments, purchases, and refunds will appear here.'
      )}
      page={page}
      pageSize={pageSize}
      total={query.data?.total ?? 0}
      onPageChange={(nextPage) => props.onSearchChange({ p: nextPage })}
      filters={
        <>
          <NativeSelect
            aria-label={t('Filter ledger by event')}
            value={props.search.event_type ?? ''}
            onChange={(event) =>
              updateFilters({
                event_type:
                  (event.target.value as AgentWorkspaceSearch['event_type']) ||
                  undefined,
              })
            }
          >
            <NativeSelectOption value=''>{t('All events')}</NativeSelectOption>
            <NativeSelectOption value='admin_credit'>
              {t('Admin credit')}
            </NativeSelectOption>
            <NativeSelectOption value='admin_debit'>
              {t('Admin debit')}
            </NativeSelectOption>
            <NativeSelectOption value='purchase'>
              {t('Purchase')}
            </NativeSelectOption>
            <NativeSelectOption value='refund'>
              {t('Refund')}
            </NativeSelectOption>
          </NativeSelect>
          <Input
            type='date'
            aria-label={t('Ledger start date')}
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
            aria-label={t('Ledger end date')}
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

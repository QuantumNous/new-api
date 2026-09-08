/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

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
import { LOG_TYPES } from '@/features/usage-logs/constants'
import { formatLogQuota, formatTokens, formatUseTime } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'

import { getAgentCustomerLogStats, getAgentCustomerLogs } from '../api'
import {
  agentQueryKeys,
  agentUserQueryKey,
  localDateInputToTimestamp,
  retainSameAgentPage,
  timestampToLocalDateInput,
  type AgentWorkspaceSearch,
} from '../lib/workspace'
import type { AgentCustomerLog } from '../types'
import { AgentTableShell } from './agent-table-shell'

type AgentCustomerLogsProps = {
  search: AgentWorkspaceSearch
  onSearchChange: (updates: Partial<AgentWorkspaceSearch>) => void
}

function formatDate(timestamp: number): string {
  return timestamp > 0 ? new Date(timestamp * 1000).toLocaleString() : '-'
}

export function AgentCustomerLogs(props: AgentCustomerLogsProps) {
  const { t } = useTranslation()
  const userID = useAuthStore((state) => state.auth.user?.id ?? 0)
  const page = props.search.p ?? 1
  const pageSize = props.search.page_size ?? 20
  const filters = {
    user_id: props.search.customer_id,
    username: props.search.customer_username,
    type: props.search.log_type,
    model_name: props.search.model_name,
    token_name: props.search.token_name,
    group: props.search.log_group,
    start_timestamp: props.search.start_timestamp,
    end_timestamp: props.search.end_timestamp,
  }
  const logsQuery = useQuery({
    queryKey: agentUserQueryKey(
      agentQueryKeys.customerLogs,
      userID,
      page,
      pageSize,
      filters
    ),
    queryFn: async () => {
      const response = await getAgentCustomerLogs({
        p: page,
        page_size: pageSize,
        ...filters,
      })
      if (!response.success) throw new Error('Agent customer logs unavailable')
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
  const statsQuery = useQuery({
    queryKey: agentUserQueryKey(
      agentQueryKeys.customerLogStats,
      userID,
      filters
    ),
    queryFn: async () => {
      const response = await getAgentCustomerLogStats(filters)
      if (!response.success) {
        throw new Error('Agent customer log stats unavailable')
      }
      return response.data
    },
  })

  const columns = useMemo<ColumnDef<AgentCustomerLog>[]>(
    () => [
      {
        accessorKey: 'created_at',
        header: t('Time'),
        cell: ({ row }) => formatDate(row.original.created_at),
      },
      {
        accessorKey: 'username',
        header: t('Customer'),
        cell: ({ row }) => (
          <div>
            <div className='font-medium'>{row.original.username || '-'}</div>
            <div className='text-muted-foreground text-xs'>
              #{row.original.user_id}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'type',
        header: t('Type'),
        cell: ({ row }) => {
          const type = LOG_TYPES.find(
            (item) => item.value === row.original.type
          )
          return (
            <Badge variant='outline'>
              {type ? t(type.label) : t('Unknown')}
            </Badge>
          )
        },
      },
      { accessorKey: 'model_name', header: t('Model') },
      { accessorKey: 'token_name', header: t('Token') },
      {
        accessorKey: 'quota',
        header: t('Usage'),
        cell: ({ row }) => formatLogQuota(row.original.quota),
      },
      {
        id: 'tokens',
        header: t('Tokens'),
        cell: ({ row }) =>
          formatTokens(
            row.original.prompt_tokens + row.original.completion_tokens
          ),
      },
      {
        accessorKey: 'use_time',
        header: t('Use time'),
        cell: ({ row }) => formatUseTime(row.original.use_time),
      },
    ],
    [t]
  )
  const table = useReactTable({
    data: logsQuery.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: logsQuery.data?.total ?? 0,
    getRowId: (row) => row.id.toString(),
  })
  const updateFilters = (updates: Partial<AgentWorkspaceSearch>) =>
    props.onSearchChange({ ...updates, p: 1 })

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='border-border/60 bg-muted/25 inline-flex h-7 items-center gap-2 rounded-md border px-2.5 text-xs'>
          <span className='text-muted-foreground'>{t('Usage')}</span>
          <span className='font-mono font-semibold tabular-nums'>
            {formatLogQuota(statsQuery.data?.quota ?? 0)}
          </span>
        </span>
        <span className='border-border/60 bg-muted/25 inline-flex h-7 items-center gap-2 rounded-md border px-2.5 text-xs'>
          <span className='text-muted-foreground'>{t('RPM')}</span>
          <span className='font-mono font-semibold tabular-nums'>
            {statsQuery.data?.rpm ?? 0}
          </span>
        </span>
        <span className='border-border/60 bg-muted/25 inline-flex h-7 items-center gap-2 rounded-md border px-2.5 text-xs'>
          <span className='text-muted-foreground'>{t('TPM')}</span>
          <span className='font-mono font-semibold tabular-nums'>
            {statsQuery.data?.tpm ?? 0}
          </span>
        </span>
      </div>
      <AgentTableShell
        table={table}
        isLoading={logsQuery.isPending}
        isFetching={logsQuery.isFetching}
        error={logsQuery.error}
        onRetry={() => logsQuery.refetch()}
        emptyTitle={t('No customer logs found')}
        emptyDescription={t(
          'Calls made by your bound customers will appear here.'
        )}
        page={page}
        pageSize={pageSize}
        total={logsQuery.data?.total ?? 0}
        onPageChange={(nextPage) => props.onSearchChange({ p: nextPage })}
        filters={
          <>
            <Input
              placeholder={t('Customer username')}
              aria-label={t('Customer username')}
              value={props.search.customer_username ?? ''}
              onChange={(event) =>
                updateFilters({
                  customer_username: event.target.value || undefined,
                })
              }
              className='w-40'
            />
            <Input
              placeholder={t('Model')}
              aria-label={t('Filter logs by model')}
              value={props.search.model_name ?? ''}
              onChange={(event) =>
                updateFilters({ model_name: event.target.value || undefined })
              }
              className='w-36'
            />
            <Input
              placeholder={t('Token')}
              aria-label={t('Filter logs by token')}
              value={props.search.token_name ?? ''}
              onChange={(event) =>
                updateFilters({ token_name: event.target.value || undefined })
              }
              className='w-36'
            />
            <NativeSelect
              aria-label={t('Filter logs by type')}
              value={props.search.log_type?.toString() ?? '0'}
              onChange={(event) => {
                const value = Number(event.target.value)
                updateFilters({ log_type: value === 0 ? undefined : value })
              }}
            >
              <NativeSelectOption value='0'>
                {t('All types')}
              </NativeSelectOption>
              {LOG_TYPES.filter((item) => item.value !== 0).map((item) => (
                <NativeSelectOption key={item.value} value={item.value}>
                  {t(item.label)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Input
              type='date'
              aria-label={t('Log start date')}
              className='w-auto'
              value={timestampToLocalDateInput(props.search.start_timestamp)}
              onChange={(event) =>
                updateFilters({
                  start_timestamp: localDateInputToTimestamp(
                    event.target.value
                  ),
                })
              }
            />
            <Input
              type='date'
              aria-label={t('Log end date')}
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
    </div>
  )
}

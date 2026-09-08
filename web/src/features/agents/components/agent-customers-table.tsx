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
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { formatNumber } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'

import { getAgentCustomers, getAgentPromotion } from '../api'
import {
  agentQueryKeys,
  agentUserQueryKey,
  retainSameAgentPage,
  type AgentWorkspaceSearch,
} from '../lib/workspace'
import type { AgentCustomer } from '../types'
import { AgentTableShell } from './agent-table-shell'

type AgentCustomersTableProps = {
  search: AgentWorkspaceSearch
  onSearchChange: (updates: Partial<AgentWorkspaceSearch>) => void
}

function formatDate(timestamp: number): string {
  return timestamp > 0 ? new Date(timestamp * 1000).toLocaleString() : '-'
}

export function AgentCustomersTable(props: AgentCustomersTableProps) {
  const { t } = useTranslation()
  const userID = useAuthStore((state) => state.auth.user?.id ?? 0)
  const page = props.search.p ?? 1
  const pageSize = props.search.page_size ?? 20
  const customersQuery = useQuery({
    queryKey: agentUserQueryKey(
      agentQueryKeys.customers,
      userID,
      page,
      pageSize,
      props.search.customer_keyword,
      props.search.customer_sort_by,
      props.search.customer_sort_order
    ),
    queryFn: async () => {
      const response = await getAgentCustomers({
        p: page,
        page_size: pageSize,
        keyword: props.search.customer_keyword,
        sort_by: props.search.customer_sort_by,
        sort_order: props.search.customer_sort_order,
      })
      if (!response.success) throw new Error('Agent customers unavailable')
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
  const promotionQuery = useQuery({
    queryKey: agentUserQueryKey(agentQueryKeys.promotion, userID),
    queryFn: async () => {
      const response = await getAgentPromotion()
      if (!response.success) throw new Error('Agent promotion unavailable')
      return response.data
    },
  })

  const copyLink = useCallback(async () => {
    const link = promotionQuery.data?.register_link
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.success(t('Link copied'))
    } catch {
      toast.error(t('Failed to copy link'))
    }
  }, [promotionQuery.data?.register_link, t])

  const columns = useMemo<ColumnDef<AgentCustomer>[]>(
    () => [
      {
        accessorKey: 'username',
        header: t('Customer'),
        cell: ({ row }) => (
          <div className='min-w-32'>
            <div className='font-medium'>
              {row.original.display_name || row.original.username}
            </div>
            <div className='text-muted-foreground text-xs'>
              {row.original.username} · #{row.original.id}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        cell: ({ row }) => (
          <Badge variant={row.original.status === 1 ? 'default' : 'outline'}>
            {row.original.status === 1 ? t('Enabled') : t('Disabled')}
          </Badge>
        ),
      },
      {
        accessorKey: 'remaining_quota',
        header: t('Remaining quota'),
        cell: ({ row }) => (
          <div className='tabular-nums'>
            {formatNumber(row.original.remaining_quota)}
            <div className='text-muted-foreground text-xs'>
              {t('of {{quota}} used quota', {
                quota: formatNumber(row.original.quota),
              })}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'subscription_end_time',
        header: t('Subscription'),
        cell: ({ row }) =>
          row.original.subscription_plan_title ? (
            <div>
              <div>{row.original.subscription_plan_title}</div>
              <div className='text-muted-foreground text-xs'>
                {formatDate(row.original.subscription_end_time)}
              </div>
            </div>
          ) : (
            <span className='text-muted-foreground'>{t('None')}</span>
          ),
      },
      {
        accessorKey: 'last_login_at',
        header: t('Last login'),
        cell: ({ row }) => formatDate(row.original.last_login_at),
      },
      {
        accessorKey: 'bound_at',
        header: t('Bound at'),
        cell: ({ row }) => formatDate(row.original.bound_at),
      },
    ],
    [t]
  )
  const table = useReactTable({
    data: customersQuery.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: customersQuery.data?.total ?? 0,
    getRowId: (row) => row.id.toString(),
  })
  const updateFilters = (updates: Partial<AgentWorkspaceSearch>) =>
    props.onSearchChange({ ...updates, p: 1 })

  return (
    <div className='flex flex-col gap-4'>
      <Card>
        <CardHeader>
          <CardTitle>{t('Invitation link')}</CardTitle>
          <CardDescription>
            {t(
              'Customers who register with this link or redeem your code will be bound to you.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-3 sm:flex-row sm:items-center'>
          <Input
            readOnly
            value={promotionQuery.data?.register_link ?? ''}
            aria-label={t('Invitation link')}
            className='min-w-0 flex-1'
          />
          <Button type='button' variant='outline' onClick={copyLink}>
            {t('Copy link')}
          </Button>
          <div className='text-muted-foreground text-sm whitespace-nowrap'>
            {t('{{total}} bound · {{month}} this month', {
              total: promotionQuery.data?.bound_customer_count ?? 0,
              month: promotionQuery.data?.month_bound_customer_count ?? 0,
            })}
          </div>
        </CardContent>
      </Card>
      <AgentTableShell
        table={table}
        isLoading={customersQuery.isPending}
        isFetching={customersQuery.isFetching}
        error={customersQuery.error}
        onRetry={() => customersQuery.refetch()}
        emptyTitle={t('No customers found')}
        emptyDescription={t(
          'Customers bound through your invitation link or codes will appear here.'
        )}
        page={page}
        pageSize={pageSize}
        total={customersQuery.data?.total ?? 0}
        onPageChange={(nextPage) => props.onSearchChange({ p: nextPage })}
        filters={
          <>
            <Input
              placeholder={t('Search customers')}
              aria-label={t('Search customers')}
              value={props.search.customer_keyword ?? ''}
              onChange={(event) =>
                updateFilters({
                  customer_keyword: event.target.value || undefined,
                })
              }
              className='w-48'
            />
            <NativeSelect
              aria-label={t('Sort customers')}
              value={props.search.customer_sort_by ?? 'bound_at'}
              onChange={(event) =>
                updateFilters({
                  customer_sort_by: event.target
                    .value as AgentWorkspaceSearch['customer_sort_by'],
                })
              }
            >
              <NativeSelectOption value='bound_at'>
                {t('Newest bindings')}
              </NativeSelectOption>
              <NativeSelectOption value='remaining_quota'>
                {t('Lowest remaining quota')}
              </NativeSelectOption>
              <NativeSelectOption value='subscription_end_time'>
                {t('Subscription expiry')}
              </NativeSelectOption>
              <NativeSelectOption value='status'>
                {t('Status')}
              </NativeSelectOption>
            </NativeSelect>
            <NativeSelect
              aria-label={t('Sort order')}
              value={props.search.customer_sort_order ?? 'desc'}
              onChange={(event) =>
                updateFilters({
                  customer_sort_order: event.target
                    .value as AgentWorkspaceSearch['customer_sort_order'],
                })
              }
            >
              <NativeSelectOption value='desc'>
                {t('Descending')}
              </NativeSelectOption>
              <NativeSelectOption value='asc'>
                {t('Ascending')}
              </NativeSelectOption>
            </NativeSelect>
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

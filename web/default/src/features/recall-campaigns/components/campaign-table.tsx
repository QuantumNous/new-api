import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTablePage } from '@/components/data-table'
import { listRecallCampaigns, recallCampaignKeys } from '../api'
import type { RecallCampaignSearch, RecallCampaignSummary } from '../types'

function formatTimestamp(value: number): string {
  return value > 0 ? new Date(value * 1000).toLocaleString() : '-'
}

export function CampaignTable() {
  const { t } = useTranslation()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const search: RecallCampaignSearch = {
    p: pagination.pageIndex + 1,
    ps: pagination.pageSize,
  }
  const query = useQuery({
    queryKey: recallCampaignKeys.list(search),
    queryFn: () => listRecallCampaigns(search),
    placeholderData: (previous) => previous,
  })
  const campaigns = query.data?.data?.items ?? []
  const total = query.data?.data?.total ?? 0
  const columns = useMemo<ColumnDef<RecallCampaignSummary>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('Campaign'),
        cell: ({ row }) => (
          <div>
            <div className='font-medium'>{row.original.name}</div>
            <div className='text-muted-foreground text-xs'>
              #{row.original.id}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        cell: ({ row }) => (
          <Badge variant='secondary'>{t(row.original.status)}</Badge>
        ),
      },
      {
        accessorKey: 'audience_template',
        header: t('Audience'),
        cell: ({ row }) => t(row.original.audience_template),
      },
      {
        accessorKey: 'execution_mode',
        header: t('Execution'),
        cell: ({ row }) => (
          <div>
            {t(row.original.execution_mode)}
            <div className='text-muted-foreground text-xs'>
              {formatTimestamp(
                row.original.next_run_at || row.original.scheduled_at
              )}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'recipient_total',
        header: t('Recipients'),
        cell: ({ row }) => row.original.recipient_total,
      },
      {
        id: 'actions',
        header: t('Actions'),
        cell: ({ row }) => (
          <Button
            size='sm'
            variant='outline'
            render={
              <Link
                to='/recall-campaigns/$campaignId'
                params={{ campaignId: String(row.original.id) }}
              />
            }
          >
            {t('View details')}
          </Button>
        ),
      },
    ],
    [t]
  )
  const table = useReactTable({
    data: campaigns,
    columns,
    state: { pagination },
    pageCount: Math.ceil(total / pagination.pageSize),
    manualPagination: true,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={query.isLoading}
      isFetching={query.isFetching}
      emptyTitle={t('No activity configurations')}
      emptyDescription={t(
        'Create a campaign to safely win back eligible Stripe customers.'
      )}
      toolbarProps={null}
      hideMobile
    />
  )
}

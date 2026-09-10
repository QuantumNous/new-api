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
import type { ColumnDef, Table as TanstackTable } from '@tanstack/react-table'
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, DataTableRow } from '@/components/data-table'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  formatCompactNumber,
  formatQuota,
  formatTimestampToDate,
  formatUseTime,
} from '@/lib/format'
import { cn } from '@/lib/utils'

import type {
  UsageRankingChannelStat,
  UsageRankingGroupStat,
  UsageRankingItem,
  UsageRankingModelStat,
} from '../../types'
import {
  formatUsageRankingRatio,
  getUsageRankingRowKey,
} from './usage-ranking-columns'

const RIGHT_ALIGNED_COLUMNS = new Set([
  'quota',
  'request_count',
  'total_tokens',
  'prompt_tokens',
  'completion_tokens',
  'avg_use_time',
  'error_rate',
  'stream_ratio',
  'model_count',
  'token_count',
  'group_count',
  'channel_count',
])

interface UsageRankingTableProps {
  table: TanstackTable<UsageRankingItem>
  columns: ColumnDef<UsageRankingItem, unknown>[]
  loading: boolean
  fetching: boolean
  expandedRows: Set<string>
  toolbar: ReactNode
  mobile: ReactNode
}

interface UsageRankingDistributionPanelProps<
  T extends UsageRankingModelStat | UsageRankingChannelStat,
> {
  title: string
  items: T[]
  getKey: (item: T) => string
  getName: (item: T) => string
  getSecondary?: (item: T) => string
}

function UsageRankingDistributionPanel<
  T extends UsageRankingModelStat | UsageRankingChannelStat,
>(props: UsageRankingDistributionPanelProps<T>) {
  const { t } = useTranslation()

  return (
    <section className='bg-muted/30 min-w-0 rounded-md border p-3'>
      <h4 className='text-sm font-medium'>{props.title}</h4>
      {props.items.length > 0 ? (
        <div className='mt-3 flex flex-col gap-3'>
          {props.items.map((item) => {
            const percent = Math.max(
              0,
              Math.min(100, (Number(item.quota_ratio) || 0) * 100)
            )
            const name = props.getName(item)
            const secondary = props.getSecondary?.(item)

            return (
              <div key={props.getKey(item)} className='min-w-0 space-y-1.5'>
                <div className='flex min-w-0 items-center justify-between gap-3'>
                  <div className='flex min-w-0 flex-1 flex-col'>
                    <span className='truncate text-sm font-medium' title={name}>
                      {name}
                    </span>
                    {secondary && (
                      <span className='text-muted-foreground text-xs tabular-nums'>
                        {secondary}
                      </span>
                    )}
                  </div>
                  <div className='flex shrink-0 items-baseline gap-2 tabular-nums'>
                    <span className='text-sm font-medium'>
                      {formatQuota(item.quota)}
                    </span>
                    <span className='text-muted-foreground text-xs'>
                      {percent.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <Progress
                  value={percent}
                  aria-label={`${name}${secondary ? ` ${secondary}` : ''} ${percent.toFixed(1)}%`}
                />
                <dl className='grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4'>
                  <div className='min-w-0'>
                    <dt className='text-muted-foreground'>
                      {t('Request Count')}
                    </dt>
                    <dd className='truncate font-medium tabular-nums'>
                      {formatCompactNumber(item.request_count)}
                    </dd>
                  </div>
                  <div className='min-w-0'>
                    <dt className='text-muted-foreground'>
                      {t('Total Tokens')}
                    </dt>
                    <dd className='truncate font-medium tabular-nums'>
                      {formatCompactNumber(item.total_tokens)}
                    </dd>
                  </div>
                  <div className='min-w-0'>
                    <dt className='text-muted-foreground'>
                      {t('Input Tokens')}
                    </dt>
                    <dd className='truncate font-medium tabular-nums'>
                      {formatCompactNumber(item.prompt_tokens)}
                    </dd>
                  </div>
                  <div className='min-w-0'>
                    <dt className='text-muted-foreground'>
                      {t('Output Tokens')}
                    </dt>
                    <dd className='truncate font-medium tabular-nums'>
                      {formatCompactNumber(item.completion_tokens)}
                    </dd>
                  </div>
                </dl>
              </div>
            )
          })}
        </div>
      ) : (
        <p className='text-muted-foreground mt-3 text-xs'>{t('No Data')}</p>
      )}
    </section>
  )
}

export function UsageRankingGroupDetails(props: {
  groups: UsageRankingGroupStat[]
  constrainToViewport?: boolean
}) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'bg-muted/30 rounded-lg border p-2 whitespace-normal',
        props.constrainToViewport &&
          'w-[calc(100vw-2rem)] md:w-[calc(100vw-var(--sidebar-width)-4rem)]'
      )}
    >
      <div className='text-muted-foreground mb-2 text-xs font-medium'>
        {t('Group Breakdown')}
      </div>
      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Group')}</TableHead>
              <TableHead className='text-right'>
                {t('Consumed Quota')}
              </TableHead>
              <TableHead className='text-right'>{t('Request Count')}</TableHead>
              <TableHead className='text-right'>{t('Total Tokens')}</TableHead>
              <TableHead className='text-right'>
                {t('Average Duration')}
              </TableHead>
              <TableHead className='text-right'>{t('Error Rate')}</TableHead>
              <TableHead className='text-right'>{t('Stream Ratio')}</TableHead>
              <TableHead className='text-right'>{t('Models')}</TableHead>
              <TableHead className='text-right'>{t('Tokens')}</TableHead>
              <TableHead className='text-right'>{t('Channels')}</TableHead>
              <TableHead>{t('Latest Request Time')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.groups.map((group) => (
              <TableRow key={group.group || '__empty_group'}>
                <TableCell className='font-medium'>
                  {group.group || t('Unnamed Group')}
                </TableCell>
                <TableCell className='text-right'>
                  {formatQuota(group.quota)}
                </TableCell>
                <TableCell className='text-right'>
                  {formatCompactNumber(group.request_count)}
                </TableCell>
                <TableCell className='text-right'>
                  {formatCompactNumber(group.total_tokens)}
                </TableCell>
                <TableCell className='text-right'>
                  {formatUseTime(group.avg_use_time)}
                </TableCell>
                <TableCell className='text-right'>
                  {formatUsageRankingRatio(group.error_rate)}
                </TableCell>
                <TableCell className='text-right'>
                  {formatUsageRankingRatio(group.stream_ratio)}
                </TableCell>
                <TableCell className='text-right'>
                  {formatCompactNumber(group.model_count)}
                </TableCell>
                <TableCell className='text-right'>
                  {formatCompactNumber(group.token_count)}
                </TableCell>
                <TableCell className='text-right'>
                  {formatCompactNumber(group.channel_count)}
                </TableCell>
                <TableCell>
                  {formatTimestampToDate(group.last_used_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className='mt-3 flex flex-col gap-3'>
        {props.groups.map((group) => (
          <section
            key={`distribution:${group.group || '__empty_group'}`}
            className='bg-background rounded-md border p-3'
          >
            <div className='mb-3 flex items-baseline gap-2'>
              <span className='text-muted-foreground text-xs'>
                {t('Group')}
              </span>
              <h3 className='text-sm font-medium'>
                {group.group || t('Unnamed Group')}
              </h3>
            </div>
            <div className='grid gap-3 xl:grid-cols-2'>
              <UsageRankingDistributionPanel
                title={t('Model Consumption Distribution')}
                items={group.model_stats || []}
                getKey={(item) => item.model_name}
                getName={(item) => item.model_name || '-'}
              />
              <UsageRankingDistributionPanel
                title={t('Channel Consumption Distribution')}
                items={group.channel_stats || []}
                getKey={(item) => String(item.channel_id)}
                getName={(item) => item.channel_name || t('Unknown Channel')}
                getSecondary={(item) => `#${item.channel_id}`}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export function UsageRankingTable(props: UsageRankingTableProps) {
  const { t } = useTranslation()

  return (
    <DataTablePage
      table={props.table}
      columns={props.columns}
      isLoading={props.loading}
      isFetching={props.fetching}
      emptyTitle={t('No Ranking Data')}
      emptyDescription={t(
        'No usage was found for the selected ranking filters.'
      )}
      skeletonKeyPrefix='usage-ranking-skeleton'
      applyHeaderSize
      toolbar={props.toolbar}
      mobile={props.mobile}
      tableClassName='[&_[data-slot=table]]:text-[13px] [&_[data-slot=table]_td]:text-[13px] [&_[data-slot=table]_th]:text-[13px]'
      getColumnClassName={(columnId) =>
        RIGHT_ALIGNED_COLUMNS.has(columnId) ? 'text-right' : undefined
      }
      renderRow={(row, helpers) => {
        const rowKey = getUsageRankingRowKey(row.original)
        const expanded = props.expandedRows.has(rowKey)
        return (
          <Fragment key={row.id}>
            <DataTableRow
              row={row}
              aria-expanded={expanded}
              getColumnClassName={helpers.getCellClassName}
              cellRenderColumns={props.columns}
            />
            {expanded && (
              <TableRow
                key={`${row.id}-groups`}
                className='hover:bg-transparent'
              >
                <TableCell
                  colSpan={row.getVisibleCells().length}
                  className='p-3'
                >
                  <UsageRankingGroupDetails
                    groups={row.original.group_stats}
                    constrainToViewport
                  />
                </TableCell>
              </TableRow>
            )}
          </Fragment>
        )
      }}
    />
  )
}

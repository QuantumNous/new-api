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
import {
  flexRender,
  type Cell,
  type Table,
} from '@tanstack/react-table'
import { Database } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { dotColorMap, textColorMap, type StatusVariant } from '@/components/status-badge'
import type { LogCategory } from '../types'
import { LOG_TYPE_ENUM } from '../constants'
import { getLogTypeConfig } from '../lib/utils'

const logTypeRowTint: Record<number, string> = {
  [LOG_TYPE_ENUM.ERROR]: 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-900/30',
  [LOG_TYPE_ENUM.REFUND]: 'bg-blue-50/30 dark:bg-blue-950/15 border-blue-200/50 dark:border-blue-900/30',
}

interface UsageLogsMobileListProps<TData> {
  table: Table<TData>
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  logCategory: LogCategory
}

function UsageLogsMobileSkeleton() {
  return (
    <div className='overflow-hidden rounded-lg border border-border/50 bg-card'>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className='space-y-2.5 border-b border-border/40 p-3 last:border-b-0'
        >
          <div className='flex items-center justify-between gap-3'>
            <Skeleton className='h-5 w-40 rounded-md' />
            <Skeleton className='h-5 w-16 rounded-md' />
          </div>
          <div className='grid grid-cols-2 gap-x-4 gap-y-2'>
            {[1, 2, 3, 4, 5, 6].map((j) => (
              <div key={j} className='min-w-0 space-y-1'>
                <Skeleton className='h-3 w-10 rounded' />
                <Skeleton className='h-4 w-full rounded' />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function CompactCell<TData>({
  cell,
  fallback = '-',
  className,
  primaryOnly = false,
}: {
  cell?: Cell<TData, unknown>
  fallback?: string
  className?: string
  primaryOnly?: boolean
}) {
  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden leading-tight [&_button]:max-w-full [&_span]:max-w-full',
        primaryOnly &&
          '[&_.flex-col>*:not(:first-child)]:hidden [&_.flex-col]:min-w-0',
        className
      )}
    >
      {cell ? (
        flexRender(cell.column.columnDef.cell, cell.getContext())
      ) : (
        <span className='text-muted-foreground/50'>{fallback}</span>
      )}
    </div>
  )
}

function SummaryField<TData>({
  label,
  cell,
  className,
  valueClassName,
  primaryOnly = false,
}: {
  label: string
  cell?: Cell<TData, unknown>
  className?: string
  valueClassName?: string
  primaryOnly?: boolean
}) {
  if (!cell) return null

  return (
    <div
      className={cn(
        'min-w-0 rounded-md bg-muted/20 px-2 py-1.5',
        className
      )}
    >
      <div className='text-muted-foreground mb-1 text-[11px] leading-none font-medium select-none'>
        {label}
      </div>
      <CompactCell
        cell={cell}
        primaryOnly={primaryOnly}
        className={valueClassName}
      />
    </div>
  )
}

function MobileLogTimeStatus({
  createdAt,
  type,
}: {
  createdAt: unknown
  type: unknown
}) {
  const { t } = useTranslation()
  const timestamp = typeof createdAt === 'number' ? createdAt : undefined
  const logType = typeof type === 'number' ? type : undefined
  const config = getLogTypeConfig(logType ?? LOG_TYPE_ENUM.UNKNOWN)
  const variant = config.color as StatusVariant

  return (
    <div className='space-y-1'>
      <div className='font-mono text-xs leading-tight tabular-nums'>
        {formatTimestampToDate(timestamp)}
      </div>
      <div
        className={cn(
          'inline-flex items-center gap-1 text-xs leading-none font-medium',
          textColorMap[variant]
        )}
      >
        <span
          className={cn('size-1.5 shrink-0 rounded-full', dotColorMap[variant])}
          aria-hidden='true'
        />
        <span>{t(config.label)}</span>
      </div>
    </div>
  )
}

function CommonLogsCard<TData>({
  cells,
}: {
  cells: Map<string, Cell<TData, unknown>>
}) {
  const { t } = useTranslation()

  const modelCell = cells.get('model_name')
  const quotaCell = cells.get('quota')
  const rowData = cells.get('created_at')?.row.original as
    | Record<string, unknown>
    | undefined

  return (
    <div className='space-y-2.5'>
      <div className='flex min-w-0 items-center justify-between gap-3'>
        <CompactCell cell={modelCell} className='flex-1' />
        <CompactCell
          cell={quotaCell}
          className='shrink-0 text-right [&_.flex-col]:items-end'
        />
      </div>

      <div className='grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-1.5'>
        <div className='min-w-0 rounded-md bg-muted/20 px-2 py-1.5'>
          <div className='text-muted-foreground mb-1 text-[11px] leading-none font-medium select-none'>
            {t('Time')}
          </div>
          <MobileLogTimeStatus
            createdAt={rowData?.created_at}
            type={rowData?.type}
          />
        </div>
        <SummaryField
          label={t('Channel')}
          cell={cells.get('channel')}
          primaryOnly
        />
        <SummaryField label={t('User')} cell={cells.get('user')} primaryOnly />
        <SummaryField
          label={t('Token')}
          cell={cells.get('token_name')}
          valueClassName='[&_.flex-col]:max-w-none [&_.flex-col>*:not(:first-child)]:text-[11px] [&_.flex-col>*:not(:first-child)]:leading-none'
        />
        <SummaryField
          label={t('Timing')}
          cell={cells.get('use_time')}
          primaryOnly
        />
        <SummaryField
          label={t('Tokens')}
          cell={cells.get('prompt_tokens')}
          primaryOnly
        />
        <SummaryField
          label={t('Details')}
          cell={cells.get('content')}
          className='col-span-2 bg-transparent px-0 py-0'
        />
      </div>
    </div>
  )
}

function TaskLogsCard<TData>({
  cells,
}: {
  cells: Map<string, Cell<TData, unknown>>
}) {
  const { t } = useTranslation()

  const taskIdCell = cells.get('task_id')
  const statusCell = cells.get('status')
  const submitTimeCell = cells.get('submit_time')

  return (
    <div className='space-y-2.5'>
      <div className='flex min-w-0 items-start justify-between gap-3'>
        <CompactCell cell={taskIdCell} className='flex-1' />
        <CompactCell cell={statusCell} className='shrink-0 text-right' />
      </div>

      <div className='grid grid-cols-2 gap-1.5'>
        <SummaryField
          label={t('Submit Time')}
          cell={submitTimeCell}
        />
        <SummaryField
          label={t('User')}
          cell={cells.get('user')}
          primaryOnly
        />
        <SummaryField
          label={t('Result')}
          cell={cells.get('fail_reason')}
          className='col-span-2 bg-transparent px-0 py-0'
        />
      </div>
    </div>
  )
}

function DrawingLogsCard<TData>({
  cells,
}: {
  cells: Map<string, Cell<TData, unknown>>
}) {
  const { t } = useTranslation()

  const actionCell = cells.get('action')
  const codeCell = cells.get('code')
  const submitTimeCell = cells.get('submit_time')

  return (
    <div className='space-y-2.5'>
      <div className='flex min-w-0 items-start justify-between gap-3'>
        <CompactCell cell={actionCell} className='flex-1' />
        <CompactCell cell={codeCell} className='shrink-0 text-right' />
      </div>

      <div className='grid grid-cols-2 gap-1.5'>
        <SummaryField
          label={t('Submit Time')}
          cell={submitTimeCell}
        />
        <SummaryField
          label={t('Channel')}
          cell={cells.get('channel')}
          primaryOnly
        />
        <SummaryField
          label={t('Task ID')}
          cell={cells.get('mj_id')}
        />
        <SummaryField
          label={t('Duration')}
          cell={cells.get('duration')}
          primaryOnly
        />
        <SummaryField
          label={t('Image')}
          cell={cells.get('image_url')}
        />
        <SummaryField
          label={t('Prompt')}
          cell={cells.get('prompt')}
          primaryOnly
        />
        <SummaryField
          label={t('Fail Reason')}
          cell={cells.get('fail_reason')}
          className='col-span-2 bg-transparent px-0 py-0'
        />
      </div>
    </div>
  )
}

export function UsageLogsMobileList<TData>({
  table,
  isLoading = false,
  emptyTitle,
  emptyDescription,
  logCategory,
}: UsageLogsMobileListProps<TData>) {
  const { t } = useTranslation()

  const resolvedEmptyTitle = emptyTitle ?? t('No Logs Found')
  const resolvedEmptyDescription =
    emptyDescription ??
    t('No usage logs available. Logs will appear here once API calls are made.')

  if (isLoading) {
    return <UsageLogsMobileSkeleton />
  }

  const rows = table.getRowModel().rows

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-lg border p-6">
        <Empty className="border-none p-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Database className="size-6" />
            </EmptyMedia>
            <EmptyTitle>{resolvedEmptyTitle}</EmptyTitle>
            <EmptyDescription>{resolvedEmptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className='overflow-hidden rounded-lg border border-border/50 bg-card'>
      {rows.map((row) => {
        const cells = new Map(
          row.getVisibleCells().map((cell) => [cell.column.id, cell])
        )

        const logType = (row.original as Record<string, unknown>).type as
          | number
          | undefined
        const tintClass = logType != null ? (logTypeRowTint[logType] ?? '') : ''

        return (
          <div
            key={row.id}
            className={cn(
              'border-l-2 border-l-transparent border-b border-border/40 p-3 transition-colors last:border-b-0',
              tintClass
            )}
          >
            {logCategory === 'common' && (
              <CommonLogsCard cells={cells} />
            )}
            {logCategory === 'task' && (
              <TaskLogsCard cells={cells} />
            )}
            {logCategory === 'drawing' && (
              <DrawingLogsCard cells={cells} />
            )}
          </div>
        )
      })}
    </div>
  )
}

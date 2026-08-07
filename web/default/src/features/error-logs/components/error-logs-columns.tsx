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
import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTimestampToDate, formatUseTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { getErrorCategoryConfig } from '../constants'
import { displayValue, parseErrorLogOther } from '../lib/utils'
import type { ErrorLog } from '../types'

function ContentSummaryCell(props: { content: string }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const content = props.content?.trim()

  if (!content) {
    return <span className='text-muted-foreground/40 text-xs'>-</span>
  }

  const isLong = content.length > 80

  return (
    <div className='max-w-[280px]'>
      <div className='flex items-start gap-1'>
        {isLong && (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='text-muted-foreground size-5 shrink-0'
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={expanded ? t('Collapse') : t('Expand')}
          >
            {expanded ? (
              <ChevronDown className='size-3.5' />
            ) : (
              <ChevronRight className='size-3.5' />
            )}
          </Button>
        )}
        <p
          className={cn(
            'text-muted-foreground text-xs leading-snug break-words',
            !expanded && isLong && 'line-clamp-2'
          )}
          title={content}
        >
          {content}
        </p>
      </div>
    </div>
  )
}

export function useErrorLogsColumns(): ColumnDef<ErrorLog>[] {
  const { t } = useTranslation()

  return [
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Time')} />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-xs tabular-nums'>
          {formatTimestampToDate(row.getValue('created_at') as number)}
        </span>
      ),
      enableHiding: false,
      meta: { label: t('Time') },
    },
    {
      accessorKey: 'request_id',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Request ID')} />
      ),
      cell: ({ row }) => {
        const requestId = row.original.request_id
        if (!requestId) {
          return <span className='text-muted-foreground/60 text-xs'>-</span>
        }
        return (
          <StatusBadge
            label={requestId}
            autoColor={requestId}
            copyText={requestId}
            size='sm'
            showDot={false}
            className='max-w-[140px] overflow-hidden font-mono'
          />
        )
      },
      meta: { label: t('Request ID') },
    },
    {
      accessorKey: 'username',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('User')} />
      ),
      cell: ({ row }) => (
        <span className='text-xs'>{displayValue(row.original.username)}</span>
      ),
      meta: { label: t('User') },
    },
    {
      accessorKey: 'token_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Token')} />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-xs'>
          {displayValue(row.original.token_name)}
        </span>
      ),
      meta: { label: t('Token') },
    },
    {
      accessorKey: 'model_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Model')} />
      ),
      cell: ({ row }) => {
        const modelName = row.original.model_name
        if (!modelName) {
          return <span className='text-muted-foreground/60 text-xs'>-</span>
        }
        return (
          <StatusBadge
            label={modelName}
            autoColor={modelName}
            copyText={modelName}
            size='sm'
            showDot={false}
            className='max-w-[160px] overflow-hidden font-mono'
          />
        )
      },
      meta: { label: t('Model') },
    },
    {
      accessorKey: 'group',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Group')} />
      ),
      cell: ({ row }) => (
        <span className='text-xs'>{displayValue(row.original.group)}</span>
      ),
      meta: { label: t('Group') },
    },
    {
      id: 'channel',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Channel')} />
      ),
      cell: ({ row }) => {
        const log = row.original
        if (!log.channel) {
          return <span className='text-muted-foreground/60 text-xs'>-</span>
        }
        const label = log.channel_name
          ? `${log.channel_name} #${log.channel}`
          : `#${log.channel}`
        return (
          <StatusBadge
            label={label}
            autoColor={String(log.channel)}
            copyText={String(log.channel)}
            size='sm'
            className='max-w-[160px] overflow-hidden font-mono'
          />
        )
      },
      meta: { label: t('Channel') },
    },
    {
      id: 'error_category',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Category')} />
      ),
      cell: ({ row }) => {
        const other = parseErrorLogOther(row.original.other)
        const config = getErrorCategoryConfig(other?.error_category)
        return (
          <StatusBadge
            label={t(config.labelKey)}
            variant={config.variant}
            size='sm'
            copyable={false}
          />
        )
      },
      meta: { label: t('Category') },
    },
    {
      id: 'status_code',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Status / Code')} />
      ),
      cell: ({ row }) => {
        const other = parseErrorLogOther(row.original.other)
        const statusCode = other?.status_code
        const errorCode = other?.error_code
        if (statusCode == null && (errorCode == null || errorCode === '')) {
          return <span className='text-muted-foreground/60 text-xs'>-</span>
        }
        return (
          <div className='flex flex-col gap-0.5'>
            {statusCode != null && (
              <span className='font-mono text-xs tabular-nums'>
                {statusCode}
              </span>
            )}
            {errorCode != null && errorCode !== '' && (
              <span className='text-muted-foreground/70 max-w-[120px] truncate font-mono text-[11px]'>
                {String(errorCode)}
              </span>
            )}
          </div>
        )
      },
      meta: { label: t('Status / Code') },
    },
    {
      accessorKey: 'content',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Content')} />
      ),
      cell: ({ row }) => <ContentSummaryCell content={row.original.content} />,
      meta: { label: t('Content') },
    },
    {
      accessorKey: 'use_time',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Duration')} />
      ),
      cell: ({ row }) => {
        const useTime = row.original.use_time
        if (!useTime) {
          return <span className='text-muted-foreground/60 text-xs'>-</span>
        }
        return (
          <span className='font-mono text-xs tabular-nums'>
            {formatUseTime(useTime)}
          </span>
        )
      },
      meta: { label: t('Duration'), mobileHidden: true },
    },
    {
      accessorKey: 'is_stream',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Stream')} />
      ),
      cell: ({ row }) => (
        <span className='text-muted-foreground text-xs'>
          {row.original.is_stream ? t('Yes') : t('No')}
        </span>
      ),
      meta: { label: t('Stream'), mobileHidden: true },
    },
    {
      id: 'request_path',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Request Path')} />
      ),
      cell: ({ row }) => {
        const other = parseErrorLogOther(row.original.other)
        const path = other?.request_path
        if (!path) {
          return <span className='text-muted-foreground/60 text-xs'>-</span>
        }
        return (
          <span
            className='text-muted-foreground max-w-[180px] truncate font-mono text-xs'
            title={path}
          >
            {path}
          </span>
        )
      },
      meta: { label: t('Request Path'), mobileHidden: true },
    },
  ]
}

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
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Database01Icon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { flexRender, type Table as TanstackTable } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { getAgentQueryView } from '../lib/workspace'

type AgentTableShellProps<TData> = {
  table: TanstackTable<TData>
  isLoading: boolean
  isFetching: boolean
  error: unknown
  onRetry: () => void
  emptyTitle: string
  emptyDescription: string
  filters?: ReactNode
  actions?: ReactNode
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function AgentTableShell<TData>(props: AgentTableShellProps<TData>) {
  const { t } = useTranslation()
  const rows = props.table.getRowModel().rows
  const pageCount = Math.max(1, Math.ceil(props.total / props.pageSize))
  const view = getAgentQueryView({
    loading: props.isLoading,
    error: Boolean(props.error),
    hasData: rows.length > 0,
  })
  let tableContent: ReactNode

  if (view === 'loading') {
    tableContent = (
      <div
        className='flex flex-col gap-3 p-4'
        aria-label={t('Loading agent data')}
      >
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className='h-8 w-full' />
        ))}
      </div>
    )
  } else if (view === 'error') {
    tableContent = (
      <Empty className='min-h-56 border-none'>
        <EmptyHeader>
          <EmptyTitle>{t('Failed to load agent data')}</EmptyTitle>
          <EmptyDescription>
            {t('Try loading this agent table again.')}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type='button' variant='outline' onClick={props.onRetry}>
            <HugeiconsIcon
              icon={RefreshIcon}
              strokeWidth={2}
              data-icon='inline-start'
            />
            {t('Retry')}
          </Button>
        </EmptyContent>
      </Empty>
    )
  } else if (view === 'empty') {
    tableContent = (
      <Empty className='min-h-56 border-none'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HugeiconsIcon icon={Database01Icon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>{props.emptyTitle}</EmptyTitle>
          <EmptyDescription>{props.emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else {
    tableContent = (
      <Table aria-busy={props.isFetching}>
        <TableHeader>
          {props.table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <div className='flex min-h-0 flex-col gap-3'>
      {(props.filters || props.actions) && (
        <div className='flex flex-col justify-between gap-2 sm:flex-row sm:items-end'>
          <div className='flex flex-1 flex-wrap items-end gap-2'>
            {props.filters}
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            {props.actions}
          </div>
        </div>
      )}

      <div className='overflow-hidden rounded-xl border'>{tableContent}</div>

      <div className='flex flex-wrap items-center justify-between gap-2 text-sm'>
        <span className='text-muted-foreground'>
          {t('{{total}} records', { total: props.total })}
        </span>
        <div className='flex items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={props.page <= 1 || props.isFetching}
            onClick={() => props.onPageChange(props.page - 1)}
          >
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              strokeWidth={2}
              data-icon='inline-start'
            />
            {t('Previous')}
          </Button>
          <span className='min-w-20 text-center tabular-nums'>
            {t('{{page}} / {{pages}}', {
              page: props.page,
              pages: pageCount,
            })}
          </span>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={props.page >= pageCount || props.isFetching}
            onClick={() => props.onPageChange(props.page + 1)}
          >
            {t('Next')}
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              strokeWidth={2}
              data-icon='inline-end'
            />
          </Button>
        </div>
      </div>
    </div>
  )
}

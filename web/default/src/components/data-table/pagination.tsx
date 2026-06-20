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
import { type Table } from '@tanstack/react-table'
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ChevronsLeft as DoubleArrowLeftIcon,
  ChevronsRight as DoubleArrowRightIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn, getPageNumbers } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type DataTablePaginationProps<TData> = {
  table: Table<TData>
}

function getRowCountSummary<TData>(table: Table<TData>) {
  const totalRows = table.options.rowCount
  if (totalRows == null || totalRows < 0) {
    return null
  }

  const { pageIndex, pageSize } = table.getState().pagination
  const currentPageRows = table.getRowModel().rows.length

  if (totalRows === 0) {
    return { start: 0, end: 0, total: 0 }
  }

  const start = pageIndex * pageSize + 1
  const end = pageIndex * pageSize + currentPageRows

  return { start, end, total: totalRows }
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  const { t } = useTranslation()
  const currentPage = table.getState().pagination.pageIndex + 1
  const totalPages = table.getPageCount()
  const pageNumbers = getPageNumbers(currentPage, totalPages)
  const rowSummary = getRowCountSummary(table)

  const pageText = t('Page {{current}} of {{total}}', {
    current: currentPage,
    total: totalPages,
  })

  const countLabel =
    rowSummary?.total === 0
      ? t('Total {{count}} records', { count: 0 })
      : rowSummary
        ? t('Showing {{start}}-{{end}} of {{total}}', {
            start: rowSummary.start.toLocaleString(),
            end: rowSummary.end.toLocaleString(),
            total: rowSummary.total.toLocaleString(),
          })
        : null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 overflow-clip',
        '@max-sm/content:flex-col @max-sm/content:items-stretch'
      )}
      style={{ overflowClipMargin: 1 }}
    >
      <p className='text-muted-foreground order-1 min-w-0 flex-1 text-xs font-medium sm:text-sm'>
        {countLabel ? (
          <span className='inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5'>
            <span className='whitespace-nowrap'>{countLabel}</span>
            <span className='text-muted-foreground/50 hidden sm:inline'>·</span>
            <span className='whitespace-nowrap'>{pageText}</span>
          </span>
        ) : (
          <span className='whitespace-nowrap'>{pageText}</span>
        )}
      </p>

      <div className='order-3 flex shrink-0 items-center justify-end gap-1.5 sm:order-3 sm:gap-2 @max-sm/content:order-3 @max-sm/content:justify-center'>
        <Button
          variant='outline'
          className='size-8 p-0 @max-md/content:hidden'
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          <span className='sr-only'>{t('Go to first page')}</span>
          <DoubleArrowLeftIcon className='h-4 w-4' />
        </Button>
        <Button
          variant='outline'
          className='size-8 p-0'
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <span className='sr-only'>{t('Go to previous page')}</span>
          <ChevronLeftIcon className='h-4 w-4' />
        </Button>

        {pageNumbers.map((pageNumber, index) => (
          <div key={`${pageNumber}-${index}`} className='flex items-center'>
            {pageNumber === '...' ? (
              <span className='text-muted-foreground px-1 text-sm'>...</span>
            ) : (
              <Button
                variant={currentPage === pageNumber ? 'default' : 'outline'}
                className='h-8 min-w-8 px-2'
                onClick={() => table.setPageIndex((pageNumber as number) - 1)}
              >
                <span className='sr-only'>Go to page {pageNumber}</span>
                {pageNumber}
              </Button>
            )}
          </div>
        ))}

        <Button
          variant='outline'
          className='size-8 p-0'
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <span className='sr-only'>{t('Go to next page')}</span>
          <ChevronRightIcon className='h-4 w-4' />
        </Button>
        <Button
          variant='outline'
          className='size-8 p-0 @max-md/content:hidden'
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          <span className='sr-only'>{t('Go to last page')}</span>
          <DoubleArrowRightIcon className='h-4 w-4' />
        </Button>
      </div>

      <div className='order-2 flex shrink-0 items-center gap-2 sm:order-2 @max-sm/content:order-2 @max-sm/content:justify-between'>
        <p className='text-muted-foreground text-xs font-medium sm:text-sm'>
          {t('Rows per page')}
        </p>
        <Select
          items={[
            ...[10, 20, 30, 40, 50, 100].map((pageSize) => ({
              value: `${pageSize}`,
              label: pageSize,
            })),
          ]}
          value={`${table.getState().pagination.pageSize}`}
          onValueChange={(value) => {
            table.setPageSize(Number(value))
          }}
        >
          <SelectTrigger className='h-8 w-[64px] sm:w-[70px]'>
            <SelectValue placeholder={table.getState().pagination.pageSize} />
          </SelectTrigger>
          <SelectContent side='top' alignItemWithTrigger={false}>
            <SelectGroup>
              {[10, 20, 30, 40, 50, 100].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

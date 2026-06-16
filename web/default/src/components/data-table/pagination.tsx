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
    return { start: 0, end: 0, total: 0, currentPageRows: 0 }
  }

  const start = pageIndex * pageSize + 1
  const end = pageIndex * pageSize + currentPageRows

  return { start, end, total: totalRows, currentPageRows }
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  const { t } = useTranslation()
  const currentPage = table.getState().pagination.pageIndex + 1
  const totalPages = table.getPageCount()
  const pageNumbers = getPageNumbers(currentPage, totalPages)
  const rowSummary = getRowCountSummary(table)

  return (
    <div
      className={cn(
        'flex items-center justify-between overflow-clip',
        '@max-2xl/content:flex-col-reverse @max-2xl/content:gap-2 sm:@max-2xl/content:gap-4'
      )}
      style={{ overflowClipMargin: 1 }}
    >
      <div className='flex w-full items-center justify-between gap-2'>
        <div className='text-muted-foreground flex min-w-0 flex-col gap-0.5 text-xs sm:flex-row sm:items-center sm:gap-3 sm:text-sm'>
          {rowSummary && (
            <span className='font-medium whitespace-nowrap'>
              {rowSummary.total === 0
                ? t('Total {{count}} records', { count: 0 })
                : t('Showing {{start}}-{{end}} of {{total}}', {
                    start: rowSummary.start.toLocaleString(),
                    end: rowSummary.end.toLocaleString(),
                    total: rowSummary.total.toLocaleString(),
                  })}
            </span>
          )}
          <span className='font-medium whitespace-nowrap @2xl/content:hidden'>
            {t('Page {{current}} of {{total}}', {
              current: currentPage,
              total: totalPages,
            })}
          </span>
        </div>
        <div className='flex items-center gap-2 @max-2xl/content:flex-row-reverse'>
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
          <p className='hidden text-sm font-medium sm:block'>
            {t('Rows per page')}
          </p>
        </div>
      </div>

      <div className='flex items-center sm:space-x-6 lg:space-x-8'>
        <div className='text-muted-foreground hidden min-w-[130px] flex-col gap-0.5 text-sm font-medium whitespace-nowrap @max-3xl/content:hidden @3xl/content:flex'>
          {rowSummary && rowSummary.total > 0 && (
            <span>
              {t('{{count}} on this page', {
                count: rowSummary.currentPageRows.toLocaleString(),
              })}
            </span>
          )}
          <span>
            {t('Page {{current}} of {{total}}', {
              current: currentPage,
              total: totalPages,
            })}
          </span>
        </div>
        <div className='flex items-center space-x-1.5 sm:space-x-2'>
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

          {/* Page number buttons */}
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
      </div>
    </div>
  )
}

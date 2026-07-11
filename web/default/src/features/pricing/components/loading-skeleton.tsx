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
import { Skeleton } from '@/components/ui/skeleton'

import { DEFAULT_VIEW_MODE, VIEW_MODES, type ViewMode } from '../constants'

const CARD_SKELETONS = [
  'card-1',
  'card-2',
  'card-3',
  'card-4',
  'card-5',
  'card-6',
  'card-7',
  'card-8',
  'card-9',
]
const PRICE_COLUMNS = ['input', 'cached', 'output', 'groups']
const TABLE_ROWS = [
  'row-1',
  'row-2',
  'row-3',
  'row-4',
  'row-5',
  'row-6',
  'row-7',
  'row-8',
  'row-9',
  'row-10',
]
const PAGINATION_ITEMS = ['previous', 'page-1', 'page-2', 'next']

export interface LoadingSkeletonProps {
  viewMode?: ViewMode
}

export function LoadingSkeleton(props: LoadingSkeletonProps) {
  const viewMode = props.viewMode ?? DEFAULT_VIEW_MODE

  return (
    <div>
      <div className='mb-8 max-w-3xl space-y-2'>
        <Skeleton className='h-6 w-48' />
        <Skeleton className='h-4 w-full max-w-xl' />
      </div>
      <div className='space-y-4'>
        <FilterBarSkeleton />
        {viewMode === VIEW_MODES.TABLE ? (
          <TableContentSkeleton />
        ) : (
          <CardContentSkeleton />
        )}
      </div>
    </div>
  )
}

function CardContentSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
      {CARD_SKELETONS.map((key) => (
        <div key={key} className='rounded-lg border p-4'>
          <div className='flex items-start justify-between gap-3'>
            <div className='flex min-w-0 items-start gap-3'>
              <Skeleton className='size-9 shrink-0 rounded-lg' />
              <div className='min-w-0 flex-1 space-y-2'>
                <Skeleton className='h-5 w-36' />
                <Skeleton className='h-3.5 w-48' />
              </div>
            </div>
            <Skeleton className='h-8 w-16 rounded-md' />
          </div>
          <div className='mt-4 space-y-2'>
            <Skeleton className='h-3.5 w-full' />
            <Skeleton className='h-3.5 w-4/5' />
          </div>
          <div className='mt-4 flex items-center gap-2'>
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-4 w-16' />
          </div>
          <div className='mt-2 flex items-center gap-3'>
            <Skeleton className='h-3.5 w-14' />
            <Skeleton className='h-3.5 w-14' />
            <Skeleton className='h-3.5 w-8' />
          </div>
        </div>
      ))}
    </div>
  )
}

function FilterBarSkeleton() {
  return (
    <div>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <Skeleton className='h-7 w-full sm:h-8 sm:max-w-sm' />
        <div className='flex flex-wrap items-center gap-2 sm:ml-auto'>
          <Skeleton className='h-7 w-20 sm:h-8' />
          <Skeleton className='h-7 w-24 sm:h-8' />
          <Skeleton className='h-7 w-28 sm:h-8' />
          <Skeleton className='h-7 w-16 sm:h-8' />
        </div>
      </div>
      <Skeleton className='mt-3 h-4 w-24' />
    </div>
  )
}

function TableContentSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='overflow-hidden rounded-lg border'>
        <div className='bg-muted/30 border-b px-4 py-3'>
          <div className='grid grid-cols-[minmax(200px,2fr)_repeat(3,minmax(100px,1fr))_minmax(120px,1fr)] gap-4'>
            <Skeleton className='h-4 w-32' />
            {PRICE_COLUMNS.map((column) => (
              <Skeleton key={column} className='h-4 w-20' />
            ))}
          </div>
        </div>
        {TABLE_ROWS.map((row) => (
          <div
            key={row}
            className='grid grid-cols-[minmax(200px,2fr)_repeat(3,minmax(100px,1fr))_minmax(120px,1fr)] gap-4 border-b px-4 py-3 last:border-b-0'
          >
            <Skeleton className='h-5 w-40' />
            {PRICE_COLUMNS.map((column) => (
              <Skeleton key={`${row}-${column}`} className='h-5 w-20' />
            ))}
          </div>
        ))}
      </div>
      <div className='flex items-center justify-between'>
        <Skeleton className='h-5 w-32' />
        <div className='flex items-center gap-2'>
          {PAGINATION_ITEMS.map((item) => (
            <Skeleton key={item} className='size-8' />
          ))}
        </div>
      </div>
    </div>
  )
}

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

import { VIEW_MODES, type ViewMode } from '../constants'

const placeholderRows = Array.from(
  { length: 10 },
  (_, position) => `placeholder-${position}`
)

export interface LoadingSkeletonProps {
  viewMode?: ViewMode
}

export function LoadingSkeleton(props: LoadingSkeletonProps) {
  const viewMode = props.viewMode ?? VIEW_MODES.CARD

  return (
    <div className='space-y-5'>
      <div className='space-y-1.5'>
        <Skeleton className='h-8 w-40' />
        <Skeleton className='h-4 w-52' />
      </div>
      <Skeleton className='h-10 w-full rounded-lg' />
      <FilterBarSkeleton />
      {viewMode === VIEW_MODES.TABLE ? (
        <TableContentSkeleton />
      ) : (
        <CardContentSkeleton />
      )}
    </div>
  )
}

function CardContentSkeleton() {
  return (
    <div className='grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-3 sm:gap-4'>
      {placeholderRows.slice(0, 9).map((row) => (
        <div
          key={row}
          className='min-w-0 space-y-4 rounded-3xl border p-4 sm:p-5'
        >
          <div className='flex min-w-0 items-start gap-3'>
            <Skeleton className='size-10 shrink-0 rounded-xl' />
            <Skeleton className='h-10 min-w-0 flex-1' />
          </div>
          <div className='space-y-2'>
            <Skeleton className='h-3.5 w-full' />
            <Skeleton className='h-3.5 w-4/5' />
          </div>
          <Skeleton className='h-24 w-full rounded-2xl' />
          <div className='flex flex-wrap items-center gap-2'>
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-4 w-16' />
          </div>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <Skeleton className='h-8 w-32' />
            <Skeleton className='ml-auto h-8 w-28 rounded-full' />
          </div>
        </div>
      ))}
    </div>
  )
}

function FilterBarSkeleton() {
  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-3'>
        <div className='flex flex-1 flex-wrap items-center gap-2'>
          {[80, 90, 75, 85, 70].map((width) => (
            <Skeleton
              key={width}
              className='h-8 rounded-lg'
              style={{ width: `${width}px` }}
            />
          ))}
        </div>
        <div className='flex items-center gap-2'>
          <Skeleton className='h-8 w-24 rounded-lg' />
          <Skeleton className='h-8 w-20 rounded-lg' />
          <Skeleton className='h-8 w-24' />
          <Skeleton className='h-8 w-20 rounded-lg' />
        </div>
      </div>
      <Skeleton className='h-5 w-24' />
    </div>
  )
}

function TableContentSkeleton() {
  const columns = [
    { id: 'model', width: 200 },
    { id: 'input', width: 100 },
    { id: 'output', width: 100 },
    { id: 'cache', width: 100 },
    { id: 'group', width: 80 },
    { id: 'actions', width: 100 },
  ]

  return (
    <div className='space-y-4'>
      <div className='overflow-hidden rounded-lg border'>
        <div className='bg-muted/30 border-b px-4 py-3'>
          <div className='flex items-center gap-4'>
            {columns.map((col) => (
              <Skeleton
                key={col.id}
                className='h-4'
                style={{ width: `${col.width}px` }}
              />
            ))}
          </div>
        </div>
        {placeholderRows.map((row) => (
          <div
            key={row}
            className='flex items-center gap-4 border-b px-4 py-3 last:border-b-0'
          >
            {columns.map((col) => (
              <Skeleton
                key={col.id}
                className='h-5'
                style={{ width: `${col.width}px` }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className='flex items-center justify-between'>
        <Skeleton className='h-5 w-32' />
        <div className='flex items-center gap-2'>
          {placeholderRows.slice(0, 4).map((row) => (
            <Skeleton key={row} className='size-8' />
          ))}
        </div>
      </div>
    </div>
  )
}

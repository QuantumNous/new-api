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

const CARD_SKELETON_IDS = [
  'c1',
  'c2',
  'c3',
  'c4',
  'c5',
  'c6',
  'c7',
  'c8',
  'c9',
] as const

const FILTER_CHIP_SKELETONS = [
  { id: 'f1', width: 80 },
  { id: 'f2', width: 90 },
  { id: 'f3', width: 75 },
  { id: 'f4', width: 85 },
  { id: 'f5', width: 70 },
] as const

const TABLE_COLUMN_SKELETONS = [
  { id: 'col-model', width: 200 },
  { id: 'col-provider', width: 100 },
  { id: 'col-input', width: 100 },
  { id: 'col-output', width: 100 },
  { id: 'col-tags', width: 80 },
  { id: 'col-actions', width: 100 },
] as const

const TABLE_ROW_SKELETON_IDS = [
  'r1',
  'r2',
  'r3',
  'r4',
  'r5',
  'r6',
  'r7',
  'r8',
  'r9',
  'r10',
] as const

const PAGINATION_SKELETON_IDS = ['p1', 'p2', 'p3', 'p4'] as const

export interface LoadingSkeletonProps {
  viewMode?: ViewMode
}

export function LoadingSkeleton(props: LoadingSkeletonProps) {
  const viewMode = props.viewMode ?? VIEW_MODES.CARD

  return (
    <div className='space-y-5'>
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
    <div className='grid grid-cols-[repeat(auto-fill,minmax(min(270px,100%),1fr))] gap-3.5 sm:gap-4'>
      {CARD_SKELETON_IDS.map((id) => (
        <div key={id} className='rounded-xl border p-4'>
          <div className='flex items-start gap-2.5'>
            <Skeleton className='size-9 shrink-0 rounded-lg' />
            <div className='min-w-0 flex-1 space-y-1.5'>
              <Skeleton className='h-4 w-32' />
              <Skeleton className='h-3 w-40' />
            </div>
          </div>
          <div className='mt-3 flex items-center gap-1.5'>
            <Skeleton className='h-5 w-14 rounded-md' />
            <Skeleton className='h-5 w-16 rounded-md' />
            <Skeleton className='h-5 w-14 rounded-md' />
          </div>
          <div className='mt-3 flex items-center justify-between gap-2 border-t pt-2.5'>
            <Skeleton className='h-4 w-36' />
            <Skeleton className='h-6 w-14 rounded-md' />
          </div>
        </div>
      ))}
    </div>
  )
}

function FilterBarSkeleton() {
  return (
    <div className='flex flex-col gap-3'>
      <div className='space-y-1.5'>
        <Skeleton className='h-7 w-40' />
        <Skeleton className='h-4 w-72 max-w-full' />
      </div>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
        <Skeleton className='h-8 min-w-0 flex-1 rounded-lg' />
        <div className='flex items-center gap-2'>
          <Skeleton className='size-8 rounded-lg' />
          <Skeleton className='h-8 w-20 rounded-lg' />
          <Skeleton className='h-8 w-16 rounded-lg' />
        </div>
      </div>
      <div className='flex items-center gap-1.5 overflow-hidden'>
        {FILTER_CHIP_SKELETONS.map((chip) => (
          <Skeleton
            key={chip.id}
            className='h-7 shrink-0 rounded-full'
            style={{ width: `${chip.width}px` }}
          />
        ))}
      </div>
    </div>
  )
}

function TableContentSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='overflow-hidden rounded-lg border'>
        <div className='bg-muted/30 border-b px-4 py-3'>
          <div className='flex items-center gap-4'>
            {TABLE_COLUMN_SKELETONS.map((col) => (
              <Skeleton
                key={col.id}
                className='h-4'
                style={{ width: `${col.width}px` }}
              />
            ))}
          </div>
        </div>
        {TABLE_ROW_SKELETON_IDS.map((rowId) => (
          <div
            key={rowId}
            className='flex items-center gap-4 border-b px-4 py-3 last:border-b-0'
          >
            {TABLE_COLUMN_SKELETONS.map((col) => (
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
          {PAGINATION_SKELETON_IDS.map((id) => (
            <Skeleton key={id} className='size-8' />
          ))}
        </div>
      </div>
    </div>
  )
}

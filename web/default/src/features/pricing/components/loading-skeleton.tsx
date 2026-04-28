import { Skeleton } from '@/components/ui/skeleton'
import { VIEW_MODES, type ViewMode } from '../constants'

export interface LoadingSkeletonProps {
  viewMode?: ViewMode
}

export function LoadingSkeleton(props: LoadingSkeletonProps) {
  const viewMode = props.viewMode ?? VIEW_MODES.LIST

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
        <ListContentSkeleton />
      )}
    </div>
  )
}

function FilterBarSkeleton() {
  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-3'>
        <div className='flex flex-1 flex-wrap items-center gap-2'>
          {[80, 90, 75, 85, 70].map((width, i) => (
            <Skeleton
              key={i}
              className='h-8 rounded-full'
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

function ListContentSkeleton() {
  return (
    <div className='overflow-hidden rounded-lg border'>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className='flex items-start gap-4 border-b px-4 py-3.5 last:border-b-0 sm:px-5 sm:py-4'
        >
          <Skeleton className='hidden size-5 shrink-0 rounded sm:block' />
          <div className='min-w-0 flex-1 space-y-2'>
            <Skeleton className='h-5 w-48' />
            <div className='flex items-center gap-2'>
              <Skeleton className='h-3.5 w-20' />
              <Skeleton className='h-3.5 w-24' />
            </div>
            <Skeleton className='h-3.5 w-full max-w-md' />
          </div>
          <div className='shrink-0 space-y-1 text-right'>
            <Skeleton className='ml-auto h-4 w-20' />
            <Skeleton className='ml-auto h-4 w-16' />
            <Skeleton className='ml-auto h-4 w-20' />
          </div>
        </div>
      ))}
    </div>
  )
}

function TableContentSkeleton() {
  const columns = [
    { width: 200 },
    { width: 100 },
    { width: 100 },
    { width: 100 },
    { width: 80 },
    { width: 100 },
  ]

  return (
    <div className='space-y-4'>
      <div className='overflow-hidden rounded-lg border'>
        <div className='bg-muted/30 border-b px-4 py-3'>
          <div className='flex items-center gap-4'>
            {columns.map((col, i) => (
              <Skeleton
                key={i}
                className='h-4'
                style={{ width: `${col.width}px` }}
              />
            ))}
          </div>
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className='flex items-center gap-4 border-b px-4 py-3 last:border-b-0'
          >
            {columns.map((col, j) => (
              <Skeleton
                key={j}
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
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='size-8' />
          ))}
        </div>
      </div>
    </div>
  )
}

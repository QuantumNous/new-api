import { Skeleton } from '@/components/ui/skeleton'

// ----------------------------------------------------------------------------
// Loading Skeleton Component
// ----------------------------------------------------------------------------

export function LoadingSkeleton() {
  return (
    <div className='flex gap-8'>
      {/* Sidebar Skeleton - Desktop */}
      <div className='hidden w-64 shrink-0 space-y-6 lg:block'>
        <Skeleton className='h-6 w-20' />
        <div className='space-y-4'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className='space-y-2'>
              <Skeleton className='h-5 w-32' />
              <div className='space-y-1'>
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className='h-8 w-full' />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className='flex-1 space-y-5'>
        {/* Header */}
        <div className='mb-3 flex items-start justify-between gap-4'>
          <div className='space-y-2'>
            <Skeleton className='h-8 w-32' />
            <Skeleton className='h-5 w-60' />
          </div>
          <Skeleton className='h-10 w-[100px] rounded-md sm:hidden' />
        </div>

        {/* Top bar */}
        <div className='flex items-center justify-between'>
          <Skeleton className='h-5 w-24' />
          <Skeleton className='h-5 w-28' />
        </div>

        {/* Search and sort row */}
        <div className='flex items-center gap-3'>
          <Skeleton className='h-10 flex-1 rounded-lg' />
          <Skeleton className='hidden h-10 w-[120px] rounded-md sm:block' />
        </div>

        {/* Model list */}
        <div className='space-y-0 overflow-hidden rounded-lg border'>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className='h-32 w-full rounded-none' />
          ))}
        </div>
      </div>
    </div>
  )
}

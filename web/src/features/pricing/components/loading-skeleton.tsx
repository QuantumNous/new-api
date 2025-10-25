import { Skeleton } from '@/components/ui/skeleton'

// ----------------------------------------------------------------------------
// Loading Skeleton Component
// ----------------------------------------------------------------------------

export function LoadingSkeleton() {
  return (
    <div className='space-y-8'>
      {/* Header */}
      <div className='space-y-2'>
        <Skeleton className='h-11 w-48' />
        <Skeleton className='h-6 w-60' />
      </div>

      {/* Layout */}
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
        <div className='flex-1 space-y-6'>
          <Skeleton className='h-12 w-full' />
          <div className='flex items-center justify-between'>
            <Skeleton className='h-5 w-24' />
            <Skeleton className='h-10 w-[180px]' />
          </div>
          <div className='space-y-0 overflow-hidden rounded-lg border'>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className='h-32 w-full rounded-none' />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

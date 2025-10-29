import { Skeleton } from '@/components/ui/skeleton'

// ----------------------------------------------------------------------------
// Loading Skeleton Component
// ----------------------------------------------------------------------------

export function LoadingSkeleton() {
  return (
    <div className='flex gap-8'>
      {/* Sidebar Skeleton - Desktop */}
      <div className='hidden w-64 shrink-0 lg:block'>
        <div className='space-y-1 pr-2'>
          {/* Header with Filters title and Clear all button */}
          <div className='mb-4 flex items-center justify-between'>
            <Skeleton className='h-4 w-16' />
            <Skeleton className='h-3 w-14' />
          </div>

          {/* Filter Sections */}
          <div className='space-y-0'>
            {/* Pricing Type - 3 options */}
            <div className='mb-3'>
              <Skeleton className='mb-2 h-4 w-24' />
              <div className='flex flex-col gap-1'>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className='h-8 w-full' />
                ))}
              </div>
            </div>

            {/* Endpoint Type - 9 options */}
            <div className='mb-3'>
              <Skeleton className='mb-2 h-4 w-28' />
              <div className='flex flex-col gap-1'>
                {Array.from({ length: 9 }).map((_, i) => (
                  <Skeleton key={i} className='h-8 w-full' />
                ))}
              </div>
            </div>

            {/* Vendor */}
            <div className='mb-3'>
              <Skeleton className='mb-2 h-4 w-16' />
              <div className='flex flex-col gap-1'>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className='h-8 w-full' />
                ))}
                <Skeleton className='h-7 w-20' />
              </div>
            </div>

            {/* Group */}
            <div className='mb-3'>
              <Skeleton className='mb-2 h-4 w-14' />
              <div className='flex flex-col gap-1'>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className='h-8 w-full' />
                ))}
                <Skeleton className='h-7 w-20' />
              </div>
            </div>

            {/* Tags */}
            <div className='mb-3'>
              <Skeleton className='mb-2 h-4 w-12' />
              <div className='flex flex-col gap-1'>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className='h-8 w-full' />
                ))}
                <Skeleton className='h-7 w-20' />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className='min-w-0 flex-1'>
        {/* Header */}
        <div className='mb-4 sm:mb-6'>
          <div className='mb-3 flex items-start justify-between gap-4 sm:mb-0'>
            <div className='space-y-0.5 sm:space-y-1'>
              <Skeleton className='h-7 w-24 sm:h-8 sm:w-32' />
              <Skeleton className='h-4 w-48 sm:h-5 sm:w-60' />
            </div>
            {/* Sort Dropdown - Mobile (Top Right) */}
            <Skeleton className='h-9 w-[100px] sm:hidden' />
          </div>
        </div>

        {/* Top Bar - Results Count & Reset Filters */}
        <div className='mb-3 flex items-center justify-between gap-4 sm:mb-4'>
          <Skeleton className='h-5 w-20' />
          <Skeleton className='h-5 w-24' />
        </div>

        {/* Search and Controls Bar */}
        <div className='mb-5 space-y-4 sm:mb-6'>
          {/* Row 1: Content-Focused Controls */}
          <div className='flex flex-wrap items-center gap-3'>
            {/* Search Bar */}
            <Skeleton className='h-8 min-w-0 flex-1' />
            {/* Mobile Filter Button */}
            <Skeleton className='h-8 w-[100px] shrink-0 sm:hidden' />
            {/* View Toggle - Desktop Only */}
            <Skeleton className='hidden h-8 w-[88px] sm:block' />
            {/* Price Display Toggle - Mobile Only (full width) */}
            <Skeleton className='h-8 w-full sm:hidden' />
            {/* Token Unit Toggle - Mobile Only (full width) */}
            <Skeleton className='h-8 w-full sm:hidden' />
          </div>

          {/* Row 2: Display/Formatting Controls - Desktop Only */}
          <div className='hidden sm:flex sm:items-center sm:gap-3'>
            {/* Price Display Toggle */}
            <Skeleton className='h-8 w-[180px]' />
            {/* Token Unit Toggle */}
            <Skeleton className='h-8 w-[160px]' />
            {/* Sort Dropdown */}
            <Skeleton className='h-8 w-[180px]' />
          </div>

          {/* Active Filter Tags */}
          <div className='flex flex-wrap gap-2'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className='h-5 w-20' />
            ))}
          </div>
        </div>

        {/* Model List */}
        <div className='space-y-0 overflow-hidden rounded-lg border'>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className='border-b px-4 py-4 last:border-b-0 sm:px-6 sm:py-6'
            >
              <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8'>
                {/* Left: Model Info */}
                <div className='min-w-0 flex-1 space-y-2'>
                  {/* Model Name & Vendor */}
                  <div className='space-y-0.5 sm:space-y-1'>
                    <Skeleton className='h-5 w-48 sm:h-6' />
                    <div className='flex items-center gap-1.5'>
                      <Skeleton className='h-3.5 w-3.5' />
                      <Skeleton className='h-3.5 w-24 sm:h-4' />
                    </div>
                  </div>
                  {/* Description */}
                  <div className='space-y-1'>
                    <Skeleton className='h-3.5 w-full max-w-md sm:h-4' />
                    <Skeleton className='h-3.5 w-3/4 max-w-sm sm:h-4' />
                  </div>
                  {/* Tags */}
                  <div className='flex flex-wrap gap-1 sm:gap-1.5'>
                    {Array.from({ length: 3 }).map((_, j) => (
                      <Skeleton key={j} className='h-5 w-16' />
                    ))}
                  </div>
                </div>
                {/* Right: Pricing Info (Token-based) */}
                <div className='flex shrink-0 flex-col items-start gap-1 sm:items-end sm:gap-1.5'>
                  <div className='flex items-center gap-2 sm:gap-3'>
                    {/* Input Price */}
                    <div className='flex flex-col items-start gap-0.5 sm:items-end'>
                      <Skeleton className='h-2.5 w-10 sm:h-3' />
                      <Skeleton className='h-5 w-14 sm:h-6' />
                    </div>
                    {/* Separator */}
                    <Skeleton className='h-6 w-px sm:h-8' />
                    {/* Output Price */}
                    <div className='flex flex-col items-start gap-0.5 sm:items-end'>
                      <Skeleton className='h-2.5 w-12 sm:h-3' />
                      <Skeleton className='h-5 w-14 sm:h-6' />
                    </div>
                  </div>
                  {/* Unit Label */}
                  <Skeleton className='h-3 w-24 sm:h-3.5' />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

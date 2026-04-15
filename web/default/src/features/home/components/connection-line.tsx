import { cn } from '@/lib/utils'

interface ConnectionLineProps {
  direction?: 'left' | 'right'
}

/**
 * Connection line between gateway and icon columns
 */
export function ConnectionLine({ direction = 'left' }: ConnectionLineProps) {
  const gradientClass =
    direction === 'left'
      ? 'from-amber-500/60 to-amber-500/20'
      : 'from-amber-500/20 to-amber-500/60'

  return (
    <div className='hidden lg:block'>
      <div className={cn('h-[2px] w-24 bg-gradient-to-r', gradientClass)} />
    </div>
  )
}

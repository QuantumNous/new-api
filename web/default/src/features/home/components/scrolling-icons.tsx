import { cn } from '@/lib/utils'
import { IconCard } from './icon-card'

interface ScrollingIconsProps {
  icons: readonly string[]
  direction?: 'up' | 'down'
  className?: string
}

/**
 * Scrolling icon column with seamless loop animation
 */
export function ScrollingIcons({
  icons,
  direction = 'up',
  className,
}: ScrollingIconsProps) {
  const animationClass =
    direction === 'up' ? 'animate-scroll-up' : 'animate-scroll-down'

  return (
    <div
      className={cn(
        'scroll-container hidden h-[360px] overflow-hidden lg:block',
        className
      )}
    >
      <div className={cn('flex flex-col gap-5', animationClass)}>
        {/* First set */}
        {icons.map((iconName, i) => (
          <IconCard key={`${direction}-1-${i}`} iconName={iconName} />
        ))}
        {/* Duplicate set for seamless loop */}
        {icons.map((iconName, i) => (
          <IconCard
            key={`${direction}-2-${i}`}
            iconName={iconName}
            className='aria-hidden'
          />
        ))}
      </div>
    </div>
  )
}

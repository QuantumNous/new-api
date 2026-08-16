'use client'

import { type CSSProperties, type ElementType, memo, useMemo } from 'react'

import { cn } from '@/lib/utils'

export type TextShimmerProps = {
  children: string
  as?: ElementType
  className?: string
  duration?: number
  spread?: number
}

const ShimmerComponent = ({
  children,
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) => {
  const dynamicSpread = useMemo(
    () => (children?.length ?? 0) * spread,
    [children, spread]
  )

  return (
    <p
      className={cn(
        'relative inline-block animate-shimmer bg-[length:250%_100%,auto] bg-clip-text text-transparent',
        '[background-repeat:no-repeat,padding-box] [--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))]',
        className
      )}
      style={
        {
          '--spread': `${dynamicSpread}px`,
          backgroundImage:
            'var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))',
          animationDuration: `${duration}s`,
        } as CSSProperties
      }
    >
      {children}
    </p>
  )
}

export const Shimmer = memo(ShimmerComponent)
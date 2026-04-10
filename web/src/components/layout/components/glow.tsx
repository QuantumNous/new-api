import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const glowVariants = cva('absolute w-full', {
  variants: {
    variant: {
      top: 'top-0',
      above: '-top-[128px]',
      bottom: 'bottom-0',
      below: '-bottom-[128px]',
      center: 'top-[50%]',
    },
  },
  defaultVariants: {
    variant: 'top',
  },
})

export interface GlowProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glowVariants> {}

export function Glow({ className, variant, ...props }: GlowProps) {
  return (
    <div
      data-slot='glow'
      className={cn(glowVariants({ variant }), className)}
      {...props}
    >
      <div
        className={cn(
          'absolute left-1/2 h-[256px] w-[60%] -translate-x-1/2 scale-[2.5] rounded-[50%] bg-radial from-amber-500/60 from-10% to-amber-500/0 to-60% opacity-40 sm:h-[512px] dark:opacity-80',
          variant === 'center' && '-translate-y-1/2'
        )}
      />
      <div
        className={cn(
          'absolute left-1/2 h-[128px] w-[40%] -translate-x-1/2 scale-200 rounded-[50%] bg-radial from-yellow-400/50 from-10% to-yellow-400/0 to-60% opacity-30 sm:h-[256px] dark:opacity-70',
          variant === 'center' && '-translate-y-1/2'
        )}
      />
    </div>
  )
}

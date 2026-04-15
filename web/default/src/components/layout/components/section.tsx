import * as React from 'react'
import { cn } from '@/lib/utils'

export function Section({
  className,
  ...props
}: React.ComponentProps<'section'>) {
  return (
    <section
      data-slot='section'
      className={cn(
        'bg-background text-foreground px-4 py-6 sm:py-12 md:py-20',
        className
      )}
      {...props}
    />
  )
}

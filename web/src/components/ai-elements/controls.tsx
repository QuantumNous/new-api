'use client'

import type { ComponentProps } from 'react'
import { Controls as ControlsPrimitive } from '@xyflow/react'
import { cn } from '@/lib/utils'

export type ControlsProps = ComponentProps<typeof ControlsPrimitive>

export const Controls = ({ className, ...props }: ControlsProps) => (
  <ControlsPrimitive
    className={cn(
      'bg-card gap-px overflow-hidden rounded-md border p-1 shadow-none!',
      '[&>button]:hover:bg-secondary! [&>button]:rounded-md [&>button]:border-none! [&>button]:bg-transparent!',
      className
    )}
    {...props}
  />
)

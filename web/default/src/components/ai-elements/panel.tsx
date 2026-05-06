import type { ComponentProps } from 'react'
import { Panel as PanelPrimitive } from '@xyflow/react'
import { cn } from '@/lib/utils'

type PanelProps = ComponentProps<typeof PanelPrimitive>

export const Panel = ({ className, ...props }: PanelProps) => (
  <PanelPrimitive
    className={cn(
      'bg-card m-4 overflow-hidden rounded-md border p-1',
      className
    )}
    {...props}
  />
)

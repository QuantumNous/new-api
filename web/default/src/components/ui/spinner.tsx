import { Loading03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from '@/lib/utils'

type SpinnerProps = Omit<
  React.ComponentProps<typeof HugeiconsIcon>,
  'icon' | 'strokeWidth'
> & {
  strokeWidth?: number
}

function Spinner({ className, strokeWidth = 2, ...props }: SpinnerProps) {
  return (
    <HugeiconsIcon
      icon={Loading03Icon}
      strokeWidth={strokeWidth}
      role='status'
      aria-label='Loading'
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }

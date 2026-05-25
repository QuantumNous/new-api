import type { ReactNode } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

type DocCalloutVariant = 'info' | 'warning'

type DocCalloutProps = {
  variant?: DocCalloutVariant
  title: string
  children: ReactNode
  className?: string
}

export function DocCallout(props: DocCalloutProps) {
  const variant = props.variant ?? 'info'
  const Icon = variant === 'warning' ? AlertTriangle : Info

  return (
    <Alert
      className={cn(
        variant === 'warning'
          ? 'border-amber-500/50 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-50'
          : 'border-blue-500/50 bg-blue-50 text-blue-950 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-50',
        props.className
      )}
    >
      <Icon aria-hidden='true' />
      <AlertTitle>{props.title}</AlertTitle>
      <AlertDescription className='text-inherit/90'>{props.children}</AlertDescription>
    </Alert>
  )
}

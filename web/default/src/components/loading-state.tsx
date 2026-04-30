import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  className?: string
  message?: string
  size?: 'sm' | 'md' | 'lg'
  inline?: boolean
}

const sizeMap = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-8',
} as const

export function LoadingState(props: LoadingStateProps) {
  const { t } = useTranslation()
  const iconSize = sizeMap[props.size ?? 'md']

  if (props.inline) {
    return (
      <span className={cn('inline-flex items-center gap-2', props.className)}>
        <Loader2 className={cn(iconSize, 'animate-spin')} />
        {props.message != null && (
          <span className='text-muted-foreground text-sm'>{props.message}</span>
        )}
      </span>
    )
  }

  return (
    <div
      className={cn(
        'flex min-h-[200px] flex-col items-center justify-center gap-3',
        props.className
      )}
    >
      <div className='animate-spin'>
        <Loader2 className={iconSize} />
      </div>
      <p className='text-muted-foreground text-sm'>
        {props.message ?? t('Loading...')}
      </p>
    </div>
  )
}

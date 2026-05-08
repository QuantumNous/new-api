import type { ReactNode } from 'react'
import { AlertTriangle, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { FadeIn } from '@/components/page-transition'

interface ErrorStateProps {
  icon?: LucideIcon
  title?: string
  description?: string
  onRetry?: () => void
  action?: ReactNode
  className?: string
}

export function ErrorState(props: ErrorStateProps) {
  const { t } = useTranslation()
  const Icon = props.icon ?? AlertTriangle

  return (
    <FadeIn>
      <Empty className={cn('min-h-[300px]', props.className)}>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <Icon className='text-destructive size-6' />
          </EmptyMedia>
          <EmptyTitle>
            {props.title ?? t('Oops! Something went wrong')}
          </EmptyTitle>
          {props.description != null && (
            <EmptyDescription>{props.description}</EmptyDescription>
          )}
        </EmptyHeader>
        <EmptyContent>
          {props.onRetry != null && (
            <Button variant='outline' size='sm' onClick={props.onRetry}>
              {t('Retry')}
            </Button>
          )}
          {props.action}
        </EmptyContent>
      </Empty>
    </FadeIn>
  )
}

import type { ReactNode } from 'react'
import { Database, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { FadeIn } from '@/components/page-transition'

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  description?: string
  action?: ReactNode
  className?: string
  bordered?: boolean
}

export function EmptyState(props: EmptyStateProps) {
  const { t } = useTranslation()
  const Icon = props.icon ?? Database

  return (
    <FadeIn>
      <Empty
        className={cn(
          'min-h-[300px]',
          props.bordered && 'border',
          props.className
        )}
      >
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <Icon className='size-6' />
          </EmptyMedia>
          <EmptyTitle>{props.title ?? t('No Data')}</EmptyTitle>
          {props.description != null && (
            <EmptyDescription>{props.description}</EmptyDescription>
          )}
        </EmptyHeader>
        {props.action != null && <EmptyContent>{props.action}</EmptyContent>}
      </Empty>
    </FadeIn>
  )
}

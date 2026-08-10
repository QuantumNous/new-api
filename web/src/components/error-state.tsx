/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { AlertTriangle, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { FadeIn } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { getHttpStatus } from '@/features/errors/general-error-status'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  icon?: LucideIcon
  error?: unknown
  title?: string
  description?: string
  onRetry?: () => void
  action?: ReactNode
  className?: string
}

export function ErrorState(props: ErrorStateProps) {
  const { t } = useTranslation()
  const Icon = props.icon ?? AlertTriangle
  const isRateLimited = getHttpStatus(props.error) === 429
  const title = isRateLimited
    ? t('Too many requests')
    : (props.title ?? t('Oops! Something went wrong'))
  const description = isRateLimited
    ? t('Please wait a moment before trying again.')
    : (props.description ?? t('Please try again later.'))

  return (
    <FadeIn>
      <Empty className={cn('min-h-[300px]', props.className)}>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <Icon className='text-destructive size-6' />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
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

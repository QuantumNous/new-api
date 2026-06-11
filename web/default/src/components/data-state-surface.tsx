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
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  Database,
  Loader2,
  LockKeyhole,
  SearchX,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
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

export type DataStateVariant =
  | 'empty'
  | 'error'
  | 'loading'
  | 'permission'
  | 'search-empty'
  | 'offline'

interface DataStateSurfaceProps {
  variant: DataStateVariant
  title?: string
  description?: string
  icon?: LucideIcon
  iconNode?: ReactNode
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
  onRetry?: () => void
  className?: string
  compact?: boolean
  bordered?: boolean
}

const variantIconMap: Record<DataStateVariant, LucideIcon> = {
  empty: Database,
  error: AlertTriangle,
  loading: Loader2,
  permission: LockKeyhole,
  'search-empty': SearchX,
  offline: WifiOff,
}

const variantIconClassName: Record<DataStateVariant, string> = {
  empty: 'text-muted-foreground',
  error: 'text-destructive',
  loading: 'text-muted-foreground animate-spin',
  permission: 'text-warning',
  'search-empty': 'text-muted-foreground',
  offline: 'text-warning',
}

export function DataStateSurface(props: DataStateSurfaceProps) {
  const { t } = useTranslation()
  const Icon = props.icon ?? variantIconMap[props.variant]
  const isLoading = props.variant === 'loading'
  const isError = props.variant === 'error'

  const title = props.title ?? getDefaultTitle(props.variant, t)
  const description = props.description ?? getDefaultDescription(props.variant, t)

  return (
    <FadeIn>
      <Empty
        role={isError ? 'alert' : undefined}
        aria-busy={isLoading || undefined}
        aria-live={isLoading ? 'polite' : isError ? 'assertive' : undefined}
        className={cn(
          'bg-background/60 min-h-[300px] border-border/60',
          props.compact && 'min-h-[180px] gap-3 p-4',
          props.bordered && 'border',
          props.className
        )}
      >
        <EmptyHeader>
          <EmptyMedia
            variant='icon'
            className={cn(
              'size-10 rounded-xl border border-border/60 bg-muted/50',
              props.compact && 'size-9'
            )}
          >
            {props.iconNode ?? (
              <Icon
                className={cn(
                  props.compact ? 'size-5' : 'size-6',
                  variantIconClassName[props.variant]
                )}
              />
            )}
          </EmptyMedia>
          <EmptyTitle className={cn(!props.compact && 'text-base')}>
            {title}
          </EmptyTitle>
          {description != null && (
            <EmptyDescription>{description}</EmptyDescription>
          )}
        </EmptyHeader>
        {(props.onRetry != null ||
          props.primaryAction != null ||
          props.secondaryAction != null) && (
          <EmptyContent className='flex-row flex-wrap justify-center'>
            {props.onRetry != null && (
              <Button variant='outline' size='sm' onClick={props.onRetry}>
                {t('Retry')}
              </Button>
            )}
            {props.primaryAction}
            {props.secondaryAction}
          </EmptyContent>
        )}
      </Empty>
    </FadeIn>
  )
}

function getDefaultTitle(
  variant: DataStateVariant,
  t: ReturnType<typeof useTranslation>['t']
) {
  switch (variant) {
    case 'error':
      return t('Oops! Something went wrong')
    case 'loading':
      return t('Loading...')
    case 'permission':
      return t('Unauthorized Access')
    case 'search-empty':
      return t('No results found')
    case 'offline':
      return t('Request failed')
    case 'empty':
    default:
      return t('No Data')
  }
}

function getDefaultDescription(
  variant: DataStateVariant,
  t: ReturnType<typeof useTranslation>['t']
) {
  switch (variant) {
    case 'search-empty':
      return t('No records found. Try adjusting your filters.')
    case 'offline':
      return t('Please try again later.')
    default:
      return undefined
  }
}
